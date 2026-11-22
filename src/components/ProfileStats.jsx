import { useMemo, useState } from 'react';
import { Check, ChevronRight, Clock, Eye, Flame, Share2, Star, X } from 'lucide-react';
import { useReviews, useWatched } from '../services/mylists.js';
import {
  badgeFor,
  formatHours,
  summarize,
  useWatchStats,
} from '../services/watchStats.js';
import { shareLink } from '../services/share.js';
import { WEB_BASE } from '../services/links.js';
import { imageUrl } from '../services/tmdb.js';
import '../styles/stats.css';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function useStats() {
  const data = useWatchStats();
  const watched = useWatched();
  const reviews = useReviews();
  const stats = useMemo(
    () => summarize(data, watched.items, reviews.items),
    [data, watched.items, reviews.items]
  );
  return { stats, loading: watched.loading || reviews.loading };
}

/* The skeleton shown while your lists load */
export function StatsSkeleton() {
  return (
    <div className="st-card" aria-hidden="true">
      <div className="skeleton" style={{ width: 120, height: 16 }} />
      <div className="st-tiles">
        {[0, 1, 2].map((i) => (
          <div key={i} className="st-tile">
            <div className="skeleton" style={{ width: 40, height: 26 }} />
            <div className="skeleton" style={{ width: 54, height: 12, marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ values, labels, unit, highlight }) {
  const top = Math.max(...values, 0);
  return (
    <div className="st-bars" role="img" aria-label={`${unit} per month`}>
      {values.map((v, i) => (
        <div key={labels[i]} className={`st-bar ${i === highlight ? 'now' : ''}`}>
          <div className="st-bar-col">
            <span
              style={{ height: top ? `${Math.max(v > 0 ? 6 : 0, (v / top) * 100)}%` : '0%' }}
              title={`${labels[i]}: ${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}`}
            />
          </div>
          <b>{labels[i].slice(0, 1)}</b>
        </div>
      ))}
    </div>
  );
}

/* "Your year": the full summary */
export function YearSheet({ stats, onClose, onToast }) {
  const [metric, setMetric] = useState(stats.yearHours > 0 ? 'hours' : 'titles');
  const nothing = stats.yearTitles === 0 && stats.yearHours === 0 && stats.ratedYear === 0;
  const badge = badgeFor(stats.yearHours, stats.yearTitles);
  const month = new Date().getMonth();

  const share = async () => {
    const parts = [];
    if (stats.yearTitles) parts.push(plural(stats.yearTitles, 'title', 'titles') + ' watched');
    if (stats.yearHours > 0) parts.push(`${formatHours(stats.yearHours)} hours of film`);
    if (stats.fiveStars) parts.push(plural(stats.fiveStars, 'five-star rating', 'five-star ratings'));
    const result = await shareLink({
      title: `My ${stats.year} on NexusHD`,
      text: `My ${stats.year} on NexusHD: ${parts.join(' · ') || 'just getting started'}. ${badge}!`,
      url: WEB_BASE,
    });
    if (result === 'copied') onToast?.('Copied');
  };

  return (
    <div className="sheet-backdrop st-backdrop" onClick={onClose}>
      <div
        className="sheet st-sheet"
        role="dialog"
        aria-label={`Your ${stats.year}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-sheet-top">
          <span>{stats.year} in movies</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="st-scroll">
          <div className="st-hero">
            <span className="st-badge">
              <Star size={14} fill="currentColor" /> {badge}
            </span>
            <div className="st-big">
              <b>{formatHours(stats.yearHours)}</b>
              <span>hours watched</span>
            </div>
            <div className="st-hero-sub">
              {nothing
                ? 'Watch a free film or mark titles as watched, and your year fills up here.'
                : `${plural(stats.yearTitles, 'title', 'titles')} · ${plural(stats.activeDays, 'day', 'days')} of watching`}
            </div>
          </div>

          <div className="st-grid">
            <div className="st-cell">
              <Eye size={18} />
              <b>{stats.yearMovies}</b>
              <span>Movies</span>
            </div>
            <div className="st-cell">
              <Eye size={18} />
              <b>{stats.yearSeries}</b>
              <span>Series</span>
            </div>
            <div className="st-cell">
              <Flame size={18} />
              <b>{stats.streak.best}</b>
              <span>Best streak (days)</span>
            </div>
            <div className="st-cell">
              <Star size={18} />
              <b>{stats.average ? stats.average.toFixed(1) : '–'}</b>
              <span>Average rating</span>
            </div>
          </div>

          <div className="st-block">
            <div className="st-block-head">
              <h4>Month by month</h4>
              <div className="st-seg" role="tablist">
                <button
                  role="tab"
                  aria-selected={metric === 'hours'}
                  className={metric === 'hours' ? 'on' : ''}
                  onClick={() => setMetric('hours')}
                >
                  Hours
                </button>
                <button
                  role="tab"
                  aria-selected={metric === 'titles'}
                  className={metric === 'titles' ? 'on' : ''}
                  onClick={() => setMetric('titles')}
                >
                  Titles
                </button>
              </div>
            </div>
            <Bars
              values={metric === 'hours' ? stats.hoursByMonth : stats.titlesByMonth}
              labels={stats.months}
              unit={metric === 'hours' ? 'Hours' : 'Titles'}
              highlight={month}
            />
            {stats.busiest && (
              <p className="st-note">
                Your busiest month is <b>{stats.busiest}</b>.
              </p>
            )}
          </div>

          {stats.favourites.length > 0 && (
            <div className="st-block">
              <div className="st-block-head">
                <h4>Your top rated</h4>
              </div>
              <div className="st-favs">
                {stats.favourites.map((f) => (
                  <div className="st-fav" key={`${f.media_type}-${f.id}`}>
                    <span className="st-fav-img">
                      {f.poster_path ? (
                        <img src={imageUrl(f.poster_path, 'w185')} alt="" loading="lazy" />
                      ) : null}
                    </span>
                    <b>{f.title}</b>
                    <span className="st-fav-stars">
                      {Array.from({ length: f.rating }, (_, i) => (
                        <Star key={i} size={12} fill="currentColor" />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.streak.current > 0 && (
            <p className="st-note center">
              <Flame size={14} /> You are on a {plural(stats.streak.current, 'day', 'day')} watching streak.
            </p>
          )}
        </div>

        <button className="btn-primary st-share" onClick={share}>
          <Share2 size={18} /> Share my year
        </button>
      </div>
    </div>
  );
}

/* The card on the Profile page */
export default function ProfileStats({ onToast }) {
  const { stats, loading } = useStats();
  const [open, setOpen] = useState(false);

  if (loading) return <StatsSkeleton />;

  return (
    <>
      <button className="st-card" onClick={() => setOpen(true)} aria-label="Open your stats">
        <div className="st-card-head">
          <span>Your stats</span>
          <span className="st-more">
            {stats.year} <ChevronRight size={16} />
          </span>
        </div>
        <div className="st-tiles">
          <div className="st-tile">
            <Eye size={17} />
            <b>{stats.titles}</b>
            <span>Watched</span>
          </div>
          <div className="st-tile">
            <Clock size={17} />
            <b>{formatHours(stats.hours)}</b>
            <span>Hours</span>
          </div>
          <div className="st-tile">
            <Check size={17} />
            <b>{stats.yearTitles}</b>
            <span>In {stats.year}</span>
          </div>
        </div>
      </button>

      {open && <YearSheet stats={stats} onClose={() => setOpen(false)} onToast={onToast} />}
    </>
  );
  }
