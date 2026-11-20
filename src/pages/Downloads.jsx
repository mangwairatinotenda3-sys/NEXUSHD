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

/* What a download that is not finished is doing, in words and in colour */
function stateOf(d) {
  if (d.status === 'downloading') return { id: 'live', label: 'Downloading' };
  if (d.status === 'error') return { id: 'error', label: 'Failed' };
  if (d.waitingWifi) return { id: 'wifi', label: 'Waiting for Wi-Fi' };
  return { id: 'paused', label: 'Paused' };
}

/* The one button on a card: it always says what tapping it does */
function actionOf(d) {
  if (d.status === 'downloading') return { id: 'pause', label: 'Pause', Icon: Pause, fill: true };
  if (d.status === 'error') return { id: 'retry', label: 'Retry', Icon: RotateCw };
  if (d.waitingWifi) return { id: 'data', label: 'Use mobile data', Icon: Zap };
  return { id: 'resume', label: 'Resume', Icon: Play, fill: true };
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

function Hero({ totalBytes, count, storage, active, speed }) {
  const free = storage ? Math.max(0, storage.quota - storage.used) : 0;
  const fill = storage && storage.quota ? Math.min(100, (storage.used / storage.quota) * 100) : 0;

  return (
    <section className="dl-hero" aria-label="Storage">
      <div className="dl-hero-top">
        <span className="dl-hero-ico">
          <HardDrive size={22} />
        </span>
        <div className="dl-hero-text">
          <b>{formatBytes(totalBytes)}</b>
          <span>
            {count} {count === 1 ? 'film' : 'films'} on this device
          </span>
        </div>
      </div>
      {storage && (
        <>
          <div className="dl-hero-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(fill, totalBytes ? 2 : 0)}%` }} />
          </div>
          <div className="dl-hero-free">About {formatBytes(free)} free</div>
        </>
      )}
      {active > 0 && (
        <div className="dl-live">
          <Zap size={15} />
          <span>
            {speed > 0 ? `Downloading at ${formatSpeed(speed)}` : 'Connecting…'}
            {active > 1 ? ` · ${active} active` : ''}
          </span>
        </div>
      )}
    </section>
  );
}

function WifiRow({ network }) {
  const onMobile = network.connection === 'cellular';
  return (
    <button
      type="button"
      className="dl-wifi-row"
      role="switch"
      aria-checked={network.wifiOnly}
      onClick={() => setWifiOnly(!network.wifiOnly)}
    >
      <span className="dl-wifi-ico">
        <Wifi size={20} />
      </span>
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
  );
}

function DownloadsSkeleton() {
  return (
    <>
      <div className="dl-hero dl-hero-sk" aria-hidden="true">
        <div className="dl-hero-top">
          <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 15 }} />
          <div className="dl-hero-text">
            <div className="skeleton" style={{ height: 22, width: '45%' }} />
            <div className="skeleton" style={{ height: 13, width: '65%', marginTop: 8 }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: 8, borderRadius: 99, marginTop: 18 }} />
      </div>
      <div className="skeleton" style={{ height: 66, borderRadius: 20, margin: '0 16px 16px' }} />
      <div className="lib-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="lib-card lib-sk-card">
            <div className="skeleton lib-thumb-sk" />
            <div className="lib-info">
              <div className="skeleton" style={{ height: 18, width: '65%' }} />
              <div className="skeleton" style={{ height: 13, width: '45%', marginTop: 4 }} />
              <div className="skeleton" style={{ height: 8, width: '90%', marginTop: 8, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </>
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
  const unfinished = useMemo(() => visible.filter((d) => d.status !== 'completed'), [visible]);
  const finished = useMemo(() => visible.filter((d) => d.status === 'completed'), [visible]);
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

  const runAction = (d) => {
    if (d.status === 'downloading') pauseDownload(d.id);
    else resumeDownload(d.id, true);
  };

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

  const filterBar = (
    <div className="lib-bar dl-filter">
      <div className="lib-seg" role="tablist" aria-label="Type">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'on' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <Header title="Downloads" right={menuButton} />
        <DownloadsSkeleton />
      </div>
    );
  }

  const activeCard = (d, i) => {
    const pct = percent(d);
    const state = stateOf(d);
    const action = actionOf(d);
    const ActionIcon = action.Icon;
    return (
      <article
        className="lib-card dl-item"
        key={d.id}
        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
      >
        <button className="lib-thumb" onClick={() => setItemMenu(d)} aria-label={`Options for ${d.title}`}>
          <Thumb id={d.id} />
        </button>
        <div className="dl-body">
          <div className="dl-top">
            <button className="dl-title" onClick={() => setItemMenu(d)}>
              {d.title}
            </button>
            <button
              className="icon-btn dl-more"
              onClick={() => setItemMenu(d)}
              aria-label={`Options for ${d.title}`}
            >
              <MoreVertical size={20} />
            </button>
          </div>

          <div className="dl-status">
            <span className={`dl-pill ${state.id}`}>
              {state.id === 'wifi' && <Wifi size={12} />}
              {state.label}
            </span>
            <span className="dl-amount">
              {pct}%{d.size ? ` · ${formatBytes(d.bytes)} of ${formatBytes(d.size)}` : ''}
            </span>
          </div>

          <div className={`dl-progress ${state.id}`} aria-hidden="true">
            <span style={{ width: `${Math.max(pct, d.status === 'downloading' ? 2 : 0)}%` }} />
          </div>

          {d.status === 'error' && d.error && <div className="dl-error">{d.error}</div>}

          <div className="dl-foot">
            <span className="dl-speed">{speedLine(d)}</span>
            <button className={`dl-action ${action.id}`} onClick={() => runAction(d)}>
              <ActionIcon size={16} fill={action.fill ? 'currentColor' : 'none'} />
              {action.label}
            </button>
          </div>
        </div>
      </article>
    );
  };

  const doneCard = (d, i) => (
    <article
      className="lib-card"
      key={d.id}
      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
    >
      <button className="lib-thumb" onClick={() => play(d)} aria-label={`Play ${d.title}`}>
        <Thumb id={d.id} />
      </button>

      <button className="lib-info" onClick={() => play(d)}>
        <span className="lib-title">{d.title}</span>
        <span className="lib-meta">
          <span>{formatBytes(d.size)}</span>
          {d.seconds > 0 && <span>{formatDuration(d.seconds)}</span>}
        </span>
        <span className="lib-status" style={{ gap: 6 }}>
          <span className="check">
            <Check size={11} strokeWidth={3} />
          </span>
          Ready to watch offline
        </span>
      </button>

      <button className="lib-play" onClick={() => play(d)} aria-label={`Play ${d.title}`}>
        <Play size={20} fill="currentColor" />
      </button>
      <button
        className="icon-btn lib-more"
        onClick={() => setItemMenu(d)}
        aria-label={`Options for ${d.title}`}
      >
        <MoreVertical size={22} />
      </button>
    </article>
  );

   return (
    <div className="page">
      <Header title="Downloads" right={menuButton} />

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
      ) : (
        <>
          <Hero
            totalBytes={totalBytes}
            count={items.length}
            storage={storage}
            active={running.length}
            speed={totalSpeed}
          />
          <WifiRow network={network} />
          {filterBar}

          {visible.length === 0 ? (
            <EmptyState
              icon={Film}
              title={filter === 'tv' ? 'No series downloaded' : 'No movies downloaded'}
              text="Downloads of this type will show up here."
            />
          ) : (
            <>
              {unfinished.length > 0 && (
                <section className="dl-section">
                  <h2 className="dl-section-title">
                    Downloading <span>{unfinished.length}</span>
                  </h2>
                  <div className="lib-list">{unfinished.map(activeCard)}</div>
                </section>
              )}
              {finished.length > 0 && (
                <section className="dl-section">
                  <h2 className="dl-section-title">
                    Ready to watch <span>{finished.length}</span>
                  </h2>
                  <div className="lib-list">{finished.map(doneCard)}</div>
                </section>
              )}
            </>
          )}
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
                  <Play size={20} /> Resume all
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
              {menuItem.status !== 'completed' && (
                <button
                  onClick={() => {
                    runAction(menuItem);
                    setItemMenu(null);
                  }}
                >
                  {(() => {
                    const action = actionOf(menuItem);
                    const ActionIcon = action.Icon;
                    return (
                      <>
                        <ActionIcon size={20} /> {action.id === 'data' ? 'Download now on mobile data' : action.label}
                      </>
                    );
                  })()}
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
