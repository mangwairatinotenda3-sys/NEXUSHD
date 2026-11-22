import { useSyncExternalStore } from 'react';

/* What you watch inside NexusHD, kept on this phone: minutes per day, and
   which free films you finished. It feeds "Your stats" on the Profile. */

const KEY = 'nexushd:watch-stats';
const MAX_TITLES = 400;
const FINISHED_MARGIN = 60; // seconds before the end that count as finished

const empty = () => ({ days: {}, titles: {} });

function read() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY));
    return {
      days: v && typeof v.days === 'object' && v.days ? v.days : {},
      titles: v && typeof v.titles === 'object' && v.titles ? v.titles : {},
    };
  } catch {
    return empty();
  }
}

let stats = read();
const listeners = new Set();

function commit(next) {
  stats = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const dayKey = (time = Date.now()) => {
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function trim(titles) {
  const keys = Object.keys(titles);
  if (keys.length <= MAX_TITLES) return titles;
  const keep = keys.sort((a, b) => (titles[b].last || 0) - (titles[a].last || 0)).slice(0, MAX_TITLES);
  return Object.fromEntries(keep.map((k) => [k, titles[k]]));
}

/* Called by the player with the seconds of film really watched */
export function addWatchTime(title, seconds) {
  const secs = Math.round(seconds);
  if (!title || !(secs > 0)) return;
  const today = dayKey();
  const prev = stats.titles[title] || { seconds: 0, finished: 0, last: 0 };
  commit({
    days: { ...stats.days, [today]: (stats.days[today] || 0) + secs },
    titles: trim({
      ...stats.titles,
      [title]: { ...prev, seconds: prev.seconds + secs, last: Date.now() },
    }),
  });
}

export function markFinished(title) {
  if (!title) return;
  const prev = stats.titles[title] || { seconds: 0, finished: 0, last: 0 };
  // a film counts once a day, so a replay does not pile up
  if (prev.finished && dayKey(prev.finished) === dayKey()) return;
  commit({
    ...stats,
    titles: trim({ ...stats.titles, [title]: { ...prev, finished: Date.now(), last: Date.now() } }),
  });
}

export const FINISHED_AT = FINISHED_MARGIN;

export function clearWatchStats() {
  commit(empty());
}

export function useWatchStats() {
  return useSyncExternalStore(subscribe, () => stats);
}

/* ---------- the numbers on the Profile ---------- */

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function streaks(keys) {
  const days = [...new Set(keys)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  days.forEach((k) => {
    const t = new Date(`${k}T12:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  });
  // the run that is still going: it must include today or yesterday
  let current = 0;
  const set = new Set(days);
  const cursor = new Date();
  if (!set.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(dayKey(cursor.getTime()))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { best, current };
}

/* watched: titles marked as watched. reviews: your ratings. */
export function summarize(data, watched = [], reviews = [], year = new Date().getFullYear()) {
  const prefix = `${year}-`;
  const dayEntries = Object.entries(data.days);

  const seconds = dayEntries.reduce((n, [, s]) => n + s, 0);
  const yearDays = dayEntries.filter(([k]) => k.startsWith(prefix));
  const yearSeconds = yearDays.reduce((n, [, s]) => n + s, 0);

  const hoursByMonth = Array(12).fill(0);
  yearDays.forEach(([k, s]) => {
    hoursByMonth[Number(k.slice(5, 7)) - 1] += s / 3600;
  });

  const inYear = (ms) => ms && new Date(ms).getFullYear() === year;
  const watchedThisYear = watched.filter((w) => inYear(w.watchedAt));
  const titlesByMonth = Array(12).fill(0);
  watchedThisYear.forEach((w) => {
    titlesByMonth[new Date(w.watchedAt).getMonth()] += 1;
  });

  // free films you finished that you did not also mark as watched
  const marked = new Set(watched.map((w) => normalize(w.title)));
  const finished = Object.entries(data.titles)
    .filter(([, t]) => t.finished)
    .map(([title, t]) => ({ title, at: t.finished }));
  const extra = finished.filter((f) => !marked.has(normalize(f.title)));
  const extraThisYear = extra.filter((f) => inYear(f.at));
  extraThisYear.forEach((f) => {
    titlesByMonth[new Date(f.at).getMonth()] += 1;
  });

  const movies = watched.filter((w) => w.media_type !== 'tv').length + extra.length;
  const series = watched.filter((w) => w.media_type === 'tv').length;
  const moviesYear = watchedThisYear.filter((w) => w.media_type !== 'tv').length + extraThisYear.length;
  const seriesYear = watchedThisYear.filter((w) => w.media_type === 'tv').length;

  const rated = reviews.filter((r) => r.rating > 0);
  const ratedYear = rated.filter((r) => inYear(r.updatedAt));
  const average = rated.length ? rated.reduce((n, r) => n + r.rating, 0) / rated.length : 0;
  const favourites = [...rated]
    .sort((a, b) => b.rating - a.rating || (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 3);

  const titlesByMonthTotal = titlesByMonth.reduce((n, v) => n + v, 0);
  const metric = yearSeconds > 0 ? hoursByMonth : titlesByMonth;
  const top = Math.max(...metric);
  const busiest = top > 0 ? MONTHS[metric.indexOf(top)] : '';

  return {
    year,
    hours: seconds / 3600,
    yearHours: yearSeconds / 3600,
    titles: movies + series,
    movies,
    series,
    yearTitles: moviesYear + seriesYear,
    yearMovies: moviesYear,
    yearSeries: seriesYear,
    activeDays: yearDays.length,
    streak: streaks(dayEntries.map(([k]) => k)),
    hoursByMonth,
    titlesByMonth,
    titlesByMonthTotal,
    busiest,
    ratedCount: rated.length,
    ratedYear: ratedYear.length,
    fiveStars: rated.filter((r) => r.rating === 5).length,
    average,
    favourites,
    months: MONTHS,
  };
}

/* A short label for how much you watched this year */
export function badgeFor(hours, titles) {
  const score = Math.max(hours, titles * 1.6);
  if (score >= 120) return 'Movie legend';
  if (score >= 60) return 'Cinephile';
  if (score >= 25) return 'Movie buff';
  if (score >= 8) return 'Regular';
  if (score > 0) return 'Just getting started';
  return 'Ready when you are';
}

export function formatHours(hours) {
  if (hours >= 100) return String(Math.round(hours));
  if (hours >= 10) return hours.toFixed(0);
  if (hours > 0 && hours < 0.1) return '<0.1';
  return hours.toFixed(1).replace(/\.0$/, '');
}
