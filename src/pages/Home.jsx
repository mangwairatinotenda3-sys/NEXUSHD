import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Flame, WifiOff, ChevronRight, Bell, Download, Star } from 'lucide-react';
import BrandMark from '../components/BrandMark.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MovieRow from '../components/MovieRow.jsx';
import ContinueRow from '../components/ContinueRow.jsx';
import FreeFilms from './FreeFilms.jsx';
import ComingSoon from './ComingSoon.jsx';
import useHistory, { recordView } from '../hooks/useHistory.js';
import useReminders from '../services/reminders.js';
import useOnline from '../hooks/useOnline.js';
import { whenOnline } from '../services/connection.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/home.css';
import '../styles/homefeed.css';
import '../styles/free.css';
import '../styles/soon.css';

const GAP = 12;

/* A row of cards you swipe through. Phones show one card with the next one
   peeking in; wide screens show two. */
function Hero({ movies, genreMap, onOpen }) {
  const trackRef = useRef(null);
  const holdTimer = useRef(null);
  const held = useRef(false);
  const [index, setIndex] = useState(0);

  const step = () => {
    const card = trackRef.current?.firstElementChild;
    return card ? card.offsetWidth + GAP : 0;
  };

  const onScroll = () => {
    const s = step();
    if (s) setIndex(Math.min(movies.length - 1, Math.round(trackRef.current.scrollLeft / s)));
  };

  const goTo = (i) => trackRef.current?.scrollTo({ left: i * step(), behavior: 'smooth' });

  // moves on by itself, but never while a finger is on it
  useEffect(() => {
    if (movies.length < 2) return undefined;
    const timer = setInterval(() => {
      const t = trackRef.current;
      if (!t || held.current) return;
      const atEnd = t.scrollLeft + t.clientWidth >= t.scrollWidth - 8;
      t.scrollTo({ left: atEnd ? 0 : t.scrollLeft + step(), behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(timer);
  }, [movies.length]);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const hold = () => {
    held.current = true;
    clearTimeout(holdTimer.current);
  };
  const release = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      held.current = false;
    }, 5000);
  };

  return (
    <div className="hero-wrap">
      <div
        className="hero"
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={hold}
        onTouchEnd={release}
        onTouchCancel={release}
      >
        {movies.map((m, i) => {
          const genres = (m.genre_ids || [])
            .slice(0, 2)
            .map((id) => genreMap[id])
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={m.id} className="hero-card" onClick={() => onOpen(m)}>
              <img
                src={imageUrl(m.backdrop_path, 'w780')}
                alt=""
                loading={i < 2 ? 'eager' : 'lazy'}
                draggable="false"
              />
              <div className="hero-shade" />
              <div className="hero-body">
                <span className="badge-trending">
                  <Flame size={12} /> Trending
                </span>
                <h2 className="hero-title">{m.title}</h2>
                <div className="hero-meta">
                  {m.vote_average > 0 && (
                    <span className="hero-rate">
                      <Star size={12} fill="currentColor" /> {m.vote_average.toFixed(1)}
                    </span>
                  )}
                  {m.release_date && <span>{m.release_date.slice(0, 4)}</span>}
                  {genres && <span>{genres}</span>}
                </div>
                <button
                  className="btn-primary hero-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(m);
                  }}
                >
                  <Play size={15} fill="currentColor" /> Watch Now
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero-dots">
        {movies.map((m, i) => (
          <button
            key={m.id}
            className={i === index ? 'on' : ''}
            onClick={() => goTo(i)}
            aria-label={`Show ${m.title}`}
          />
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'all', label: 'For you' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
  { id: 'free', label: 'Free films' },
  { id: 'soon', label: 'Coming soon' },
];
const TAB_KEY = 'nexushd:home-tab';

const savedTab = () => {
  try {
    const v = window.sessionStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.id === v) ? v : 'all';
  } catch {
    return 'all';
  }
};

/* A swipe sideways must not fight with rows, chips and sheets that scroll sideways themselves */
const swipeBlocked = (el, root) => {
  for (let n = el; n && n !== root; n = n.parentElement) {
    if (n.matches?.('input, textarea, select, .sheet-backdrop, .hero')) return true;
    if (n.scrollWidth > n.clientWidth + 2) {
      const ox = window.getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
};

export default function Home() {
  const navigate = useNavigate();
  const history = useHistory();
  const reminders = useReminders();
  const online = useOnline();
  const [genreId, setGenreId] = useState(null);
  const [tab, setTabState] = useState(savedTab); // all | movie | tv | free | soon
  const [dir, setDir] = useState('right');
  const tabsRef = useRef(null);
  const swipe = useRef(null);

  const trending = useMovies(() => tmdb.trending());
  const popular = useMovies(() => tmdb.popular());
  const topRated = useMovies(() => tmdb.topRated());
  const upcoming = useMovies(() => tmdb.upcoming());
  const tvPopular = useMovies(() => tmdb.tvPopular());
  const tvTopRated = useMovies(() => tmdb.tvTopRated());
  const genres = useMovies(() => tmdb.genres());
  const byGenre = useMovies(
    () => (genreId ? tmdb.byGenre(genreId) : Promise.resolve(null)),
    [genreId]
  );

  const genreList = genres.data?.genres || [];
  const genreMap = useMemo(
    () => Object.fromEntries(genreList.map((g) => [g.id, g.name])),
    [genreList]
  );
  const heroSource = tab === 'tv' ? tvPopular : trending;
  const heroMovies = (heroSource.data?.results || []).filter((m) => m.backdrop_path).slice(0, 5);
  const showMovies = tab !== 'tv';
  const showSeries = tab !== 'movie';
  const failed = trending.error && popular.error && topRated.error;

  const open = (item) =>
    whenOnline(() => navigate(`/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.id}`));
  const openHero = (item) => {
    recordView(item);
    open(item);
  };
  const setTab = (next) => {
    if (next === tab) return;
    setDir(TABS.findIndex((t) => t.id === next) < TABS.findIndex((t) => t.id === tab) ? 'left' : 'right');
    setTabState(next);
    if (next === 'tv') setGenreId(null);
    try {
      window.sessionStorage.setItem(TAB_KEY, next);
    } catch {
      /* storage unavailable */
    }
    document.querySelector('.app-content')?.scrollTo(0, 0);
  };

  // keep the chosen tab in view in the tab strip
  useEffect(() => {
    const strip = tabsRef.current;
    const el = strip?.querySelector('[aria-selected="true"]');
    if (!strip || !el) return;
    const left = el.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.scrollTo({ left: left - (strip.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [tab]);

  const onSwipeStart = (e) => {
    const t = e.touches[0];
    swipe.current = swipeBlocked(e.target, e.currentTarget) ? null : { x: t.clientX, y: t.clientY };
  };

  const onSwipeEnd = (e) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = TABS.findIndex((x) => x.id === tab);
    const next = TABS[i + (dx < 0 ? 1 : -1)];
    if (next) setTab(next.id);
  };

  const retry = () => {
    trending.reload();
    popular.reload();
    topRated.reload();
    upcoming.reload();
    tvPopular.reload();
    tvTopRated.reload();
    genres.reload();
  };

  return (
    <div className="page">
      <header className="home-header">
        <div className="home-brand">
          <BrandMark size={30} />
          <span>
            NEXUS<span className="accent">HD</span>
          </span>
        </div>
        <div className="home-actions">
          <button
            className="icon-btn home-bell"
            onClick={() => navigate('/soon')}
            aria-label="Coming soon and reminders"
          >
            <Bell size={24} />
            {reminders.waiting.length > 0 && <span className="home-dot" />}
          </button>
          <button className="icon-btn" onClick={() => navigate('/downloads')} aria-label="Downloads">
            <Download size={24} />
          </button>
        </div>
      </header>

      {tab !== 'free' && tab !== 'soon' && (
        <button className="home-search" onClick={() => navigate('/search')} aria-label="Search">
          <Search size={19} />
          <span>Search movies, series and more</span>
        </button>
      )}

      <div className="home-tabs" role="tablist" aria-label="Browse" ref={tabsRef}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="home-body" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
        <div key={tab} className={`home-panel ${dir === 'left' ? 'from-left' : 'from-right'}`}>
          {tab === 'free' ? (
            <div className="home-embed">
              <FreeFilms />
            </div>
          ) : tab === 'soon' ? (
            <div className="home-embed">
              <ComingSoon />
            </div>
          ) : failed ? (
            <EmptyState
              icon={WifiOff}
              title={online ? "Can't load movies" : 'No internet connection'}
              text={
                online
                  ? 'Check your connection and try again.'
                  : 'Connect to Wi-Fi or mobile data to see movies. Your downloads still play.'
              }
              actionLabel={online ? 'Try again' : 'Open Downloads'}
              onAction={online ? retry : () => navigate('/downloads')}
            />
          ) : (
            <>
              {!online && (
                <button className="offline-note" onClick={() => navigate('/downloads')}>
                  <WifiOff size={16} />
                  <span>
                    <b>You're offline</b> · showing what you saw last. Tap a title to see more.
                  </span>
                  <ChevronRight size={16} />
                </button>
              )}

              {heroSource.loading ? (
                <div className="skeleton hero-sk" />
              ) : heroMovies.length > 0 ? (
                <Hero key={tab} movies={heroMovies} genreMap={genreMap} onOpen={openHero} />
              ) : null}

              {showMovies && (
                <div className="chips" role="list">
                  {genres.loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="skeleton chip-sk" />
                      ))
                    : genreList.map((g) => (
                        <button
                          key={g.id}
                          role="listitem"
                          className={`chip ${genreId === g.id ? 'on' : ''}`}
                          onClick={() => setGenreId(genreId === g.id ? null : g.id)}
                        >
                          {g.name}
                        </button>
                      ))}
                </div>
              )}

              <ContinueRow
                onOpenFilm={(film) => navigate(`/free?play=${encodeURIComponent(film.id)}`)}
                onOpenSeries={(id) => whenOnline(() => navigate(`/tv/${id}`))}
              />

              {history.items.length > 0 && (
                <MovieRow
                  title="Recently Viewed"
                  movies={history.items}
                  loading={false}
                  onOpen={open}
                  actionLabel="Clear"
                  onAction={history.clear}
                />
              )}

              {showMovies && genreId && (
                <MovieRow
                  title={`${genreMap[genreId] || ''} Movies`}
                  movies={byGenre.data?.results}
                  loading={byGenre.loading}
                  onOpen={open}
                />
              )}

              {showMovies && (
                <MovieRow
                  title="Trending Movies"
                  movies={trending.data?.results}
                  loading={trending.loading}
                  onOpen={open}
                />
              )}
              {tab === 'all' && (
                <MovieRow
                  title="Popular Series"
                  movies={tvPopular.data?.results}
                  loading={tvPopular.loading}
                  onOpen={open}
                />
              )}
              {showMovies && (
                <MovieRow
                  title="Popular"
                  movies={popular.data?.results}
                  loading={popular.loading}
                  onOpen={open}
                />
              )}
              {tab === 'tv' && (
                <MovieRow
                  title="Popular Series"
                  movies={tvPopular.data?.results}
                  loading={tvPopular.loading}
                  onOpen={open}
                />
              )}
              {showMovies && (
                <MovieRow
                  title="Top Rated"
                  movies={topRated.data?.results}
                  loading={topRated.loading}
                  onOpen={open}
                />
              )}
              {showSeries && (
                <MovieRow
                  title="Top Rated Series"
                  movies={tvTopRated.data?.results}
                  loading={tvTopRated.loading}
                  onOpen={open}
                />
              )}
              {showMovies && (
                <MovieRow
                  title="Coming Soon"
                  movies={upcoming.data?.results}
                  loading={upcoming.loading}
                  onOpen={open}
                  onSeeAll={() => navigate('/soon')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
  }
