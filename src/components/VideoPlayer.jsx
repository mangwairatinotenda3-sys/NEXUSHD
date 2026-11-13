import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ExternalLink, WifiOff } from 'lucide-react';
import { alternatesFor } from '../services/archive.js';
import { fetchSubtitleVtt, toVtt } from '../services/subtitles.js';
import '../styles/player.css';

const REASONS = {
  1: 'The video was stopped.',
  2: 'The connection dropped while loading the video.',
  3: 'This phone could not decode the video.',
  4: 'The video file is not available or not supported.',
};

const PREF_KEY = 'nexushd:subs-pref';

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
  const lastSave = useRef(0);
  const subsRef = useRef(subtitles);
  subsRef.current = subtitles;

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [waiting, setWaiting] = useState(true);
  const [slow, setSlow] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
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

  // tell the viewer when the connection is slow
  useEffect(() => {
    if (!waiting || failed || !current) return undefined;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [waiting, failed, current]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, menuOpen]);

  const pick = (label) => {
    setChoice(label);
    savePref(label);
    setMenuOpen(false);
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (v && startAt > 10 && startAt < v.duration - 30) v.currentTime = startAt;
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
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

  return (
    <div className="player">
      <div className="player-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close player">
          <ChevronLeft size={26} />
        </button>
        <div className="player-title">{title}</div>
        {canPlay && subtitles.length > 0 && (
          <button
            className={`icon-btn player-cc ${selected && subUrl ? 'on' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Subtitles"
            aria-expanded={menuOpen}
          >
            <CcIcon />
          </button>
        )}
      </div>

      {loading ? (
        <div className="player-error">
          <div className="skeleton" style={{ width: '60%', height: 12 }} />
          <p>Preparing video…</p>
        </div>
      ) : failed || !current ? (
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
      ) : (
        <>
          <video
            key={current}
            ref={videoRef}
            src={current}
            controls
            autoPlay
            playsInline
            preload="auto"
            onLoadedMetadata={onLoadedMetadata}
            onCanPlay={() => {
              setWaiting(false);
              setSlow(false);
            }}
            onPlaying={() => setWaiting(false)}
            onWaiting={() => setWaiting(true)}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => onProgress?.(0)}
            onError={onError}
          >
            {subUrl && selected && (
              <track key={subUrl} kind="subtitles" src={subUrl} label={selected.label} srcLang="en" default />
            )}
          </video>
          {waiting && (
            <div className="player-wait">
              <span>{slow ? 'Slow connection, still loading…' : 'Loading…'}</span>
            </div>
          )}
        </>
      )}

      {menuOpen && (
        <div className="subs-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="subs-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="subs-head">Subtitles</div>
            <button className="subs-item" role="menuitem" onClick={() => pick('off')}>
              <span>Off</span>
              {!selected && <Check size={18} />}
            </button>
            {subtitles.map((s) => (
              <button
                key={`${s.label}|${s.url || ''}`}
                className="subs-item"
                role="menuitem"
                onClick={() => pick(s.label)}
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
    </div>
  );
        }
