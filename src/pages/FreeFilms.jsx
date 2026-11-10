import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Film, Info, Play, WifiOff } from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import {
  FREE_FILMS,
  archivePage,
  archiveThumb,
  formatClock,
  formatDuration,
  loadFilm,
} from '../services/archive.js';
import { formatBytes } from '../utils/format.js';
import '../styles/free.css';

function Thumb({ id, alt }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={archiveThumb(id)}
      alt={alt}
      loading="lazy"
      className={loaded ? 'loaded' : ''}
      onLoad={() => setLoaded(true)}
    />
  );
}

function Player({ film, startAt, onClose, onProgress }) {
  const videoRef = useRef(null);
  const lastSave = useRef(0);
  const [error, setError] = useState(!film.src);

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
      onProgress(film.id, now);
    }
  };

  return (
    <div className="player">
      <div className="player-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close player">
          <span style={{ fontSize: 26, lineHeight: 1 }}>‹</span>
        </button>
        <div className="player-title">{film.title}</div>
      </div>

      {error ? (
        <div className="player-error">
          <WifiOff size={36} />
          <p>This film can't be played right now.</p>
          <a
            className="btn-secondary"
            href={archivePage(film.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on Archive.org <ExternalLink size={16} />
          </a>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={film.src}
          controls
          autoPlay
          playsInline
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => onProgress(film.id, 0)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

export default function FreeFilms() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useLocalStorage('nexushd:free-progress', {});

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(FREE_FILMS.map(loadFilm)).then((results) => {
      if (cancelled) return;
      setFilms(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const saveProgress = useCallback(
    (id, seconds) => setProgress((prev) => ({ ...prev, [id]: seconds })),
    [setProgress]
  );

  const open = (film) => {
    setExpanded(false);
    setSelected(film);
  };

  const play = (film) => {
    setPlaying(film);
    setSelected(null);
  };

  const resumeAt = selected ? progress[selected.id] || 0 : 0;
  const longText = (selected?.description || '').length > 200;

  return (
    <div className="page">
      <Header title="Free Films" back />

      <div className="free-note">
        <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Classic films hosted by the Internet Archive and listed as public domain. Copyright rules
          differ between countries.
        </span>
      </div>

      {loading ? (
        <div className="free-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="skeleton free-thumb-sk" />
              <div className="skeleton" style={{ height: 14, width: '75%', marginTop: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : films.length === 0 ? (
        <EmptyState
          icon={WifiOff}
          title="Couldn't load free films"
          text="Check your connection and try again."
          actionLabel="Try again"
          onAction={load}
        />
      ) : (
        <div className="free-grid">
          {films.map((f, i) => (
            <button
              key={f.id}
              className="free-card"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => open(f)}
            >
              <div className="free-thumb">
                <Thumb id={f.id} alt={f.title} />
                <span className="free-badge">FREE</span>
              </div>
              <div className="free-title">{f.title}</div>
              <div className="free-sub">
                {f.year}
                {f.seconds ? ` · ${formatDuration(f.seconds)}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet film-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="film-head">
              <div className="film-poster">
                <Thumb id={selected.id} alt={selected.title} />
              </div>
              <div className="film-info">
                <h3>{selected.title}</h3>
                <div className="free-sub">
                  {selected.year}
                  {selected.seconds ? ` · ${formatDuration(selected.seconds)}` : ''}
                </div>
                {selected.creator && <div className="free-sub">{selected.creator}</div>}
                {selected.sizeBytes > 0 && (
                  <div className="free-sub">Standard quality · {formatBytes(selected.sizeBytes)}</div>
                )}
              </div>
            </div>

            {selected.description && (
              <>
                <p className={`film-desc ${longText && !expanded ? 'clamp' : ''}`}>
                  {selected.description}
                </p>
                {longText && (
                  <button className="d-more" onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            )}

            <div className="film-actions">
              <button className="btn-primary" onClick={() => play(selected)}>
                <Play size={18} fill="currentColor" />
                {resumeAt > 10 ? `Resume from ${formatClock(resumeAt)}` : 'Play'}
              </button>
              {resumeAt > 10 && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    saveProgress(selected.id, 0);
                    play(selected);
                  }}
                >
                  Start from the beginning
                </button>
              )}
              <a
                className="btn-secondary"
                href={archivePage(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Archive.org <ExternalLink size={16} />
              </a>
            </div>

            <p className="film-rights">
              Rights: {selected.rights}. Make sure this film is free to watch where you live.
            </p>
          </div>
        </div>
      )}

      {playing && (
        <Player
          film={playing}
          startAt={progress[playing.id] || 0}
          onClose={() => setPlaying(null)}
          onProgress={saveProgress}
        />
      )}
    </div>
  );
    }
