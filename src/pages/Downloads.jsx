import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  Film,
  HardDrive,
  MoreVertical,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useDownloads, {
  clearDownloads,
  getPlayableUrl,
  getStorageInfo,
  pauseDownload,
  removeCompleted,
  removeDownload,
  resumeDownload,
} from '../services/downloadManager.js';
import useNetwork, { setWifiOnly } from '../services/network.js';
import { archivePage, archiveThumb, formatDuration } from '../services/archive.js';
import { formatBytes } from '../utils/format.js';
import '../styles/library.css';
import '../styles/downloads.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const percent = (rec) => (rec.size ? Math.min(100, Math.round((rec.bytes / rec.size) * 100)) : 0);

const formatSpeed = (bytesPerSecond) => `${formatBytes(bytesPerSecond)}/s`;

function formatLeft(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s left`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min left`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} h ${minutes} min left`;
}

// the line under a download that is not finished
function progressLine(d, pct) {
  if (d.status === 'error') return { text: d.error, bad: true };
  if (d.waitingWifi) return { text: 'Waiting for Wi-Fi', wifi: true };
  const amount = `${pct}% · ${formatBytes(d.bytes)}${d.size ? ` of ${formatBytes(d.size)}` : ''}`;
  if (d.status === 'paused') return { text: `Paused · ${amount}` };
  return { text: amount };
}

function speedLine(d) {
  if (d.status !== 'downloading') return '';
  if (!d.speed) return 'Connecting…';
  const left = d.size ? formatLeft((d.size - d.bytes) / d.speed) : '';
  return left ? `${formatSpeed(d.speed)} · ${left}` : formatSpeed(d.speed);
}

/* How much room downloads take and roughly how much is left. The free space is
   an estimate that the phone gives to apps. */
function useStorage(refreshKey) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let off = false;
    getStorageInfo().then((result) => {
      if (!off) setInfo(result);
    });
    return () => {
      off = true;
    };
  }, [refreshKey]);
  return info;
}

function StorageCard({ totalBytes, storage, active, speed, network }) {
  const free = storage ? Math.max(0, storage.quota - storage.used) : 0;
  const fill = storage && storage.quota ? Math.min(100, (storage.used / storage.quota) * 100) : 0;
  const onMobile = network.connection === 'cellular';

  return (
    <section className="dl-card" aria-label="Storage and download settings">
      <div className="dl-storage">
        <span className="dl-ico">
          <HardDrive size={20} />
        </span>
        <div className="dl-storage-text">
          <b>{formatBytes(totalBytes)} of downloads</b>
          <span>{storage ? `About ${formatBytes(free)} free on this device` : 'Saved on this device'}</span>
        </div>
      </div>
      {storage && (
        <div className="dl-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(fill, totalBytes ? 2 : 0)}%` }} />
        </div>
      )}

      {active > 0 && (
        <div className="dl-live">
          <Zap size={15} />
          <span>
            {speed > 0
              ? `Downloading at ${formatSpeed(speed)}`
              : active === 1
                ? 'Connecting…'
                : 'Connecting…'}
            {active > 1 ? ` · ${active} active` : ''}
          </span>
        </div>
      )}

      <button
        type="button"
        className="dl-wifi"
        role="switch"
        aria-checked={network.wifiOnly}
        onClick={() => setWifiOnly(!network.wifiOnly)}
      >
        <Wifi size={20} />
        <span className="dl-wifi-text">
          <b>Download on Wi-Fi only</b>
          <span>
            {network.wifiOnly && onMobile
              ? "You're on mobile data, so downloads are waiting"
              : 'Saves your mobile data'}
          </span>
        </span>
        <span className={`switch ${network.wifiOnly ? 'on' : ''}`} />
      </button>
    </section>
  );
}

function StorageSkeleton() {
  return (
    <div className="dl-card dl-card-sk" aria-hidden="true">
      <div className="dl-storage">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 13 }} />
        <div className="dl-storage-text">
          <div className="skeleton" style={{ height: 16, width: '55%' }} />
          <div className="skeleton" style={{ height: 12, width: '75%', marginTop: 6 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 8, borderRadius: 99, marginTop: 14 }} />
      <div className="skeleton" style={{ height: 44, marginTop: 14, borderRadius: 14 }} />
    </div>
  );
}

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
  const network = useNetwork();
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
  const running = useMemo(() => items.filter((d) => d.status === 'downloading'), [items]);
  const totalSpeed = useMemo(() => running.reduce((sum, d) => sum + (d.speed || 0), 0), [running]);
  const doneCount = useMemo(() => items.filter((d) => d.status === 'completed').length, [items]);
  const pausedCount = useMemo(
    () => items.filter((d) => d.status === 'paused' || d.status === 'error').length,
    [items]
  );
  const storage = useStorage(Math.round(totalBytes / (16 * 1024 * 1024)));

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
        <StorageSkeleton />
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
          <StorageCard
            totalBytes={totalBytes}
            storage={storage}
            active={running.length}
            speed={totalSpeed}
            network={network}
          />
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
                        {(() => {
                          const line = progressLine(d, pct);
                          return (
                            <span className="lib-meta">
                              {line.bad ? (
                                <span style={{ color: 'var(--danger)' }}>{line.text}</span>
                              ) : line.wifi ? (
                                <span className="dl-waiting">
                                  <Wifi size={13} /> {line.text}
                                </span>
                              ) : (
                                <span>{line.text}</span>
                              )}
                            </span>
                          );
                        })()}
                        {d.status === 'downloading' && (
                          <span className="lib-meta dl-speed">{speedLine(d)}</span>
                        )}
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
                      onClick={() => resumeDownload(d.id, true)}
                      aria-label={
                        d.waitingWifi
                          ? 'Download now on mobile data'
                          : d.status === 'error'
                            ? 'Try again'
                            : 'Resume download'
                      }
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
                role="switch"
                aria-checked={network.wifiOnly}
                onClick={() => setWifiOnly(!network.wifiOnly)}
              >
                <Wifi size={20} /> Download on Wi-Fi only
                <span className={`switch dl-menu-switch ${network.wifiOnly ? 'on' : ''}`} />
              </button>
              {running.length > 0 && (
                <button
                  onClick={() => {
                    running.forEach((d) => pauseDownload(d.id));
                    setMenuOpen(false);
                  }}
                >
                  <Pause size={20} /> Pause all
                </button>
              )}
              {pausedCount > 0 && (
                <button
                  onClick={() => {
                    items
                      .filter((d) => d.status === 'paused' || d.status === 'error')
                      .forEach((d) => resumeDownload(d.id, true));
                    setMenuOpen(false);
                  }}
                >
                  <RotateCw size={20} /> Resume all
                </button>
              )}
              <div className="sep" />
              {doneCount > 0 && (
                <button
                  className="danger-text"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm({ type: 'done' });
                  }}
                >
                  <CheckCheck size={20} /> Remove finished films
                </button>
              )}
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
                    resumeDownload(menuItem.id, true);
                    setItemMenu(null);
                  }}
                >
                  <RotateCw size={20} />
                  {menuItem.waitingWifi
                    ? 'Download now on mobile data'
                    : menuItem.status === 'error'
                      ? 'Try again'
                      : 'Resume'}
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
            <h3>
              {confirm.type === 'all'
                ? 'Clear all downloads?'
                : confirm.type === 'done'
                  ? 'Remove finished films?'
                  : `Remove "${confirm.item.title}"?`}
            </h3>
            <p>
              {confirm.type === 'all'
                ? 'This deletes every downloaded film from this device.'
                : confirm.type === 'done'
                  ? `This deletes ${doneCount} finished ${doneCount === 1 ? 'film' : 'films'} from this device. Films still downloading are kept.`
                  : 'This deletes the downloaded file from this device.'}
            </p>
            <div className="sheet-actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm.type === 'all') clearDownloads();
                  else if (confirm.type === 'done') removeCompleted();
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
