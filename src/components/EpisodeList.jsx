import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, Star, Tv, WifiOff } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/series.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

function formatDate(iso, withYear = true) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

const seasonLabel = (s) => (s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`);

function EpisodesSkeleton() {
  return (
    <div className="ep-list" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="ep" key={i}>
          <div className="skeleton ep-thumb" />
          <div className="ep-body">
            <div className="skeleton" style={{ height: 15, width: '70%' }} />
            <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 9 }} />
            <div className="skeleton" style={{ height: 12, width: '90%', marginTop: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EpisodeList({ tvId, seasons = [], nextEpisode = null }) {
  const [savedSeason, setSavedSeason] = useLocalStorage('nexushd:season', {});
  const [watchedMap, setWatchedMap] = useLocalStorage('nexushd:watched-eps', {});
  const [open, setOpen] = useState(null);
  const chipsRef = useRef(null);

  // regular seasons first, then Specials
  const list = useMemo(
    () =>
      seasons
        .filter((s) => s.episode_count > 0)
        .sort((a, b) => {
          if (a.season_number === 0) return 1;
          if (b.season_number === 0) return -1;
          return a.season_number - b.season_number;
        }),
    [seasons]
  );

  const first = list.find((s) => s.season_number > 0) || list[0];
  const remembered = savedSeason[tvId];
  const selected = list.some((s) => s.season_number === remembered)
    ? remembered
    : first?.season_number;

  const season = useMovies(
    () => (selected === undefined ? Promise.resolve(null) : tmdb.tvSeason(tvId, selected)),
    [tvId, selected]
  );

  // keep the chosen season chip in view
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector('.season-chip.on');
    if (box && chip) {
      box.scrollTo({
        left: chip.offsetLeft - box.clientWidth / 2 + chip.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [selected]);

  useEffect(() => setOpen(null), [selected]);

  if (!list.length) return null;

  const current = list.find((s) => s.season_number === selected) || first;
  const episodes = season.data?.episodes || [];
  const today = todayIso();
  const watched = new Set(watchedMap[tvId] || []);
  const key = (e) => `${e.season_number}x${e.episode_number}`;
  const airedEpisodes = episodes.filter((e) => e.air_date && e.air_date <= today);
  const watchedHere = airedEpisodes.filter((e) => watched.has(key(e))).length;
  const allWatched = airedEpisodes.length > 0 && watchedHere === airedEpisodes.length;

  const toggleEpisode = (e) => {
    setWatchedMap((prev) => {
      const set = new Set(prev[tvId] || []);
      if (set.has(key(e))) set.delete(key(e));
      else set.add(key(e));
      return { ...prev, [tvId]: [...set] };
    });
  };

  const toggleSeason = () => {
    setWatchedMap((prev) => {
      const set = new Set(prev[tvId] || []);
      airedEpisodes.forEach((e) => (allWatched ? set.delete(key(e)) : set.add(key(e))));
      return { ...prev, [tvId]: [...set] };
    });
  };

  const nextDays = nextEpisode ? daysUntil(nextEpisode.air_date) : null;

  return (
    <section className="d-section episodes">
      <h2>Episodes</h2>

      {nextEpisode?.air_date && nextDays !== null && nextDays >= 0 && (
        <div className="next-ep">
          <Clock size={18} />
          <div>
            <strong>
              Next episode · S{nextEpisode.season_number} E{nextEpisode.episode_number}
            </strong>
            <span>
              {nextDays === 0
                ? 'Airs today'
                : nextDays === 1
                  ? 'Airs tomorrow'
                  : `Airs in ${nextDays} days`}{' '}
              · {formatDate(nextEpisode.air_date, false)}
            </span>
          </div>
        </div>
      )}

      <div className="season-chips" ref={chipsRef} role="tablist" aria-label="Seasons">
        {list.map((s) => (
          <button
            key={s.id || s.season_number}
            role="tab"
            aria-selected={s.season_number === selected}
            className={`season-chip ${s.season_number === selected ? 'on' : ''}`}
            onClick={() => setSavedSeason((prev) => ({ ...prev, [tvId]: s.season_number }))}
          >
            {seasonLabel(s)}
          </button>
        ))}
      </div>

      <div className="season-head">
        <div>
          <div className="season-title">{seasonLabel(current)}</div>
          <div className="season-sub">
            {current.episode_count} {current.episode_count === 1 ? 'episode' : 'episodes'}
            {current.air_date ? ` · ${current.air_date.slice(0, 4)}` : ''}
          </div>
        </div>
        {airedEpisodes.length > 0 && (
          <button className={`season-mark ${allWatched ? 'on' : ''}`} onClick={toggleSeason}>
            <CheckCheck size={16} />
            {allWatched ? 'Unmark all' : 'Mark all watched'}
          </button>
        )}
      </div>

      {airedEpisodes.length > 0 && (
        <div className="season-progress" aria-label="Season progress">
          <div className="season-bar">
            <span style={{ width: `${(watchedHere / airedEpisodes.length) * 100}%` }} />
          </div>
          <small>
            {watchedHere} of {airedEpisodes.length} watched
          </small>
        </div>
      )}

      {season.loading ? (
        <EpisodesSkeleton />
      ) : season.error ? (
        <div className="ep-error">
          <WifiOff size={22} />
          <p>Couldn't load the episodes.</p>
          <button className="btn-secondary" onClick={season.reload}>
            Try again
          </button>
        </div>
      ) : episodes.length === 0 ? (
        <div className="ep-error">
          <Tv size={22} />
          <p>No episode details yet.</p>
        </div>
      ) : (
        <ul className="ep-list">
          {episodes.map((e) => {
            const aired = e.air_date && e.air_date <= today;
            const isWatched = watched.has(key(e));
            const expanded = open === e.id;
            const still = imageUrl(e.still_path, 'w300');
            const days = !aired && e.air_date ? daysUntil(e.air_date) : null;
            return (
              <li key={e.id} className={`ep ${aired ? '' : 'soon'} ${isWatched ? 'seen' : ''}`}>
                <button
                  className="ep-main"
                  onClick={() => setOpen(expanded ? null : e.id)}
                  aria-expanded={expanded}
                >
                  <div className="ep-thumb">
                    {still ? (
                      <img src={still} alt="" loading="lazy" />
                    ) : (
                      <Tv size={22} />
                    )}
                    {e.runtime > 0 && <span className="ep-time">{e.runtime}m</span>}
                  </div>
                  <div className="ep-body">
                    <div className="ep-title">
                      <span className="ep-num">{e.episode_number}</span>
                      <span>{e.name || `Episode ${e.episode_number}`}</span>
                    </div>
                    <div className="ep-meta">
                      {aired ? (
                        <>
                          {formatDate(e.air_date)}
                          {e.vote_average > 0 && (
                            <span className="ep-rating">
                              <Star size={12} fill="currentColor" />
                              {e.vote_average.toFixed(1)}
                            </span>
                          )}
                        </>
                      ) : e.air_date ? (
                        <span className="ep-soon">
                          {days === 1 ? 'Tomorrow' : `Coming ${formatDate(e.air_date, false)}`}
                        </span>
                      ) : (
                        <span className="ep-soon">Date to be announced</span>
                      )}
                    </div>
                    {e.overview && (
                      <p className={`ep-overview ${expanded ? '' : 'clamp'}`}>{e.overview}</p>
                    )}
                  </div>
                </button>
                <button
                  className={`ep-check ${isWatched ? 'on' : ''}`}
                  onClick={() => toggleEpisode(e)}
                  disabled={!aired}
                  aria-pressed={isWatched}
                  aria-label={isWatched ? 'Mark as not watched' : 'Mark as watched'}
                >
                  <Check size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
