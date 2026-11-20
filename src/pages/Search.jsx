import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
  Clock,
  Star,
  SearchX,
  WifiOff,
} from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import SearchFilters, {
  NO_FILTERS,
  SORT_OPTIONS,
  filtersActive,
} from '../components/SearchFilters.jsx';
import { MovieCard } from '../components/MovieRow.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { recordView } from '../hooks/useHistory.js';
import { GENRES, RATINGS, YEARS, matchesGenre, matchesYear } from '../services/genres.js';
import { tmdb, tmdbRequest, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/details.css';
import '../styles/library.css';
import '../styles/search.css';

const MAX_RECENT = 8;
// with filters on, stop looking for more matches after this many pages
const MAX_FILTERED_PAGES = 8;

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

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* The filters, written the way TMDB wants them for one kind (movie or tv) */
function discoverParams(kind, filters, sort) {
  const params = {};
  const genre = GENRES.find((g) => g.id === filters.genre);
  if (genre?.[kind]) params.with_genres = genre[kind];

  const dateKey = kind === 'tv' ? 'first_air_date' : 'primary_release_date';
  const range = YEARS.find((y) => y.id === filters.year);
  let upTo = range?.to ? `${range.to}-12-31` : '';
  if (range?.from) params[`${dateKey}.gte`] = `${range.from}-01-01`;

  if (filters.rating) {
    params['vote_average.gte'] = filters.rating;
    params['vote_count.gte'] = 100;
  }
  if (sort === 'rating') {
    params.sort_by = 'vote_average.desc';
    params['vote_count.gte'] = Math.max(params['vote_count.gte'] || 0, 300);
  } else if (sort === 'newest') {
    params.sort_by = `${dateKey}.desc`;
    // titles that are not out yet do not belong in "newest"
    const today = isoToday();
    if (!upTo || upTo > today) upTo = today;
    params['vote_count.gte'] = Math.max(params['vote_count.gte'] || 0, 20);
  } else {
    params.sort_by = 'popularity.desc';
  }
  if (upTo) params[`${dateKey}.lte`] = upTo;
  return params;
}

/* One page of browsing with no search words, from movies, series or both */
async function browsePage(type, filters, sort, page) {
  const genre = GENRES.find((g) => g.id === filters.genre);
  const kinds = (type === 'all' ? ['movie', 'tv'] : [type]).filter(
    (k) => !genre || genre[k] != null
  );
  if (kinds.length === 0) return { results: [], totalPages: 1 };

  const answers = await Promise.all(
    kinds.map((k) => tmdb.discover(k, discoverParams(k, filters, sort), page).catch(() => null))
  );
  if (answers.every((a) => !a)) throw new Error('Browse failed');
  return {
    results: answers.flatMap((a) => (a ? a.results || [] : [])),
    totalPages: Math.min(500, Math.max(...answers.map((a) => (a ? a.total_pages || 1 : 1)))),
  };
}

const dateOf = (m) => Date.parse(m.release_date) || 0;

/* Ordering done here, on what has been loaded. "Best match" keeps TMDB's order. */
function sortItems(list, sort, browsing) {
  const out = [...list];
  if (sort === 'rating') out.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  else if (sort === 'newest') out.sort((a, b) => dateOf(b) - dateOf(a));
  else if (sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title));
  else if (browsing) out.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return out;
}

const pathOf = (m) => `/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`;
const keyOf = (m) => `${m.media_type}-${m.id}`;

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
  const requestRef = useRef('');

  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [type, setType] = useState('all');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState('default');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [recent, setRecent] = useLocalStorage('nexushd:recent-searches', []);
  const trending = useMovies(() => tmdb.trending());

  const trimmed = query.trim();
  const active = filtersActive(filters);
  // text = searching for words; browse = no words, only filters or an order
  const mode = term ? 'text' : active || sort !== 'default' ? 'browse' : 'idle';
  const browsing = mode === 'browse';
  const idle = !trimmed && mode === 'idle';
  const pending = trimmed !== term && Boolean(trimmed);

  // what a request depends on: when it changes, start again from page 1
  const requestKey =
    mode === 'text'
      ? `text|${term}`
      : mode === 'browse'
        ? `browse|${type}|${filters.genre}|${filters.year}|${filters.rating}|${sort}`
        : 'idle';
  requestRef.current = requestKey;

  useEffect(() => {
    document.body.classList.add('hide-nav');
    inputRef.current?.focus();
    return () => document.body.classList.remove('hide-nav');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    (n) =>
      mode === 'text' ? searchTitles(term, n) : browsePage(type, filters, sort, n),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestKey]
  );

  useEffect(() => {
    if (mode === 'idle') {
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
    setResults([]);
    fetchPage(1)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, retry]);

  const pageLimit = mode === 'text' && active ? MAX_FILTERED_PAGES : 500;
  const hasMore = page < Math.min(totalPages, pageLimit);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore || mode === 'idle') return;
    const forKey = requestKey;
    setLoadingMore(true);
    fetchPage(page + 1)
      .then((data) => {
        if (requestRef.current !== forKey) return;
        setResults((prev) => {
          const seen = new Set(prev.map(keyOf));
          return [...prev, ...data.results.filter((m) => !seen.has(keyOf(m)))];
        });
        setPage((p) => p + 1);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, hasMore, mode, requestKey, fetchPage, page]);

  const visible = useMemo(() => {
    let list = results;
    if (mode === 'text') {
      const genre = GENRES.find((g) => g.id === filters.genre);
      const range = YEARS.find((y) => y.id === filters.year);
      list = list.filter(
        (m) =>
          (type === 'all' || m.media_type === type) &&
          matchesGenre(m, genre) &&
          matchesYear(m, range) &&
          (!filters.rating || (m.vote_average || 0) >= filters.rating)
      );
    }
    return sortItems(list, sort, browsing);
  }, [results, mode, type, filters, sort, browsing]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { root: document.querySelector('.app-content'), rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, results.length, visible.length]);

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

  const resetFilters = () => {
    setFilters(NO_FILTERS);
    setSort('default');
  };

  const activeCount = (filters.genre ? 1 : 0) + (filters.year !== 'any' ? 1 : 0) + (filters.rating ? 1 : 0);
  const sortName = SORT_OPTIONS(browsing).find((s) => s.id === sort)?.label;
  const genreName = GENRES.find((g) => g.id === filters.genre)?.label;
  const yearName = YEARS.find((y) => y.id === filters.year)?.label;
  const ratingName = RATINGS.find((r) => r.id === filters.rating)?.label;

  const summary = (activeCount > 0 || sort !== 'default') && (
    <div className="sf-summary" aria-label="Active filters">
      {filters.genre && (
        <button onClick={() => setFilters({ ...filters, genre: null })}>
          {genreName} <X size={13} />
        </button>
      )}
      {filters.year !== 'any' && (
        <button onClick={() => setFilters({ ...filters, year: 'any' })}>
          {yearName} <X size={13} />
        </button>
      )}
      {filters.rating > 0 && (
        <button onClick={() => setFilters({ ...filters, rating: 0 })}>
          Rated {ratingName} <X size={13} />
        </button>
      )}
      {sort !== 'default' && (
        <button onClick={() => setSort('default')}>
          {sortName} <X size={13} />
        </button>
      )}
    </div>
  );

  const nothing = visible.length === 0 && !hasMore;
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
        <button
          type="button"
          className={`icon-btn sf-open ${activeCount > 0 || sort !== 'default' ? 'on' : ''}`}
          onClick={() => setSheetOpen(true)}
          aria-label="Filter and sort"
        >
          <SlidersHorizontal size={22} />
          {activeCount > 0 && <span className="sf-badge">{activeCount}</span>}
        </button>
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

      {summary}

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
              <h2>Browse by genre</h2>
            </div>
            <div className="sf-genres">
              {GENRES.map((g) => (
                <button key={g.id} onClick={() => setFilters({ ...filters, genre: g.id })}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

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
      ) : nothing ? (
        <EmptyState
          icon={SearchX}
          title="No results"
          text={
            active || sort !== 'default'
              ? mode === 'browse' && filters.genre && type === 'tv'
                ? `There is no series category for ${genreName}. Try Movies or All.`
                : 'Nothing matches these filters. Try fewer filters.'
              : type === 'all'
                ? `We couldn't find anything for "${term}". Try a different title.`
                : `No ${type === 'tv' ? 'series' : 'movies'} found for "${term}". Try another filter.`
          }
          actionLabel={active || sort !== 'default' ? 'Reset filters' : undefined}
          onAction={resetFilters}
        />
      ) : (
        <>
          {visible.length > 0 && (
            <div className="grid">
              {visible.map((m) => (
                <MovieCard key={keyOf(m)} movie={m} onOpen={openMovie} />
              ))}
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="sentinel" />}
          {(loadingMore || (visible.length === 0 && hasMore)) && <SkeletonGrid count={3} />}
        </>
      )}

      {sheetOpen && (
        <SearchFilters
          filters={filters}
          sort={sort}
          browsing={mode !== 'text'}
          onApply={(f, s) => {
            setFilters(f);
            setSort(s);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
              }
