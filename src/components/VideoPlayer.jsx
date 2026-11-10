import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ExternalLink, WifiOff } from 'lucide-react';

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
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

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
      ) : failed || !src ? (
        <div className="player-error">
          <WifiOff size={36} />
          <p>This film can't be played right now.</p>
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
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => onProgress?.(0)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
        }
