import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download as DownloadIcon,
  ExternalLink,
  Info,
  Pause,
  Play,
  RotateCw,
  Search as SearchIcon,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useDownloads, {
  getPlayableUrl,
  pauseDownload,
  removeDownload,
  resumeDownload,
  startDownload,
} from '../services/downloadManager.js';
import {
  FREE_FILMS,
  archivePage,
  archiveThumb,
  formatClock,
  formatDuration,
  loadFilm,
  searchFreeFilms,
} from '../services/archive.js';
import { formatBytes } from '../utils/format.js';
import '../styles/free.css';

const SORTS = [
  { id: 'popular', label: 'Popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'title', label: 'A–Z' },
];

const percent = (rec) => (rec.size ? Math.min(100, Math.round((rec.bytes / rec.size) * 100)) : 0);

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

function FilmCard({ film, downloaded, index, onOpen }) {
  const sub = [film.year, film.seconds ? formatDuration(film.seconds) : ''].filter(Boolean).join(' · ');
  return (
    <button
      className="free-card"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      onClick={() => onOpen(film)}
    >
      <div className="free-thumb">
        <Thumb id={film.id} alt={film.title} />
        <span className="free-badge">{downloaded ? 'DOWNLOADED' : 'FREE'}</span>
      </div>
      <div className="free-title">{film.title}</div>
      {sub && <div className="free-sub">{sub}</div>}
    </button>
  );
}

function SkeletonCards({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i}>
      <div className="skeleton free-thumb-sk" />
      <div className="skeleton" style={{ height: 14, width: '75%', marginTop: 10 }} />
      <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 8 }} />
    </div>
  ));
}

export default function FreeFilms() {
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState('popular');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [player, setPlayer] = useState(null);
  const [toast, setToast] = useState('');
  const [progress, setProgress] = useLocalStorage('nexushd:free-progress', {});
  const { items: downloads, supported } = useDownloads();

  const sentinelRef = useRef(null);
  const selectedRef = useRef(null);
  const keyRef = useRef('');
  const toastTimer = useRef(null);

  selectedRef.current = selected;
  keyRef.current = `${term}|${sort}`;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  // Hand-picked films
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(FREE_FILMS.map(loadFilm)).then((rs) => {
      if (cancelled) return;
      setFeatured(rs.filter((r) => r.status === 'fulfilled').map((r) => r.value));
      setFeaturedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Browse more films
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    searchFreeFilms({ term, sort, page: 1 })
      .then((data) => {
        if (cancelled) return;
        setResults(data.films);
        setPage(1);
        setHasMore(data.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setResults([]);
        setHasMore(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, sort, retry]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    const forKey = `${term}|${sort}`;
    setLoadingMore(true);
    searchFreeFilms({ term, sort, page: page + 1 })
      .then((data) => {
        if (keyRef.current !== forKey) return;
        setResults((prev) => {
          const seen = new Set(prev.map((f) => f.id));
          return [...prev, ...data.films.filter((f) => !seen.has(f.id))];
        });
        setPage((p) => p + 1);
        setHasMore(data.hasMore);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, hasMore, term, sort, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { root: document.querySelector('.app-content'), rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, results.length]);

  const dlMap = useMemo(() => new Map(downloads.map((d) => [d.id, d])), [downloads]);

  const featuredShown = useMemo(
    () =>
      featured.filter((f) => !term || f.title.toLowerCase().includes(term.toLowerCase())),
    [featured, term]
  );

  const moreShown = useMemo(() => {
    const known = new Set(FREE_FILMS.map((f) => f.id.toLowerCase()));
    return results.filter((r) => !known.has(r.id.toLowerCase()));
  }, [results]);

  const saveProgress = useCallback(
    (id, seconds) => setProgress((prev) => ({ ...prev, [id]: seconds })),
    [setProgress]
  );

  const open = (entry) => {
    setExpanded(false);
    setSelected(entry);
    setDetailsError(false);
    if ('src' in entry) {
      setDetails(entry);
      return;
    }
    setDetails(null);
    loadFilm(entry)
      .then((d) => selectedRef.current?.id === entry.id && setDetails(d))
      .catch(() => selectedRef.current?.id === entry.id && setDetailsError(true));
  };

  const play = async (film) => {
    setSelected(null);
    const rec = dlMap.get(film.id);
    if (rec && rec.status === 'completed') {
      setPlayer({ film, src: null, loading: true, offline: true });
      try {
        const url = await getPlayableUrl(film.id);
        setPlayer({ film, src: url, loading: false, offline: true });
      } catch {
        setPlayer({ film, src: null, loading: false, offline: true });
      }
    } else {
      setPlayer({ film, src: film.src, loading: false, offline: false });
    }
  };

  const closePlayer = () => {
    if (player?.offline && player.src) URL.revokeObjectURL(player.src);
    setPlayer(null);
  };

  const rec = selected ? dlMap.get(selected.id) : null;
  const resumeAt = selected ? progress[selected.id] || 0 : 0;
  const longText = (details?.description || '').length > 200;
  const noResults =
    !featuredLoading && !loading && !error && featuredShown.length === 0 && moreShown.length === 0;

  return (
    <div className="page">
      <Header title="Free Films" back />

      <div className="free-note">
        <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Films hosted by the Internet Archive and tagged as public domain. Copyright rules differ
          between countries.
        </span>
      </div>

      <label className="search-field" style={{ margin: '0 20px 12px' }}>
        <SearchIcon size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search free films"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={15} />
          </button>
        )}
      </label>

      <div className="lib-chips" role="tablist">
        {SORTS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sort === s.id}
            className={`lib-chip ${sort === s.id ? 'on' : ''}`}
            onClick={() => setSort(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {(featuredLoading || featuredShown.length > 0) && (
        <>
          <h2 className="free-heading">Featured</h2>
          <div className="free-grid">
            {featuredLoading ? (
              <SkeletonCards count={4} />
            ) : (
              featuredShown.map((f, i) => (
                <FilmCard
                  key={f.id}
                  film={f}
                  index={i}
                  downloaded={dlMap.get(f.id)?.status === 'completed'}
                  onOpen={open}
                />
              ))
            )}
          </div>
        </>
      )}

      {(loading || moreShown.length > 0 || error) && (
        <h2 className="free-heading">More free films</h2>
      )}

      {error ? (
        <div className="free-error">
          <WifiOff size={20} />
          <span>Couldn't load more films.</span>
          <button className="link-btn" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="free-grid">
          <SkeletonCards count={6} />
        </div>
      ) : (
        moreShown.length > 0 && (
          <div className="free-grid">
            {moreShown.map((f, i) => (
              <FilmCard
                key={f.id}
                film={f}
                index={i}
                downloaded={dlMap.get(f.id)?.status === 'completed'}
                onOpen={open}
              />
            ))}
          </div>
        )
      )}

      {hasMore && !loading && <div ref={sentinelRef} className="sentinel" />}
      {loadingMore && (
        <div className="free-grid" style={{ marginTop: 18 }}>
          <SkeletonCards count={2} />
        </div>
      )}

      {noResults && (
        <EmptyState
          icon={SearchIcon}
          title="No films found"
          text={term ? `Nothing matched "${term}". Try another title.` : 'No films are available right now.'}
        />
      )}

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet film-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />

            <div className="film-scroll">
              <div className="film-head">
                <div className="film-poster">
                  <Thumb id={selected.id} alt={selected.title} />
                </div>
                <div className="film-info">
                  <h3>{selected.title}</h3>
                  <div className="free-sub">
                    {[selected.year, details?.seconds ? formatDuration(details.seconds) : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {details?.creator && <div className="free-sub">{details.creator}</div>}
                  {details?.sizeBytes > 0 && (
                    <div className="free-sub">Standard quality · {formatBytes(details.sizeBytes)}</div>
                  )}
                </div>
              </div>

              {!details && !detailsError && (
                <div style={{ marginBottom: 12 }}>
                  <div className="skeleton" style={{ height: 14 }} />
                  <div className="skeleton" style={{ height: 14, marginTop: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 8 }} />
                </div>
              )}

              {detailsError && (
                <p className="film-rights">
                  Couldn't load this film's details.{' '}
                  <a href={archivePage(selected.id)} target="_blank" rel="noopener noreferrer">
                    Open it on Archive.org
                  </a>
                  .
                </p>
              )}

              {details?.description && (
                <>
                  <p className={`film-desc ${longText && !expanded ? 'clamp' : ''}`}>
                    {details.description}
                  </p>
                  {longText && (
                    <button className="d-more" onClick={() => setExpanded(!expanded)}>
                      {expanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </>
              )}

              {details && resumeAt > 10 && (
                <button
                  className="btn-secondary film-wide"
                  onClick={() => {
                    saveProgress(selected.id, 0);
                    play(details);
                  }}
                >
                  Start from the beginning
                </button>
              )}

              {rec?.status === 'completed' && (
                <button className="btn-secondary film-wide" onClick={() => removeDownload(rec.id)}>
                  <Trash2 size={16} /> Remove download · {formatBytes(rec.size)}
                </button>
              )}

              <a
                className="btn-secondary film-wide"
                href={archivePage(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Archive.org <ExternalLink size={16} />
              </a>

              <p className="film-rights">
                Rights: {selected.rights}.
                {details?.licenseUrl && (
                  <>
                    {' '}
                    <a href={details.licenseUrl} target="_blank" rel="noopener noreferrer">
                      Licence
                    </a>
                    .
                  </>
                )}{' '}
                Make sure this film is free to watch where you live.
              </p>
            </div>

            {/* Play and Download stay at the bottom, always in view */}
            <div className="film-bar">
              {!details && !detailsError && (
                <div className="film-bar-row">
                  <div className="skeleton" style={{ height: 50, borderRadius: 14 }} />
                  <div className="skeleton" style={{ height: 50, borderRadius: 14 }} />
                </div>
              )}

              {details && rec && rec.status !== 'completed' && (
                <div className="film-dl">
                  <div className="film-dl-row">
                    <span>
                      {rec.status === 'error'
                        ? rec.error
                        : rec.status === 'paused'
                        ? `Paused · ${percent(rec)}%`
                        : `Downloading · ${percent(rec)}%`}
                    </span>
                    <span className="free-sub" style={{ margin: 0 }}>
                      {formatBytes(rec.bytes)}
                      {rec.size ? ` of ${formatBytes(rec.size)}` : ''}
                    </span>
                  </div>
                  <span className="progress" style={{ display: 'block' }}>
                    <span style={{ display: 'block', width: `${percent(rec)}%` }} />
                  </span>
                </div>
              )}

              {details && (
                <div className="film-bar-row">
                  <button className="btn-primary" disabled={!details.src} onClick={() => play(details)}>
                    <Play size={18} fill="currentColor" />
                    {rec?.status === 'completed'
                      ? 'Play offline'
                      : resumeAt > 10
                      ? `Resume ${formatClock(resumeAt)}`
                      : 'Play'}
                  </button>

                  {supported && details.src && !rec && (
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        startDownload(details);
                        showToast('Downloading. Keep NexusHD open until it finishes.');
                      }}
                    >
                      <DownloadIcon size={18} /> Download
                      {details.sizeBytes > 0 ? ` · ${formatBytes(details.sizeBytes)}` : ''}
                    </button>
                  )}

                  {rec && rec.status === 'downloading' && (
                    <button className="btn-secondary" onClick={() => pauseDownload(rec.id)}>
                      <Pause size={16} /> Pause
                    </button>
                  )}

                  {rec && (rec.status === 'paused' || rec.status === 'error') && (
                    <button className="btn-secondary" onClick={() => resumeDownload(rec.id)}>
                      <RotateCw size={16} /> {rec.status === 'error' ? 'Try again' : 'Resume'}
                    </button>
                  )}

                  {rec && rec.status !== 'completed' && (
                    <button
                      className="btn-secondary film-cancel"
                      onClick={() => removeDownload(rec.id)}
                      aria-label="Cancel download"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {player && (
        <VideoPlayer
          title={player.film.title}
          src={player.src}
          loading={player.loading}
          startAt={progress[player.film.id] || 0}
          fallbackHref={archivePage(player.film.id)}
          onClose={closePlayer}
          onProgress={(s) => saveProgress(player.film.id, s)}
        />
      )}

      {toast && <div className="toast" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }}>{toast}</div>}
    </div>
  );
  }
