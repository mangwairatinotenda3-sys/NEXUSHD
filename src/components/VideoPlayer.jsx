import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ExternalLink, WifiOff } from 'lucide-react';
import { alternatesFor } from '../services/archive.js';

const REASONS = {
  1: 'The video was stopped.',
  2: 'The connection dropped while loading the video.',
  3: 'This phone could not decode the video.',
  4: 'The video file is not available or not supported.',
};

export default function VideoPlayer({
  title,
  src,
  loading = false,
  startAt = 0,
  fallbackHref,
  onClose,
  onProgress,
}) {
  const videoRef = useRef(null);
  const lastSave = useRef(0);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [waiting, setWaiting] = useState(true);
  const [slow, setSlow] = useState(false);

  // the first file, then any other versions of the same film
  const sources = src ? [src, ...alternatesFor(src)] : [];
  const current = sources[index] || null;

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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
    <div className="player">
      <div className="player-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close player">
          <ChevronLeft size={26} />
        </button>
        <div className="player-title">{title}</div>
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
          />
          {waiting && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 'calc(var(--safe-bottom, 0px) + 90px)',
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  fontSize: 13,
                }}
              >
                {slow ? 'Slow connection, still loading…' : 'Loading…'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
