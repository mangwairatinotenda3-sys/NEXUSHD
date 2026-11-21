import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  MoreVertical,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import BrandMark from '../components/BrandMark.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MovieRow from '../components/MovieRow.jsx';
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
import { tmdb, useMovies } from '../services/tmdb.js';
import { archivePage, archiveThumb, formatDuration } from '../services/archive.js';
import { formatBytes } from '../utils/format.js';
import '../styles/library.css';
import '../styles/downloads.css';

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

function DownloadsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="dl-tabs">
        <div className="skeleton" style={{ height: 82, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 82, borderRadius: 999 }} />
      </div>
      <div className="dl-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dl-row">
            <div className="skeleton dl-thumb" />
            <div className="dl-main">
              <div className="skeleton" style={{ height: 20, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
              <div className="skeleton" style={{ height: 8, width: '100%', marginTop: 12, borderRadius: 99 }} />
            </div>
            <div className="skeleton" style={{ width: 54, height: 54, borderRadius: 27 }} />
          </div>
        ))}
      </div>
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
  const [tab, setTab] = useState(null); // 'downloading' | 'completed', chosen once the list is known
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [player, setPlayer] = useState(null);
  const [progress, setProgress] = useLocalStorage('nexushd:free-progress', {});
  const downloadingRef = useRef(null);
  const completedRef = useRef(null);
  const suggested = useMovies(() => tmdb.trending());

  const unfinished = useMemo(() => items.filter((d) => d.status !== 'completed'), [items]);
  const finished = useMemo(() => items.filter((d) => d.status === 'completed'), [items]);
  const totalBytes = useMemo(() => items.reduce((sum, d) => sum + (d.bytes || 0), 0), [items]);
  const running = useMemo(() => items.filter((d) => d.status === 'downloading'), [items]);
  const stopped = useMemo(
    () => items.filter((d) => d.status === 'paused' || d.status === 'error'),
    [items]
  );
  const storage = useStorage(Math.round(totalBytes / (16 * 1024 * 1024)));
  const free = storage ? Math.max(0, storage.quota - storage.used) : 0;

  // Keep the open menu in step with the latest download state
  const menuItem = itemMenu ? items.find((d) => d.id === itemMenu.id) || null : null;
  useEffect(() => {
    if (itemMenu && !menuItem) setItemMenu(null);
  }, [itemMenu, menuItem]);

  // the tab that is lit follows the part of the page you are looking at
  const activeTab = tab || (unfinished.length > 0 ? 'downloading' : 'completed');
  useEffect(() => {
    const scroller = document.querySelector('.app-content');
    if (!scroller) return undefined;
    const onScroll = () => {
      const done = completedRef.current;
      if (!done) return;
      const line = scroller.getBoundingClientRect().top + 220;
      setTab(done.getBoundingClientRect().top < line ? 'completed' : 'downloading');
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const jumpTo = (id) => {
    setTab(id);
    const target = id === 'completed' ? completedRef.current : downloadingRef.current;
    if (id === 'downloading') {
      document.querySelector('.app-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

  const pauseOrResumeAll = () => {
    if (running.length > 0) running.forEach((d) => pauseDownload(d.id));
    else stopped.forEach((d) => resumeDownload(d.id, true));
  };

  const topBar = (
    <header className="dl-bar">
      <div className="dl-brand">
        <BrandMark size={32} />
        <span>
          NEXUS<span className="accent">HD</span>
        </span>
      </div>
      <button
        className="icon-btn"
        onClick={() => setMenuOpen(true)}
        disabled={loading || items.length === 0}
        aria-label="Downloads options"
      >
        <MoreVertical size={24} />
      </button>
    </header>
  );

  if (loading) {
    return (
      <div className="page">
        {topBar}
        <h1 className="dl-heading">Downloads</h1>
        <DownloadsSkeleton />
      </div>
    );
  }

  const activeRow = (d, i) => {
    const pct = percent(d);
    const state = stateOf(d);
    const action = actionOf(d);
    const ActionIcon = action.Icon;
    const detail =
      d.status === 'downloading'
        ? speedLine(d)
        : d.status === 'error'
          ? d.error || 'Failed'
          : state.label;
    return (
      <article
        className="dl-row"
        key={d.id}
        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
      >
        <button className="dl-thumb" onClick={() => setItemMenu(d)} aria-label={`Options for ${d.title}`}>
          <Thumb id={d.id} />
        </button>
        <button className="dl-main" onClick={() => setItemMenu(d)}>
          <span className="dl-name">{d.title}</span>
          <span className="dl-sub">
            {d.size ? formatBytes(d.size) : 'Size unknown'}
            {d.seconds > 0 ? ` · ${formatDuration(d.seconds)}` : ''}
          </span>
          <span className={`dl-bar-track ${state.id}`} aria-hidden="true">
            <span style={{ width: `${Math.max(pct, d.status === 'downloading' ? 2 : 0)}%` }} />
          </span>
          <span className={`dl-line ${state.id}`}>
            <b>{pct}%</b>
            {detail ? <span>{detail}</span> : null}
          </span>
        </button>
        <button
          className={`dl-round ${action.id}`}
          onClick={() => runAction(d)}
          aria-label={`${action.label} ${d.title}`}
        >
          <ActionIcon size={24} fill={action.fill ? 'currentColor' : 'none'} />
        </button>
      </article>
    );
  };

  const doneRow = (d, i) => (
    <article
      className="dl-row done"
      key={d.id}
      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
    >
      <button className="dl-thumb" onClick={() => play(d)} aria-label={`Play ${d.title}`}>
        <Thumb id={d.id} />
      </button>
      <button className="dl-main" onClick={() => play(d)}>
        <span className="dl-name">{d.title}</span>
        <span className="dl-sub">
          {formatBytes(d.size)}
          {d.seconds > 0 ? ` · ${formatDuration(d.seconds)}` : ''}
        </span>
      </button>
      <button className="dl-round play" onClick={() => play(d)} aria-label={`Play ${d.title}`}>
        <Play size={24} fill="currentColor" />
      </button>
      <button
        className="icon-btn dl-kebab"
        onClick={() => setItemMenu(d)}
        aria-label={`Options for ${d.title}`}
      >
        <MoreVertical size={22} />
      </button>
    </article>
  );

  return (
    <div className="page">
      {topBar}
      <h1 className="dl-heading">Downloads</h1>

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
          <div className="dl-tabs" role="tablist" aria-label="Downloads">
            <button
              role="tab"
              aria-selected={activeTab === 'downloading'}
              className={activeTab === 'downloading' ? 'on' : ''}
              onClick={() => jumpTo('downloading')}
            >
              <Download size={26} /> Downloading ({unfinished.length})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'completed'}
              className={activeTab === 'completed' ? 'on' : ''}
              onClick={() => jumpTo('completed')}
            >
              <Check size={26} strokeWidth={2.6} /> Completed ({finished.length})
            </button>
          </div>

          <p className="dl-storage">
            {formatBytes(totalBytes)} on this device
            {storage ? ` · about ${formatBytes(free)} free` : ''}
            {network.wifiOnly ? ' · Wi-Fi only' : ''}
          </p>

          <section className="dl-section" ref={downloadingRef}>
            <div className="dl-section-head">
              <span className="dl-dot" aria-hidden="true" />
              <h2>Downloading</h2>
              {unfinished.length > 0 && (running.length > 0 || stopped.length > 0) && (
                <button className="dl-outline" onClick={pauseOrResumeAll}>
                  {running.length > 0 ? (
                    <>
                      <Pause size={18} fill="currentColor" /> Pause All
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" /> Resume All
                    </>
                  )}
                </button>
              )}
            </div>
            {unfinished.length > 0 ? (
              <div className="dl-list">{unfinished.map(activeRow)}</div>
            ) : (
              <p className="dl-none">Nothing is downloading right now.</p>
            )}
          </section>

          <section className="dl-section" ref={completedRef}>
            <div className="dl-section-head">
              <span className="dl-dot done" aria-hidden="true">
                <Check size={17} strokeWidth={3.2} />
              </span>
              <h2>Completed</h2>
              {finished.length > 0 && (
                <button className="dl-clear" onClick={() => setConfirm({ type: 'done' })}>
                  <Trash2 size={19} /> Clear All
                </button>
              )}
            </div>
            {finished.length > 0 ? (
              <div className="dl-list">{finished.map(doneRow)}</div>
            ) : (
              <p className="dl-none">Finished downloads show up here.</p>
            )}
          </section>
        </>
      )}

      <MovieRow
        title="Suggested Movies"
        movies={suggested.data?.results}
        loading={suggested.loading}
        onOpen={(m) => navigate(`/movie/${m.id}`)}
        onSeeAll={() => navigate('/')}
      />

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
              {stopped.length > 0 && (
                <button
                  onClick={() => {
                    stopped.forEach((d) => resumeDownload(d.id, true));
                    setMenuOpen(false);
                  }}
                >
                  <Play size={20} /> Resume all
                </button>
              )}
              <div className="sep" />
              {finished.length > 0 && (
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
                  ? `This deletes ${finished.length} finished ${finished.length === 1 ? 'film' : 'films'} from this device. Films still downloading are kept.`
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
