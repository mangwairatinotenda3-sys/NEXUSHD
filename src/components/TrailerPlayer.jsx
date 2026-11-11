import { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { formatClock } from '../services/archive.js';
import '../styles/trailer.css';

let apiPromise = null;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previous) previous();
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => {
        apiPromise = null;
        reject(new Error('YouTube is not reachable'));
      };
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

export default function TrailerPlayer({ videoId, title, onClose }) {
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const playerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState('loading');
  const [started, setStarted] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [intro, setIntro] = useState(false);
  const [poster, setPoster] = useState(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });

  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  // Create the player
  useEffect(() => {
    let cancelled = false;
    setStarted(false);
    setStalled(false);
    setStatus('loading');
    setPoster(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setReady(true);
              e.target.playVideo();
            },
            onStateChange: (e) => {
              if (cancelled) return;
              if (e.data === 1) {
                setStatus('playing');
                setStarted(true);
              } else if (e.data === 2) setStatus('paused');
              else if (e.data === 0) setStatus('ended');
              else if (e.data === 3) setStatus('buffering');
            },
            onError: () => !cancelled && setError(true),
          },
        });
      })
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  // If the phone blocks autoplay, show our play button after a short wait
  useEffect(() => {
    if (!ready || started) return undefined;
    const timer = setTimeout(() => setStalled(true), 3000);
    return () => clearTimeout(timer);
  }, [ready, started]);

  // Hide the top strip for a few seconds each time playback starts,
  // so YouTube's title bar never flashes over the video
  useEffect(() => {
    if (status !== 'playing') return undefined;
    setIntro(true);
    const timer = setTimeout(() => setIntro(false), 3500);
    return () => clearTimeout(timer);
  }, [status]);

  // Progress
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setInterval(() => {
      const p = playerRef.current;
      if (!p || seeking) return;
      try {
        setTime({ current: p.getCurrentTime() || 0, duration: p.getDuration() || 0 });
      } catch {
        /* player not ready */
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready, seeking]);

  // Close with Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fullscreen state
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const isPlaying = status === 'playing' || status === 'buffering';
  const covered = !started || status === 'paused' || status === 'ended';
  const showSpinner = !started && !stalled && !error;
  const showBigButton = covered && (started || stalled);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (status === 'ended') {
      p.seekTo(0, true);
      p.playVideo();
    } else if (isPlaying) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const commitSeek = () => {
    playerRef.current?.seekTo(time.current, true);
    setSeeking(false);
  };

  const onPosterLoad = (e) => {
    // maxresdefault returns a tiny placeholder when it does not exist
    if (e.currentTarget.naturalWidth <= 200) {
      setPoster(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    }
  };

  const pct = time.duration ? Math.min(100, (time.current / time.duration) * 100) : 0;

  return (
    <div
      ref={rootRef}
      className="trailer-modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="trailer-title">{title} · Trailer</div>
      <button className="icon-btn trailer-close" onClick={onClose} aria-label="Close trailer">
        <X size={24} />
      </button>

      <div className="trailer-frame">
        {!ready && !error && <div className="skeleton trailer-sk" />}
        <div className={`yt-wrap ${ready && !error ? 'ready' : ''}`}>
          <div ref={hostRef} />
        </div>

        {!error && (
          <button
            type="button"
            className={`trailer-cover ${covered ? 'covered' : ''}`}
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause trailer' : 'Play trailer'}
          >
            {covered && (
              <img
                className={`trailer-poster ${started ? 'dim' : ''}`}
                src={poster}
                alt=""
                onLoad={onPosterLoad}
                onError={() =>
                  setPoster(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)
                }
              />
            )}
            {showSpinner && <span className="trailer-spinner" />}
            {showBigButton && (
              <span className="trailer-bigplay">
                {status === 'ended' ? (
                  <RotateCcw size={30} />
                ) : (
                  <Play size={34} fill="currentColor" />
                )}
              </span>
            )}
            {started && status === 'buffering' && <span className="trailer-spinner small" />}
            <span className={`trailer-intro-mask ${intro && !covered ? 'on' : ''}`} />
          </button>
        )}

        {error && (
          <div className="trailer-error">
            <p>This trailer can't play inside the app.</p>
            <a
              className="btn-primary"
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch on YouTube <ExternalLink size={16} />
            </a>
          </div>
        )}
      </div>

      {!error && (
        <div className="trailer-controls">
          <input
            className="trailer-range"
            type="range"
            min="0"
            max={time.duration || 1}
            step="0.1"
            value={time.current}
            style={{ '--pct': `${pct}%` }}
            disabled={!ready}
            aria-label="Seek"
            onChange={(e) => {
              setSeeking(true);
              setTime((t) => ({ ...t, current: Number(e.target.value) }));
            }}
            onPointerUp={commitSeek}
            onTouchEnd={commitSeek}
            onKeyUp={commitSeek}
          />
          <div className="trailer-times">
            <span>{formatClock(time.current)}</span>
            <span>{time.duration ? formatClock(time.duration) : '--:--'}</span>
          </div>

          <div className="trailer-buttons">
            <button
              className="trailer-btn"
              onClick={toggleMute}
              disabled={!ready}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <button
              className="trailer-btn main"
              onClick={togglePlay}
              disabled={!ready}
              aria-label={isPlaying ? 'Pause' : status === 'ended' ? 'Replay' : 'Play'}
            >
              {status === 'ended' ? (
                <RotateCcw size={26} />
              ) : isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" />
              )}
            </button>
            {canFullscreen ? (
              <button
                className="trailer-btn"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {fullscreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
              </button>
            ) : (
              <a
                className="trailer-btn"
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open on YouTube"
              >
                <ExternalLink size={22} />
              </a>
            )}
          </div>
          <div className="trailer-credit">Trailer from YouTube</div>
        </div>
      )}
    </div>
  );
  }
