import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CalendarDays, Film, WifiOff } from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RemindSheet from '../components/RemindSheet.jsx';
import { genreLine } from '../services/genres.js';
import {
  countdownText,
  daysUntil,
  formatDay,
  formatFire,
  parseDay,
  useReminders,
  OFFSETS,
} from '../services/reminders.js';
import { tmdb, imageUrl } from '../services/tmdb.js';
import { whenOnline } from '../services/connection.js';
import '../styles/library.css';
import '../styles/mylists.css';
import '../styles/soon.css';

const TABS = [
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
  { id: 'reminders', label: 'My reminders' },
];

const WINDOW_DAYS = 150;
const MAX_PAGES = 5;

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Titles that are not out yet, soonest first. Pages are fetched most popular
   first, so the first page already holds the titles most people look for. */
function useUpcoming(kind) {
  const [state, setState] = useState({
    items: [],
    page: 0,
    totalPages: 1,
    loading: true,
    loadingMore: false,
    error: false,
  });
  const [tick, setTick] = useState(0);
  const kindRef = useRef(kind);
  kindRef.current = kind;

  const fetchPage = useCallback((page) => {
    const from = new Date();
    const to = new Date(Date.now() + WINDOW_DAYS * 86400000);
    const key = kind === 'tv' ? 'first_air_date' : 'primary_release_date';
    return tmdb.discover(
      kind,
      {
        [`${key}.gte`]: isoDay(from),
        [`${key}.lte`]: isoDay(to),
        sort_by: 'popularity.desc',
      },
      page
    );
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    setState({ items: [], page: 0, totalPages: 1, loading: true, loadingMore: false, error: false });
    fetchPage(1)
      .then((data) => {
        if (cancelled) return;
        setState({
          items: data.results || [],
          page: 1,
          totalPages: Math.min(data.total_pages || 1, MAX_PAGES),
          loading: false,
          loadingMore: false,
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, tick]);

  const loadMore = () => {
    if (state.loadingMore || state.page >= state.totalPages) return;
    const next = state.page + 1;
    setState((s) => ({ ...s, loadingMore: true }));
    fetchPage(next)
      .then((data) => {
        if (kindRef.current !== kind) return;
        setState((s) => {
          const seen = new Set(s.items.map((m) => m.id));
          return {
            ...s,
            items: [...s.items, ...(data.results || []).filter((m) => !seen.has(m.id))],
            page: next,
            loadingMore: false,
          };
        });
      })
      .catch(() => setState((s) => ({ ...s, loadingMore: false })));
  };

  return { ...state, loadMore, reload: () => setTick((t) => t + 1), hasMore: state.page < state.totalPages };
}

function groupLabel(days, date) {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return 'This week';
  if (days <= 14) return 'Next week';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function groupItems(items) {
  const usable = items
    .filter((m) => parseDay(m.release_date) && (m.poster_path || m.overview))
    .map((m) => ({ ...m, days: daysUntil(m.release_date) }))
    .filter((m) => m.days >= 0)
    .sort((a, b) => a.days - b.days || (b.popularity || 0) - (a.popularity || 0));
  const groups = [];
  usable.forEach((m) => {
    const label = groupLabel(m.days, parseDay(m.release_date));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  });
  return groups;
}

function Poster({ path }) {
  const [loaded, setLoaded] = useState(false);
  const src = imageUrl(path, 'w185');
  if (!src) {
    return (
      <div className="poster-fallback">
        <Film size={26} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={loaded ? 'loaded' : ''}
      onLoad={() => setLoaded(true)}
    />
  );
}

function SoonSkeleton() {
  return (
    <div className="soon-list" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="soon-card soon-sk">
          <div className="skeleton soon-thumb" />
          <div className="soon-info">
            <div className="skeleton" style={{ height: 12, width: '38%' }} />
            <div className="skeleton" style={{ height: 18, width: '75%', marginTop: 10 }} />
            <div className="skeleton" style={{ height: 12, width: '90%', marginTop: 12 }} />
            <div className="skeleton" style={{ height: 12, width: '60%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComingSoon() {
  const navigate = useNavigate();
  const reminders = useReminders();
  const [tab, setTab] = useState('movie');
  const [remind, setRemind] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const movies = useUpcoming('movie');
  const series = useUpcoming('tv');
  const current = tab === 'tv' ? series : movies;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  const groups = useMemo(() => groupItems(current.items), [current.items]);

  const open = (m) =>
    whenOnline(() => navigate(`/${m.media_type === 'tv' ? 'tv' : 'movie'}/${m.id}`));

  const myReminders = useMemo(
    () => [...reminders.items].sort((a, b) => a.fireAt - b.fireAt),
    [reminders.items]
  );

  const bell = (m) => {
    const set = reminders.get(m.id, m.media_type === 'tv' ? 'tv' : 'movie');
    return (
      <button
        className={`soon-bell ${set ? 'on' : ''}`}
        onClick={() => setRemind(m)}
        aria-label={set ? `Reminder set for ${m.title}` : `Remind me about ${m.title}`}
        aria-pressed={Boolean(set)}
      >
        {set ? <BellRing size={19} /> : <Bell size={19} />}
        <span>{set ? 'Reminder on' : 'Remind me'}</span>
      </button>
    );
  };

  const chips = (
    <div className="lib-chips" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={`lib-chip small ${tab === t.id ? 'on' : ''}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
          {t.id === 'reminders' && reminders.items.length > 0 && (
            <span className="ml-tab-n">{reminders.items.length}</span>
          )}
        </button>
      ))}
    </div>
  );

  let body;
  if (tab === 'reminders') {
    body =
      myReminders.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No reminders yet"
          text="Tap “Remind me” on a title that is coming soon and we will alert you on the day."
          actionLabel="See what's coming"
          onAction={() => setTab('movie')}
        />
      ) : (
        <div className="soon-list">
          {myReminders.map((r) => {
            const days = daysUntil(r.release_date);
            const out = days !== null && days < 0;
            const offset = OFFSETS.find((o) => o.id === r.offset);
            return (
              <article className="soon-card" key={r.key}>
                <button className="soon-thumb" onClick={() => open(r)} aria-label={`Open ${r.title}`}>
                  <Poster path={r.poster_path} />
                </button>
                <div className="soon-info">
                  <button className="soon-open" onClick={() => open(r)}>
                    <span className="soon-date">
                      <CalendarDays size={13} /> {formatDay(r.release_date, true)}
                    </span>
                    <span className="soon-title">{r.title}</span>
                    <span className={`soon-count ${out ? 'out' : ''}`}>{countdownText(r.release_date)}</span>
                  </button>
                  <span className="soon-when">
                    {out
                      ? 'It is out now'
                      : `${offset?.label || 'Reminder'} · ${formatFire(r.fireAt)}`}
                  </span>
                  <button className="soon-bell on" onClick={() => setRemind(r)}>
                    <BellRing size={19} />
                    <span>Change</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      );
  } else if (current.loading) {
    body = <SoonSkeleton />;
  } else if (current.error && current.items.length === 0) {
    body = (
      <EmptyState
        icon={WifiOff}
        title="Can't load this"
        text="Check your connection and try again."
        actionLabel="Try again"
        onAction={current.reload}
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        icon={CalendarDays}
        title="Nothing announced yet"
        text="New release dates show up here as soon as they are announced."
      />
    );
  } else {
    body = (
      <>
        {groups.map((g) => (
          <section className="soon-group" key={g.label}>
            <h2 className="soon-group-title">{g.label}</h2>
            <div className="soon-list">
              {g.items.map((m) => (
                <article className="soon-card" key={m.id}>
                  <button className="soon-thumb" onClick={() => open(m)} aria-label={`Open ${m.title}`}>
                    <Poster path={m.poster_path} />
                  </button>
                  <div className="soon-info">
                    <button className="soon-open" onClick={() => open(m)}>
                      <span className="soon-date">
                        <CalendarDays size={13} /> {formatDay(m.release_date)}
                      </span>
                      <span className="soon-title">{m.title}</span>
                      <span className="soon-count">{countdownText(m.release_date)}</span>
                      {m.overview && <span className="soon-text">{m.overview}</span>}
                      {genreLine(m) && <span className="soon-genres">{genreLine(m)}</span>}
                    </button>
                    {bell(m)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {current.hasMore && (
          <button className="soon-more" onClick={current.loadMore} disabled={current.loadingMore}>
            {current.loadingMore ? 'Loading…' : 'Show more'}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="page">
      <Header title="Coming soon" back />
      {chips}
      {body}

      {remind && (
        <RemindSheet
          movie={{ ...remind, media_type: remind.media_type === 'tv' ? 'tv' : 'movie' }}
          onClose={() => setRemind(null)}
          onToast={showToast}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
                        }
