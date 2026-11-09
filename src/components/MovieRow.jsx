import { useState } from 'react';
import { ChevronRight, Film, Star } from 'lucide-react';
import { imageUrl } from '../services/tmdb.js';

export function MovieCard({ movie, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const src = imageUrl(movie.poster_path, 'w342');
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';

  return (
    <button className="movie-card" onClick={() => onOpen?.(movie)}>
      <div className="poster">
        {src ? (
          <img
            src={src}
            alt={movie.title}
            loading="lazy"
            className={loaded ? 'loaded' : ''}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="poster-fallback">
            <Film size={28} />
          </div>
        )}
        {movie.vote_average > 0 && (
          <span className="rating">
            <Star size={10} fill="currentColor" />
            {movie.vote_average.toFixed(1)}
          </span>
        )}
      </div>
      <div className="movie-title">{movie.title}</div>
      {year && <div className="movie-year">{year}</div>}
    </button>
  );
}

export default function MovieRow({ title, movies, loading, onOpen, onSeeAll }) {
  if (!loading && (!movies || movies.length === 0)) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {onSeeAll && (
          <button className="see-all" onClick={onSeeAll}>
            See All <ChevronRight size={16} />
          </button>
        )}
      </div>
      <div className="rail">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div className="movie-card" key={i}>
                <div className="poster-sk skeleton" />
                <div className="line-sk skeleton" />
              </div>
            ))
          : movies.map((m) => <MovieCard key={m.id} movie={m} onOpen={onOpen} />)}
      </div>
    </section>
  );
  }
