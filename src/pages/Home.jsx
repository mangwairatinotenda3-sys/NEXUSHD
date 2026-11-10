import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Flame, WifiOff, Film, ChevronRight } from 'lucide-react';
import BrandMark from '../components/BrandMark.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MovieRow from '../components/MovieRow.jsx';
import useHistory, { recordView } from '../hooks/useHistory.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/home.css';
import '../styles/free.css';

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
              {genres && <div className="hero-meta">{genres}</div>}
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
  const [genreId, setGenreId] = useState(null);

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
  const heroMovies = (trending.data?.results || []).filter((m) => m.backdrop_path).slice(0, 5);
  const failed = trending.error && popular.error && topRated.error;

  const open = (item) => navigate(`/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.id}`);
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
        <button className="icon-btn" onClick={() => navigate('/search')} aria-label="Search">
          <Search size={24} />
        </button>
      </header>

      {failed ? (
        <EmptyState
          icon={WifiOff}
          title="Can't load movies"
          text="Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
        />
      ) : (
        <>
          {trending.loading ? (
            <div className="skeleton hero-sk" />
          ) : heroMovies.length > 0 ? (
            <Hero movies={heroMovies} genreMap={genreMap} onOpen={openHero} />
          ) : null}

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

          <button className="free-promo" onClick={() => navigate('/free')}>
            <span className="free-promo-icon">
              <Film size={24} />
            </span>
            <span className="free-promo-text">
              <strong>Free Films</strong>
              <span>Classic movies you can watch right here</span>
            </span>
            <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
          </button>

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

          {genreId && (
            <MovieRow
              title={`${genreMap[genreId] || ''} Movies`}
              movies={byGenre.data?.results}
              loading={byGenre.loading}
              onOpen={open}
            />
          )}

          <MovieRow
            title="Trending Movies"
            movies={trending.data?.results}
            loading={trending.loading}
            onOpen={open}
          />
          <MovieRow
            title="Popular"
            movies={popular.data?.results}
            loading={popular.loading}
            onOpen={open}
          />
          <MovieRow
            title="Popular Series"
            movies={tvPopular.data?.results}
            loading={tvPopular.loading}
            onOpen={open}
          />
          <MovieRow
            title="Top Rated"
            movies={topRated.data?.results}
            loading={topRated.loading}
            onOpen={open}
          />
          <MovieRow
            title="Top Rated Series"
            movies={tvTopRated.data?.results}
            loading={tvTopRated.loading}
            onOpen={open}
          />
          <MovieRow
            title="Coming Soon"
            movies={upcoming.data?.results}
            loading={upcoming.loading}
            onOpen={open}
          />
        </>
      )}
    </div>
  );
              }
