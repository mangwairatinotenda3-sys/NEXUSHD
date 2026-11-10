import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search as SearchIcon,
  X,
  Clock,
  Star,
  SearchX,
  WifiOff,
} from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import { MovieCard } from '../components/MovieRow.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { recordView } from '../hooks/useHistory.js';
import { tmdb, tmdbRequest, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/details.css';

const MAX_RECENT = 8;

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

function normalize(r) {
  if (r.media_type !== 'tv') return r;
  return {
    ...r,
    title: r.name || r.original_name || 'Untitled',
    release_date: r.first_air_date || '',
  };
}

async function searchTitles(term, page) {
  const data = await tmdbRequest('search/multi', { query: term, page });
  const results = (data.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map(normalize);
  return { results, totalPages: data.total_pages || 1 };
}

const pathOf = (m) => `/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`;

function SkeletonGrid({ count }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="poster-sk skeleton" />
          <div className="line-sk skeleton" />
        </div>
      ))}
    </div>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const sentinelRef = useRef(null);
  const termRef = useRef('');

  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [type, setType] = useState('all');
  const [retry, setRetry] = useState(0);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [recent, setRecent] = useLocalStorage('nexushd:recent-searches', []);
  const trending = useMovies(() => tmdb.trending());

  termRef.current = term;

  useEffect(() => {
    document.body.classList.add('hide-nav');
    inputRef.current?.focus();
    return () => document.body.classList.remove('hide-nav');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!term) {
      setResults([]);
      setLoading(false);
      setError(false);
      setPage(1);
      setTotalPages(1);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    searchTitles(term, 1)
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setPage(1);
        setTotalPages(data.totalPages);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, retry]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || page >= totalPages || !term) return;
    const forTerm = term;
    setLoadingMore(true);
    searchTitles(forTerm, page + 1)
      .then((data) => {
        if (termRef.current !== forTerm) return;
        setResults((prev) => {
          const seen = new Set(prev.map((m) => `${m.media_type}-${m.id}`));
          return [...prev, ...data.results.filter((m) => !seen.has(`${m.media_type}-${m.id}`))];
        });
        setPage((p) => p + 1);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, page, totalPages, term]);

  const visible = results.filter((m) => type === 'all' || m.media_type === type);
  const hasMore = page < totalPages;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { root: document.querySelector('.app-content'), rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, results.length, type]);

  const saveRecent = (t) => {
    if (!t) return;
    setRecent((prev) =>
      [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT)
    );
  };

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const openMovie = (movie) => {
    saveRecent(term);
    recordView(movie);
    navigate(pathOf(movie));
  };

  const submit = (e) => {
    e.preventDefault();
    const t = query.trim();
    setTerm(t);
    saveRecent(t);
    inputRef.current?.blur();
  };

  const trimmed = query.trim();
  const pending = trimmed !== term;
  const idle = !trimmed && !term;

  return (
    <div className="page">
      <form className="search-bar" onSubmit={submit}>
        <button type="button" className="icon-btn" onClick={back} aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <label className="search-field">
          <SearchIcon size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and series"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </label>
      </form>

      {!idle && (
        <div className="lib-chips" role="tablist">
          {TYPES.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={type === t.id}
              className={`lib-chip ${type === t.id ? 'on' : ''}`}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {idle ? (
        <>
          {recent.length > 0 && (
            <div className="search-section">
              <div className="search-section-head">
                <h2>Recent</h2>
                <button className="link-btn" onClick={() => setRecent([])}>
                  Clear all
                </button>
              </div>
              <div className="recent-list">
                {recent.map((t) => (
                  <div className="recent-chip" key={t}>
                    <button
                      onClick={() => setQuery(t)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Clock size={14} />
                      {t}
                    </button>
                    <button
                      className="x"
                      onClick={() => setRecent((prev) => prev.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="search-section">
            <div className="search-section-head">
              <h2>Trending now</h2>
            </div>
            {trending.loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="result-row">
                    <div className="skeleton" style={{ width: 22, height: 18 }} />
                    <div className="skeleton result-thumb" />
                    <div className="result-info">
                      <div className="skeleton" style={{ height: 14, width: '70%' }} />
                      <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 10 }} />
                    </div>
                  </div>
                ))
              : (trending.data?.results || []).slice(0, 10).map((m, i) => (
                  <button key={m.id} className="result-row" onClick={() => openMovie(m)}>
                    <span className="result-rank">{i + 1}</span>
                    <div className="result-thumb">
                      {m.poster_path && (
                        <img src={imageUrl(m.poster_path, 'w185')} alt="" loading="lazy" />
                      )}
                    </div>
                    <div className="result-info">
                      <div className="result-title">{m.title}</div>
                      <div className="result-sub">
                        {m.release_date && <span>{m.release_date.slice(0, 4)}</span>}
                        {m.vote_average > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Star size={12} fill="#fbbf24" color="#fbbf24" />
                            {m.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
          </div>
        </>
      ) : loading || pending ? (
        <SkeletonGrid count={9} />
      ) : error ? (
        <EmptyState
          icon={WifiOff}
          title="Search failed"
          text="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => setRetry((n) => n + 1)}
        />
      ) : visible.length === 0 && !hasMore ? (
        <EmptyState
          icon={SearchX}
          title="No results"
          text={
            type === 'all'
              ? `We couldn't find anything for "${term}". Try a different title.`
              : `No ${type === 'tv' ? 'series' : 'movies'} found for "${term}". Try another filter.`
          }
        />
      ) : (
        <>
          {visible.length > 0 && (
            <div className="grid">
              {visible.map((m) => (
                <MovieCard key={`${m.media_type}-${m.id}`} movie={m} onOpen={openMovie} />
              ))}
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="sentinel" />}
          {(loadingMore || (visible.length === 0 && hasMore)) && <SkeletonGrid count={3} />}
        </>
      )}
    </div>
  );
  }
