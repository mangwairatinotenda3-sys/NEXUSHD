import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  Download as DownloadIcon,
  ExternalLink,
  Info,
  Pause,
  Play,
  RotateCw,
  Search as SearchIcon,
  Share2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useContinue, { recordFilmProgress } from '../hooks/useContinue.js';
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
import { shareLink } from '../services/share.js';
import '../styles/free.css';
import '../styles/filmpage.css';

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
  const continueItems = useContinue();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledPlay = useRef(false);
  const { items: downloads, supported } = useDownloads();

  const sentinelRef = useRef(null);
  const selectedRef = useRef(null);
  const keyRef = useRef('');
  const toastTimer = useRef(null);

  selectedRef.current = selected;
  keyRef.current = `${term}|${sort}`;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // The film page covers the whole screen, so hide the bottom tab bar while it's open
  useEffect(() => {
    document.body.classList.toggle('film-open', Boolean(selected));
    return () => document.body.classList.remove('film-open');
  }, [selected]);

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
      setPlayer({ film, src: null, loading: true, offline: true, subtitles: rec.subs || [] });
      try {
        const url = await getPlayableUrl(film.id);
        setPlayer({ film, src: url, loading: false, offline: true, subtitles: rec.subs || [] });
      } catch {
        setPlayer({ film, src: null, loading: false, offline: true, subtitles: [] });
      }
    } else {
      setPlayer({
        film,
        src: film.src,
        loading: false,
        offline: false,
        subtitles: film.subs || [],
      });
    }
  };

  // Opened from "Continue Watching" on Home (#/free?play=<id>): go straight to the film
  const playParam = searchParams.get('play');
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (!playParam || handledPlay.current) return;
    handledPlay.current = true;
    setSearchParams({}, { replace: true });
    const saved = continueItems.find((c) => c.id === playParam);
    const entry = FREE_FILMS.find((f) => f.id === playParam) || {
      id: playParam,
      title: saved?.title || playParam,
      year: saved?.year || null,
      rights: 'Tagged as public domain or CC0 by the uploader on the Internet Archive',
    };
    const local = dlMap.get(playParam);
    if (local && local.status === 'completed') {
      // already downloaded: play it from the phone, no connection needed
      playRef.current({ ...entry, title: local.title, src: local.src, subs: local.subs || [] });
      return;
    }
    setPlayer({ film: entry, src: null, loading: true, offline: false, subtitles: [] });
    loadFilm(entry)
      .then((film) => playRef.current(film))
      .catch(() => {
        setPlayer(null);
        showToast("Couldn't open that film. Check your connection and try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playParam]);

  const share = async (film) => {
    const result = await shareLink({
      title: film.title,
      text: `Watch ${film.title}, a free public domain film, on the Internet Archive:`,
      url: archivePage(film.id),
    });
    if (result === 'copied') showToast('Link copied');
    else if (result === 'failed') showToast("Couldn't share this film");
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
        <div className="sheet-backdrop film-page" onClick={() => setSelected(null)}>
          <div className="fp" onClick={(e) => e.stopPropagation()}>
            <div className="fp-scroll">
              <div className="fp-hero">
                <div className="fp-hero-bg">
                  <Thumb id={selected.id} alt="" />
                </div>
                <div className="fp-hero-fade" />
                <button className="fp-round fp-back" onClick={() => setSelected(null)} aria-label="Back">
                  <ChevronLeft size={24} />
                </button>
                <button className="fp-round fp-share" onClick={() => share(selected)} aria-label="Share">
                  <Share2 size={20} />
                </button>
                <div className="fp-poster">
                  <Thumb id={selected.id} alt={selected.title} />
                </div>
              </div>

              <div className="fp-body">
                <h1 className="fp-title">{selected.title}</h1>
                <div className="fp-meta">
                  {[selected.year, details?.seconds ? formatDuration(details.seconds) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>

                <div className="fp-chips">
                  <span className="fp-chip">{rec?.status === 'completed' ? 'DOWNLOADED' : 'FREE'}</span>
                  <span className="fp-chip">PUBLIC DOMAIN</span>
                  {details?.subs?.length > 0 && <span className="fp-chip">CC</span>}
                  {details?.sizeBytes > 0 && <span className="fp-chip">{formatBytes(details.sizeBytes)}</span>}
                </div>

                {!details && !detailsError && (
                  <div style={{ marginTop: 18 }}>
                    <div className="skeleton" style={{ height: 14 }} />
                    <div className="skeleton" style={{ height: 14, marginTop: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 8 }} />
                  </div>
                )}

                {detailsError && (
                  <p className="fp-rights">
                    Couldn't load this film's details.{' '}
                    <a href={archivePage(selected.id)} target="_blank" rel="noopener noreferrer">
                      Open it on Archive.org
                    </a>
                    .
                  </p>
                )}

                {details?.description && (
                  <>
                    <p className={`fp-desc ${longText && !expanded ? 'clamp' : ''}`}>
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
                    className="btn-secondary fp-wide"
                    onClick={() => {
                      saveProgress(selected.id, 0);
                      recordFilmProgress(details, 0);
                      play(details);
                    }}
                  >
                    Start from the beginning
                  </button>
                )}

                {rec?.status === 'completed' && (
                  <button className="btn-secondary fp-wide" onClick={() => removeDownload(rec.id)}>
                    <Trash2 size={16} /> Remove download · {formatBytes(rec.size)}
                  </button>
                )}

                <div className="fp-info">
                  {details?.creator && (
                    <div className="fp-info-row">
                      <span>Director / creator</span>
                      <span>{details.creator}</span>
                    </div>
                  )}
                  <div className="fp-info-row">
                    <span>Source</span>
                    <span>
                      <a href={archivePage(selected.id)} target="_blank" rel="noopener noreferrer">
                        Internet Archive <ExternalLink size={12} />
                      </a>
                    </span>
                  </div>
                  <div className="fp-info-row">
                    <span>Rights</span>
                    <span>{selected.rights}</span>
                  </div>
                </div>

                <p className="fp-rights">
                  {details?.licenseUrl && (
                    <>
                      <a href={details.licenseUrl} target="_blank" rel="noopener noreferrer">
                        Licence
                      </a>
                      .{' '}
                    </>
                  )}
                  Make sure this film is free to watch where you live.
                </p>
              </div>
            </div>

            {/* Play and Download stay at the bottom, always in view */}
            <div className="fp-bar">
              {!details && !detailsError && (
                <div className="fp-bar-row">
                  <div className="skeleton fp-play" style={{ height: 50, borderRadius: 14 }} />
                  <div className="skeleton fp-secondary" style={{ height: 50, borderRadius: 14 }} />
                </div>
              )}

              {details && rec && rec.status !== 'completed' && (
                <div className="fp-dl">
                  <div className="fp-dl-row">
                    <span>
                      {rec.status === 'error'
                        ? rec.error
                        : rec.status === 'paused'
                        ? `Paused · ${percent(rec)}%`
                        : `Downloading · ${percent(rec)}%`}
                    </span>
                    <span>
                      {formatBytes(rec.bytes)}
                      {rec.size ? ` of ${formatBytes(rec.size)}` : ''}
                    </span>
                  </div>
                  <div className="fp-progress">
                    <span style={{ width: `${percent(rec)}%` }} />
                  </div>
                </div>
              )}

              {details && (
                <div className="fp-bar-row">
                  <button
                    className="btn-primary fp-play"
                    disabled={!details.src}
                    onClick={() => play(details)}
                  >
                    <Play size={18} fill="currentColor" />
                    {rec?.status === 'completed'
                      ? 'Play offline'
                      : resumeAt > 10
                      ? `Resume ${formatClock(resumeAt)}`
                      : 'Play'}
                  </button>

                  {supported && details.src && !rec && (
                    <button
                      className="btn-secondary fp-secondary"
                      onClick={() => {
                        startDownload(details);
                        showToast('Downloading. It carries on if you reopen NexusHD.');
                      }}
                    >
                      <DownloadIcon size={18} /> Download
                    </button>
                  )}

                  {rec && rec.status === 'downloading' && (
                    <button className="btn-secondary fp-secondary" onClick={() => pauseDownload(rec.id)}>
                      <Pause size={16} /> Pause
                    </button>
                  )}

                  {rec && (rec.status === 'paused' || rec.status === 'error') && (
                    <button className="btn-secondary fp-secondary" onClick={() => resumeDownload(rec.id)}>
                      <RotateCw size={16} /> {rec.status === 'error' ? 'Try again' : 'Resume'}
                    </button>
                  )}

                  {rec && rec.status !== 'completed' && (
                    <button
                      className="btn-secondary fp-cancel"
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
          subtitles={player.subtitles || []}
          fallbackHref={archivePage(player.film.id)}
          onClose={closePlayer}
          onProgress={(s) => {
            saveProgress(player.film.id, s);
            recordFilmProgress(player.film, s);
          }}
        />
      )}

      {toast && <div className="toast" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }}>{toast}</div>}
    </div>
  );
                      }
