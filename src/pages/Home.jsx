import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Flame, WifiOff, ChevronRight, Bell, Download, Star } from 'lucide-react';
import BrandMark from '../components/BrandMark.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MovieRow from '../components/MovieRow.jsx';
import ContinueRow from '../components/ContinueRow.jsx';
import useHistory, { recordView } from '../hooks/useHistory.js';
import useReminders from '../services/reminders.js';
import useOnline from '../hooks/useOnline.js';
import { whenOnline } from '../services/connection.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/home.css';
import '../styles/free.css';
import '../styles/soon.css';

function Hero({ movies, genreMap, onOpen }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);

  useEffect(() => {
    if (movies.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % movies.length), 6000);
    return () => clearInterval(timer);
  }, [movies.length, index]);

  const go = (dir) => setIndex((i) => (i + dir + movies.length) % movies.length);

  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="hero"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      {movies.map((m, i) => {
        const genres = (m.genre_ids || [])
          .slice(0, 2)
          .map((id) => genreMap[id])
          .filter(Boolean)
          .join(' · ');
        return (
          <div
            key={m.id}
            className={`hero-slide ${i === index ? 'active' : ''}`}
            aria-hidden={i !== index}
            onClick={() => onOpen(m)}
          >
            <img
              src={imageUrl(m.backdrop_path, 'w780')}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="hero-shade" />
            <div className="hero-body">
              <span className="badge-trending">
                <Flame size={13} /> Trending
              </span>
              <h2 className="hero-title">{m.title}</h2>
              <div className="hero-meta">
                {m.vote_average > 0 && (
                  <span className="hero-rate">
                    <Star size={13} fill="currentColor" /> {m.vote_average.toFixed(1)}
                  </span>
                )}
                {m.release_date && <span>{m.release_date.slice(0, 4)}</span>}
                {genres && <span>{genres}</span>}
              </div>
              <button
                className="btn-primary hero-btn"
                tabIndex={i === index ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(m);
                }}
              >
                <Play size={16} fill="currentColor" /> Watch Now
              </button>
            </div>
          </div>
        );
      })}
      <div className="hero-dots">
        {movies.map((m, i) => (
          <button
            key={m.id}
            className={i === index ? 'on' : ''}
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.title}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const history = useHistory();
  const reminders = useReminders();
  const online = useOnline();
  const [genreId, setGenreId] = useState(null);
  const [tab, setTab] = useState('all'); // all | movie | tv

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

      <button className="home-search" onClick={() => navigate('/search')} aria-label="Search">
        <Search size={19} />
        <span>Search movies, series and more</span>
      </button>

      <div className="home-tabs" role="tablist" aria-label="Browse">
        {[
          { id: 'all', label: 'For you' },
          { id: 'movie', label: 'Movies' },
          { id: 'tv', label: 'Series' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'tv') setGenreId(null);
            }}
          >
            {t.label}
          </button>
        ))}
        <button role="tab" aria-selected="false" onClick={() => navigate('/free')}>
          Free films
        </button>
        <button role="tab" aria-selected="false" onClick={() => navigate('/soon')}>
          Coming soon
        </button>
      </div>

      {failed ? (
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
  );
                            }
