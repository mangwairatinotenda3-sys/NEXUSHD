import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Check,
  ChevronLeft,
  Expand,
  ExternalLink,
  Gauge,
  Lock,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Shrink,
  WifiOff,
} from 'lucide-react';
import { alternatesFor, formatClock } from '../services/archive.js';
import { fetchSubtitleVtt, toVtt } from '../services/subtitles.js';
import {
  isLandscape,
  lockLandscape,
  lockPortrait,
  releaseOrientation,
} from '../services/orientation.js';
import '../styles/player.css';

const REASONS = {
  1: 'The video was stopped.',
  2: 'The connection dropped while loading the video.',
  3: 'This phone could not decode the video.',
  4: 'The video file is not available or not supported.',
};

const PREF_KEY = 'nexushd:subs-pref';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HIDE_AFTER = 3500;
const SKIP = 10;

const readPref = () => {
  try {
    return window.localStorage.getItem(PREF_KEY) || 'off';
  } catch {
    return 'off';
  }
};

const savePref = (value) => {
  try {
    window.localStorage.setItem(PREF_KEY, value);
  } catch {
    /* storage unavailable */
  }
};

function CcIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10.2 10.2a2.2 2.2 0 1 0 0 3.6M16.6 10.2a2.2 2.2 0 1 0 0 3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RotateScreenIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 14.5a8 8 0 0 0 8 6.5m0 0-2.4-2.2M12 21l2.2-2.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkipIcon({ back }) {
  const Icon = back ? RotateCcw : RotateCw;
  return (
    <span className="pl-skip-ico">
      <Icon size={36} strokeWidth={1.7} />
      <b>{SKIP}</b>
    </span>
  );
}

/* subtitles: [{ label, url }] fetched when picked, or [{ label, text }] already saved */
export default function VideoPlayer({
  title,
  src,
  loading = false,
  startAt = 0,
  fallbackHref,
  subtitles = [],
  onClose,
  onProgress,
}) {
  const videoRef = useRef(null);
  const seekRef = useRef(null);
  const lastSave = useRef(0);
  const lastTap = useRef({ time: 0, side: '', timer: null });
  const flashTimer = useRef(null);
  const noteTimer = useRef(null);
  const subsRef = useRef(subtitles);
  subsRef.current = subtitles;

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [waiting, setWaiting] = useState(true);
  const [slow, setSlow] = useState(false);

  // controls
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [visible, setVisible] = useState(true);
  const [activity, setActivity] = useState(0);
  const [locked, setLocked] = useState(false);
  const [scrub, setScrub] = useState(null); // 0..1 while the bar is being dragged
  const [rate, setRate] = useState(1);
  const [fill, setFill] = useState(false);
  const [landscape, setLandscape] = useState(isLandscape);
  const [flash, setFlash] = useState(null); // { side, amount }
  const [note, setNote] = useState('');

  // subtitles
  const [menu, setMenu] = useState(null); // null | 'subs' | 'speed'
  const [choice, setChoice] = useState(readPref); // a subtitle label, or 'off'
  const [subUrl, setSubUrl] = useState(null);
  const [subState, setSubState] = useState('idle'); // idle | loading | error

  // the first file, then any other versions of the same film
  const sources = src ? [src, ...alternatesFor(src)] : [];
  const current = sources[index] || null;

  const selected = subtitles.find((s) => s.label === choice) || null;
  const selectedKey = selected ? `${selected.label}|${selected.url || ''}` : '';

  useEffect(() => {
    setIndex(0);
    setFailed(false);
    setReason('');
    setWaiting(true);
    setSlow(false);
  }, [src]);

  // Like a movie app: the Android app opens a film in landscape and gives the
  // screen back to the phone when it closes
  useEffect(() => {
    if (Capacitor.isNativePlatform()) lockLandscape();
    return () => {
      releaseOrientation();
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(orientation: landscape)');
    const update = () => setLandscape(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current);
      clearTimeout(noteTimer.current);
      clearTimeout(lastTap.current.timer);
    },
    []
  );

  // keep the screen awake while the film plays
  useEffect(() => {
    if (!playing || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.release?.().catch(() => {});
    };
  }, [playing]);

  // tell the viewer when the connection is slow
  useEffect(() => {
    if (!waiting || failed || !current) return undefined;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [waiting, failed, current]);

  // controls fade away while the film plays
  useEffect(() => {
    if (!visible || !playing || menu || scrub !== null) return undefined;
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER);
    return () => clearTimeout(timer);
  }, [visible, playing, menu, scrub, activity]);

  // load the chosen subtitles as a WebVTT file the video can show
  useEffect(() => {
    const track = subsRef.current.find((s) => `${s.label}|${s.url || ''}` === selectedKey);
    if (!track) {
      setSubUrl(null);
      setSubState('idle');
      return undefined;
    }
    let cancelled = false;
    let created = null;
    setSubState('loading');
    Promise.resolve()
      .then(() => (track.text ? toVtt(track.text) : fetchSubtitleVtt(track.url)))
      .then((vtt) => {
        if (cancelled) return;
        created = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        setSubUrl(created);
        setSubState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setSubUrl(null);
        setSubState('error');
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [selectedKey]);

  // make sure the track is switched on when it is added, and off when it is not
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const apply = () => {
      Array.from(video.textTracks).forEach((t) => {
        t.mode = subUrl ? 'showing' : 'disabled';
      });
    };
    apply();
    video.textTracks.addEventListener('addtrack', apply);
    return () => video.textTracks.removeEventListener('addtrack', apply);
  }, [subUrl, current]);

  const poke = useCallback(() => {
    setVisible(true);
    setActivity((n) => n + 1);
  }, []);

  const showNote = (text) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 1300);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    poke();
  }, [poke]);

  const skip = useCallback((delta, show = false) => {
    const v = videoRef.current;
    if (!v) return;
    const end = Number.isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(end, v.currentTime + delta));
    if (show) {
      setFlash((f) => {
        const side = delta < 0 ? 'left' : 'right';
        return { side, amount: f && f.side === side ? f.amount + SKIP : SKIP };
      });
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 750);
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (menu) setMenu(null);
        else onClose();
      } else if (e.key === ' ' && !menu) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        skip(-SKIP, true);
      } else if (e.key === 'ArrowRight') {
        skip(SKIP, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, menu, togglePlay, skip]);

  /* One tap shows or hides the controls. Two quick taps on the left or right
     side jump back or forward ten seconds. */
  const onTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const side = x < 0.35 ? 'left' : x > 0.65 ? 'right' : 'mid';
    const now = Date.now();
    const last = lastTap.current;
    clearTimeout(last.timer);

    if (!locked && side !== 'mid' && last.side === side && now - last.time < 300) {
      lastTap.current = { time: 0, side: '', timer: null };
      skip(side === 'left' ? -SKIP : SKIP, true);
      return;
    }

    const toggle = () => {
      setVisible((v) => !v);
      setActivity((n) => n + 1);
    };
    if (side === 'mid' || locked) {
      lastTap.current = { time: now, side: 'mid', timer: null };
      toggle();
    } else {
      lastTap.current = { time: now, side, timer: setTimeout(toggle, 280) };
    }
  };

  const ratioFrom = (e) => {
    const rect = seekRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  const onSeekDown = (e) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFrom(e));
  };

  const onSeekMove = (e) => {
    if (scrub !== null) setScrub(ratioFrom(e));
  };

  const onSeekUp = (e) => {
    if (scrub === null) return;
    const v = videoRef.current;
    if (v && duration) v.currentTime = ratioFrom(e) * duration;
    setScrub(null);
    poke();
  };

  const pickSubtitle = (label) => {
    setChoice(label);
    savePref(label);
    setMenu(null);
  };

  const pickSpeed = (value) => {
    setRate(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
    setMenu(null);
    poke();
  };

  const toggleFill = () => {
    const next = !fill;
    setFill(next);
    showNote(next ? 'Fill screen' : 'Fit to screen');
    poke();
  };

  const rotate = async () => {
    if (landscape) await lockPortrait();
    else await lockLandscape();
    poke();
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    if (startAt > 10 && startAt < v.duration - 30) v.currentTime = startAt;
  };

  const updateBuffered = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    const now = Math.floor(v.currentTime);
    if (Math.abs(now - lastSave.current) >= 5) {
      lastSave.current = now;
      onProgress?.(now);
    }
  };

  const onError = () => {
    const code = videoRef.current?.error?.code;
    if (index + 1 < sources.length) {
      // this file did not work, try the next version
      setWaiting(true);
      setSlow(false);
      setIndex(index + 1);
      return;
    }
    setReason(REASONS[code] || '');
    setFailed(true);
  };

  const retry = () => {
    setIndex(0);
    setFailed(false);
    setReason('');
    setWaiting(true);
    setSlow(false);
  };

  const canPlay = !loading && !failed && current;
  const shown = scrub !== null ? scrub * duration : time;
  const percent = duration ? Math.min(100, (shown / duration) * 100) : 0;
  const bufferedPercent = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const uiHidden = !visible || locked;

  return (
    <div className={`player pl ${uiHidden ? 'pl-ui-off' : ''} ${locked ? 'pl-locked' : ''}`}>
      {canPlay && (
        <>
          <video
            key={current}
            ref={videoRef}
            className="pl-video"
            style={{ objectFit: fill ? 'cover' : 'contain' }}
            src={current}
            autoPlay
            playsInline
            preload="auto"
            onLoadedMetadata={onLoadedMetadata}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              setDuration(Number.isFinite(d) ? d : 0);
            }}
            onCanPlay={() => {
              setWaiting(false);
              setSlow(false);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onPlaying={() => {
              setWaiting(false);
              setPlaying(true);
            }}
            onWaiting={() => setWaiting(true)}
            onProgress={updateBuffered}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => {
              setPlaying(false);
              setVisible(true);
              onProgress?.(0);
            }}
            onError={onError}
          >
            {subUrl && selected && (
              <track key={subUrl} kind="subtitles" src={subUrl} label={selected.label} srcLang="en" default />
            )}
          </video>

          {/* taps land here */}
          <div className="pl-tap" onClick={onTap} />

          {flash && (
            <div className={`pl-flash ${flash.side}`} key={`${flash.side}-${flash.amount}`}>
              <span>{flash.side === 'left' ? '−' : '+'}{flash.amount}s</span>
            </div>
          )}

          {waiting && !failed && (
            <div className="pl-wait">
              <span>{slow ? 'Slow connection, still loading…' : 'Loading…'}</span>
            </div>
          )}

          {note && (
            <div className="pl-note">
              <span>{note}</span>
            </div>
          )}
        </>
      )}

      <div className="player-top pl-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close player">
          <ChevronLeft size={26} />
        </button>
        <div className="player-title">{title}</div>
        {canPlay && subtitles.length > 0 && (
          <button
            className={`icon-btn player-cc ${selected && subUrl ? 'on' : ''}`}
            onClick={() => {
              setMenu(menu === 'subs' ? null : 'subs');
              poke();
            }}
            aria-label="Subtitles"
            aria-expanded={menu === 'subs'}
          >
            <CcIcon />
          </button>
        )}
      </div>

      {canPlay && (
        <>
          <div className="pl-center">
            <button className="pl-skip" onClick={() => { skip(-SKIP, true); poke(); }} aria-label="Back 10 seconds">
              <SkipIcon back />
            </button>
            <button className="pl-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
            </button>
            <button className="pl-skip" onClick={() => { skip(SKIP, true); poke(); }} aria-label="Forward 10 seconds">
              <SkipIcon />
            </button>
          </div>

          <div className="pl-bottom">
            <div className="pl-timeline">
              <span className="pl-time">{formatClock(shown)}</span>
              <div
                className="pl-seek"
                ref={seekRef}
                onPointerDown={onSeekDown}
                onPointerMove={onSeekMove}
                onPointerUp={onSeekUp}
                onPointerCancel={() => setScrub(null)}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(shown)}
              >
                <div className="pl-track">
                  <span className="pl-buf" style={{ width: `${bufferedPercent}%` }} />
                  <span className="pl-fill" style={{ width: `${percent}%` }} />
                </div>
                <span
                  className={`pl-thumb ${scrub !== null ? 'drag' : ''}`}
                  style={{ left: `${percent}%` }}
                />
              </div>
              <span className="pl-time">{duration ? formatClock(duration) : '--:--'}</span>
            </div>

            <div className="pl-actions">
              <button
                className="pl-act"
                onClick={() => {
                  setLocked(true);
                  setVisible(false);
                  setMenu(null);
                  showNote('Screen locked');
                }}
                aria-label="Lock controls"
              >
                <Lock size={21} />
                <span>Lock</span>
              </button>
              <button
                className="pl-act"
                onClick={() => {
                  setMenu(menu === 'speed' ? null : 'speed');
                  poke();
                }}
                aria-label="Playback speed"
              >
                <Gauge size={22} />
                <span>{rate === 1 ? 'Speed' : `${rate}×`}</span>
              </button>
              <button className="pl-act" onClick={toggleFill} aria-label="Fit or fill the screen">
                {fill ? <Shrink size={21} /> : <Expand size={21} />}
                <span>{fill ? 'Fit' : 'Fill'}</span>
              </button>
              <button className="pl-act" onClick={rotate} aria-label="Rotate the screen">
                <RotateScreenIcon />
                <span>Rotate</span>
              </button>
            </div>
          </div>

          {locked && (
            <button
              className={`pl-unlock ${visible ? 'show' : ''}`}
              onClick={() => {
                setLocked(false);
                poke();
              }}
              aria-label="Unlock controls"
            >
              <Lock size={20} />
              <span>Tap to unlock</span>
            </button>
          )}
        </>
      )}

      {loading && (
        <div className="player-error">
          <div className="skeleton" style={{ width: '60%', height: 12 }} />
          <p>Preparing video…</p>
        </div>
      )}

      {!loading && (failed || !current) && (
        <div className="player-error">
          <WifiOff size={36} />
          <p>This film can't be played right now.</p>
          {reason && <p style={{ fontSize: 13, opacity: 0.7 }}>{reason}</p>}
          {current && (
            <button className="btn-primary" onClick={retry}>
              Try again
            </button>
          )}
          {fallbackHref && (
            <a
              className="btn-secondary"
              href={fallbackHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on Archive.org <ExternalLink size={16} />
            </a>
          )}
        </div>
      )}

      {menu === 'subs' && (
        <div className="subs-backdrop" onClick={() => setMenu(null)}>
          <div className="subs-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="subs-head">Subtitles</div>
            <button className="subs-item" role="menuitem" onClick={() => pickSubtitle('off')}>
              <span>Off</span>
              {!selected && <Check size={18} />}
            </button>
            {subtitles.map((s) => (
              <button
                key={`${s.label}|${s.url || ''}`}
                className="subs-item"
                role="menuitem"
                onClick={() => pickSubtitle(s.label)}
              >
                <span>{s.label}</span>
                {selected?.label === s.label && <Check size={18} />}
              </button>
            ))}
            {subState === 'loading' && <div className="subs-note">Loading subtitles…</div>}
            {subState === 'error' && (
              <div className="subs-note bad">Couldn't load these subtitles. Try another.</div>
            )}
          </div>
        </div>
      )}

      {menu === 'speed' && (
        <div className="subs-backdrop" onClick={() => setMenu(null)}>
          <div className="subs-menu pl-speed" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="subs-head">Playback speed</div>
            {SPEEDS.map((s) => (
              <button key={s} className="subs-item" role="menuitem" onClick={() => pickSpeed(s)}>
                <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                {rate === s && <Check size={18} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
          }
