import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Download,
  ExternalLink,
  Film,
  MoreVertical,
  Pause,
  Play,
  RotateCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useDownloads, {
  clearDownloads,
  getPlayableUrl,
  pauseDownload,
  removeDownload,
  resumeDownload,
} from '../services/downloadManager.js';
import { archivePage, archiveThumb, formatDuration } from '../services/archive.js';
import { formatBytes } from '../utils/format.js';
import '../styles/library.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const percent = (rec) => (rec.size ? Math.min(100, Math.round((rec.bytes / rec.size) * 100)) : 0);

function Thumb({ id }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={archiveThumb(id)}
      alt=""
      loading="lazy"
      className={loaded ? 'loaded' : ''}
      onLoad={() => setLoaded(true)}
    />
  );
}

export default function Downloads() {
  const navigate = useNavigate();
  const { items, loading, supported } = useDownloads();
  const [filter, setFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [player, setPlayer] = useState(null);
  const [progress, setProgress] = useLocalStorage('nexushd:free-progress', {});

  const visible = useMemo(
    () => items.filter((d) => filter === 'all' || (d.media_type || 'movie') === filter),
    [items, filter]
  );
  const totalBytes = useMemo(() => items.reduce((sum, d) => sum + (d.bytes || 0), 0), [items]);

  // Keep the open menu in step with the latest download state
  const menuItem = itemMenu ? items.find((d) => d.id === itemMenu.id) || null : null;
  useEffect(() => {
    if (itemMenu && !menuItem) setItemMenu(null);
  }, [itemMenu, menuItem]);

  const play = async (rec) => {
    setItemMenu(null);
    setPlayer({ rec, src: null, loading: true });
    try {
      const url = await getPlayableUrl(rec.id);
      setPlayer({ rec, src: url, loading: false });
    } catch {
      setPlayer({ rec, src: null, loading: false });
    }
  };

  const closePlayer = () => {
    if (player?.src) URL.revokeObjectURL(player.src);
    setPlayer(null);
  };

  const saveProgress = useCallback(
    (id, seconds) => setProgress((prev) => ({ ...prev, [id]: seconds })),
    [setProgress]
  );

  const menuButton = (
    <button
      className="icon-btn"
      onClick={() => setMenuOpen(true)}
      disabled={loading || items.length === 0}
      aria-label="Downloads options"
    >
      <MoreVertical size={24} />
    </button>
  );

  const chips = (
    <div className="lib-chips" role="tablist">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={filter === f.id}
          className={`lib-chip ${filter === f.id ? 'on' : ''}`}
          onClick={() => setFilter(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <Header title="Downloads" right={menuButton} />
        {chips}
        <div className="lib-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lib-card lib-sk-card">
              <div className="skeleton lib-thumb-sk" />
              <div className="lib-info">
                <div className="skeleton" style={{ height: 18, width: '65%' }} />
                <div className="skeleton" style={{ height: 13, width: '45%', marginTop: 4 }} />
                <div className="skeleton" style={{ height: 13, width: '30%', marginTop: 4 }} />
              </div>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%', margin: 'auto 14px auto 0' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Downloads" right={menuButton} />
      {chips}

      {!supported ? (
        <EmptyState
          icon={WifiOff}
          title="Downloads aren't available here"
          text="This browser can't save films for offline use. Try Chrome, or use the Android app."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No Downloads Yet"
          text="Download free films and watch them offline."
          actionLabel="Browse Free Films"
          onAction={() => navigate('/free')}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Film}
          title={filter === 'tv' ? 'No series downloaded' : 'No movies downloaded'}
          text="Downloads of this type will show up here."
        />
      ) : (
        <>
          <div className="lib-count">
            {items.length} {items.length === 1 ? 'download' : 'downloads'} · {formatBytes(totalBytes)}
          </div>
          <div className="lib-list">
            {visible.map((d, i) => {
              const pct = percent(d);
              const done = d.status === 'completed';
              return (
                <article
                  className="lib-card"
                  key={d.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <button
                    className="lib-thumb"
                    onClick={() => (done ? play(d) : setItemMenu(d))}
                    aria-label={done ? `Play ${d.title}` : `Options for ${d.title}`}
                  >
                    <Thumb id={d.id} />
                  </button>

                  <button className="lib-info" onClick={() => (done ? play(d) : setItemMenu(d))}>
                    <span className="lib-title">{d.title}</span>
                    {done ? (
                      <>
                        <span className="lib-meta">
                          <span>{formatBytes(d.size)}</span>
                          <span className="lib-status" style={{ gap: 6 }}>
                            <span className="check">
                              <Check size={11} strokeWidth={3} />
                            </span>
                            Completed
                          </span>
                        </span>
                        {d.seconds > 0 && (
                          <span className="lib-meta">{formatDuration(d.seconds)}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="lib-meta">
                          {d.status === 'error' ? (
                            <span style={{ color: 'var(--danger)' }}>{d.error}</span>
                          ) : (
                            <span>
                              {d.status === 'paused' ? 'Paused · ' : ''}
                              {pct}% · {formatBytes(d.bytes)}
                              {d.size ? ` of ${formatBytes(d.size)}` : ''}
                            </span>
                          )}
                        </span>
                        <span className="progress" style={{ display: 'block', width: '100%' }}>
                          <span style={{ display: 'block', width: `${pct}%` }} />
                        </span>
                      </>
                    )}
                  </button>

                  {done ? (
                    <button className="lib-play" onClick={() => play(d)} aria-label={`Play ${d.title}`}>
                      <Play size={20} fill="currentColor" />
                    </button>
                  ) : d.status === 'downloading' ? (
                    <button className="lib-play" onClick={() => pauseDownload(d.id)} aria-label="Pause download">
                      <Pause size={20} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      className="lib-play"
                      onClick={() => resumeDownload(d.id)}
                      aria-label={d.status === 'error' ? 'Try again' : 'Resume download'}
                    >
                      <RotateCw size={20} />
                    </button>
                  )}

                  <button
                    className="icon-btn lib-more"
                    onClick={() => setItemMenu(d)}
                    aria-label={`Options for ${d.title}`}
                  >
                    <MoreVertical size={22} />
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Downloads</h3>
            <div className="sheet-list">
              <button
                className="danger-text"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm({ type: 'all' });
                }}
              >
                <Trash2 size={20} /> Clear all downloads
              </button>
            </div>
          </div>
        </div>
      )}

      {menuItem && (
        <div className="sheet-backdrop" onClick={() => setItemMenu(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{menuItem.title}</h3>
            <div className="sheet-list">
              {menuItem.status === 'completed' && (
                <button onClick={() => play(menuItem)}>
                  <Play size={20} /> Play
                </button>
              )}
              {menuItem.status === 'downloading' && (
                <button
                  onClick={() => {
                    pauseDownload(menuItem.id);
                    setItemMenu(null);
                  }}
                >
                  <Pause size={20} /> Pause
                </button>
              )}
              {(menuItem.status === 'paused' || menuItem.status === 'error') && (
                <button
                  onClick={() => {
                    resumeDownload(menuItem.id);
                    setItemMenu(null);
                  }}
                >
                  <RotateCw size={20} /> {menuItem.status === 'error' ? 'Try again' : 'Resume'}
                </button>
              )}
              <a
                className="sheet-link"
                href={archivePage(menuItem.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setItemMenu(null)}
              >
                <ExternalLink size={20} /> View on Archive.org
              </a>
              <div className="sep" />
              <button
                className="danger-text"
                onClick={() => {
                  setConfirm({ type: 'one', item: menuItem });
                  setItemMenu(null);
                }}
              >
                <Trash2 size={20} />
                {menuItem.status === 'completed' ? 'Remove download' : 'Cancel download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.type === 'all' ? 'Clear all downloads?' : `Remove "${confirm.item.title}"?`}</h3>
            <p>
              {confirm.type === 'all'
                ? 'This deletes every downloaded film from this device.'
                : 'This deletes the downloaded file from this device.'}
            </p>
            <div className="sheet-actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm.type === 'all') clearDownloads();
                  else removeDownload(confirm.item.id);
                  setConfirm(null);
                }}
              >
                {confirm.type === 'all' ? 'Clear all' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {player && (
        <VideoPlayer
          title={player.rec.title}
          src={player.src}
          loading={player.loading}
          startAt={progress[player.rec.id] || 0}
          fallbackHref={archivePage(player.rec.id)}
          onClose={closePlayer}
          onProgress={(s) => saveProgress(player.rec.id, s)}
        />
      )}
    </div>
  );
    }
