import { useEffect, useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';
import useContinue, { removeContinue } from '../hooks/useContinue.js';
import useHistory from '../hooks/useHistory.js';
import { tmdbRequest, imageUrl } from '../services/tmdb.js';
import { archiveThumb, formatClock } from '../services/archive.js';
import '../styles/continue.css';

const WATCHED_KEY = 'nexushd:watched-eps';
const HIDDEN_KEY = 'nexushd:continue-hidden';
const MAX_SERIES = 6;

function readJson(key) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// episodes ticked off in real seasons (Specials do not count)
const watchedCount = (watched, id) =>
  (watched[id] || []).filter((k) => !String(k).startsWith('0x')).length;

// how many episodes of a series are already out
function airedCount(show) {
  const seasons = (show.seasons || []).filter((s) => s.season_number > 0);
  const last = show.last_episode_to_air;
  if (last && last.season_number > 0) {
    const before = seasons
      .filter((s) => s.season_number < last.season_number)
      .reduce((n, s) => n + (s.episode_count || 0), 0);
    return before + (last.episode_number || 0);
  }
  return seasons.reduce((n, s) => n + (s.episode_count || 0), 0);
}

function Thumb({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={loaded ? 'loaded' : ''}
      onLoad={() => setLoaded(true)}
      onError={() => setBroken(true)}
    />
  );
}

function Card({ image, title, sub, percent, onOpen, onRemove, removeLabel }) {
  return (
    <div className="cont-card">
      <button className="cont-main" onClick={onOpen}>
        <div className="cont-thumb">
          <Thumb src={image} alt="" />
          <div className="cont-shade" />
          <span className="cont-play">
            <Play size={18} fill="currentColor" />
          </span>
          {percent > 0 && (
            <span className="cont-bar">
              <span style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
            </span>
          )}
        </div>
        <div className="cont-title">{title}</div>
        <div className="cont-sub">{sub}</div>
      </button>
      <button className="cont-remove" onClick={onRemove} aria-label={removeLabel}>
        <X size={14} />
      </button>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="cont-card" aria-hidden="true">
      <div className="skeleton cont-thumb" />
      <div className="skeleton" style={{ height: 13, width: '70%', marginTop: 9 }} />
      <div className="skeleton" style={{ height: 11, width: '45%', marginTop: 7 }} />
    </div>
  );
}

export default function ContinueRow({ onOpenFilm, onOpenSeries }) {
  const films = useContinue();
  const history = useHistory();
  const [watched] = useState(() => readJson(WATCHED_KEY));
  const [hidden, setHidden] = useState(() => readJson(HIDDEN_KEY));
  const [shows, setShows] = useState({});

  // series with at least one episode ticked off, the ones you opened lately first
  const seriesIds = useMemo(() => {
    const order = history.items.filter((m) => m.media_type === 'tv').map((m) => String(m.id));
    return Object.keys(watched)
      .filter((id) => watchedCount(watched, id) > 0)
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .slice(0, MAX_SERIES);
  }, [watched, history.items]);

  const idsKey = seriesIds.join(',');

  useEffect(() => {
    let cancelled = false;
    seriesIds
      .filter((id) => !(id in shows))
      .forEach((id) => {
        tmdbRequest(`tv/${id}`)
          .then((d) => !cancelled && setShows((s) => ({ ...s, [id]: d })))
          .catch(() => !cancelled && setShows((s) => ({ ...s, [id]: null })));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const loadingSeries = seriesIds.some((id) => !(id in shows));

  const seriesItems = seriesIds
    .map((id) => {
      const show = shows[id];
      if (!show) return null;
      const done = watchedCount(watched, id);
      const aired = airedCount(show);
      if (aired > 0 && done >= aired) return null; // caught up
      const sig = `${done}/${aired}`;
      if (hidden[id] === sig) return null; // removed from the row
      return { id, show, done, aired, sig };
    })
    .filter(Boolean);

  const hideSeries = (id, sig) => {
    const next = { ...hidden, [id]: sig };
    setHidden(next);
    try {
      window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  if (films.length === 0 && seriesItems.length === 0 && !loadingSeries) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Continue Watching</h2>
      </div>
      <div className="rail">
        {films.map((f) => {
          const left = f.duration ? Math.max(1, Math.round((f.duration - f.seconds) / 60)) : 0;
          return (
            <Card
              key={`film-${f.id}`}
              image={archiveThumb(f.id)}
              title={f.title}
              sub={`Resume at ${formatClock(f.seconds)}${left ? ` · ${left}m left` : ''}`}
              percent={f.duration ? (f.seconds / f.duration) * 100 : 0}
              onOpen={() => onOpenFilm(f)}
              onRemove={() => removeContinue(f.id)}
              removeLabel={`Remove ${f.title} from Continue Watching`}
            />
          );
        })}

        {seriesItems.map(({ id, show, done, aired, sig }) => {
          const left = aired > done ? aired - done : 0;
          const name = show.name || show.original_name || 'Series';
          return (
            <Card
              key={`tv-${id}`}
              image={imageUrl(show.backdrop_path, 'w300') || imageUrl(show.poster_path, 'w185')}
              title={name}
              sub={left ? `${left} episode${left === 1 ? '' : 's'} left` : `${done} watched`}
              percent={aired ? (done / aired) * 100 : 0}
              onOpen={() => onOpenSeries(id)}
              onRemove={() => hideSeries(id, sig)}
              removeLabel={`Remove ${name} from Continue Watching`}
            />
          );
        })}

        {loadingSeries && (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
      </div>
    </section>
  );
}
