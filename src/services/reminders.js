import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ensureNotificationPermission, notificationsEnabled } from './notify.js';

/* "Remind me" for films and series that are not out yet. The reminder is an
   alert made by the phone itself (no server, no account). Tapping it opens the
   title. On the web the reminder is only saved, because a website cannot show
   an alert when it is closed. */

const KEY = 'nexushd:reminders';
const CHANNEL = 'reminders';
const HOUR = 9; // alerts arrive at 9:00 in the morning
const native = Capacitor.isNativePlatform();

export const OFFSETS = [
  { id: 'day', label: 'On release day', days: 0 },
  { id: '1d', label: 'The day before', days: 1 },
  { id: '1w', label: 'A week before', days: 7 },
];

/* "2026-12-18" as a date on this phone's calendar, or null */
export function parseDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/* Whole days from today until the release (0 = today, negative = already out) */
export function daysUntil(releaseDate) {
  const day = parseDay(releaseDate);
  if (!day) return null;
  return Math.round((day.getTime() - startOfToday().getTime()) / 86400000);
}

export const isUnreleased = (releaseDate) => {
  const n = daysUntil(releaseDate);
  return n !== null && n > 0;
};

export function fireTime(releaseDate, offsetId) {
  const day = parseDay(releaseDate);
  const offset = OFFSETS.find((o) => o.id === offsetId);
  if (!day || !offset) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset.days, HOUR, 0, 0).getTime();
}

export function countdownText(releaseDate) {
  const n = daysUntil(releaseDate);
  if (n === null) return '';
  if (n < 0) return 'Out now';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 14) return `In ${n} days`;
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30)} months`;
}

export function formatDay(releaseDate, withYear = false) {
  const day = parseDay(releaseDate);
  if (!day) return '';
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatFire(ms) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ---------- saved reminders ---------- */

function read() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let items = read();
const listeners = new Set();

function commit(next) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const typeOf = (m) => (m?.media_type === 'tv' ? 'tv' : 'movie');
const keyOf = (id, type) => `${type}-${id}`;

// alert ids must be whole numbers
const idFor = (key) => {
  let hash = 11;
  for (const ch of String(key)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 2147483000) + 1;
};

export const getReminder = (id, type = 'movie') =>
  items.find((r) => r.key === keyOf(id, type)) || null;

function wording(rec) {
  const tv = rec.media_type === 'tv';
  const verb = tv ? 'premieres' : 'comes out';
  if (rec.offset === 'day') return `${rec.title} ${tv ? 'premieres' : 'is out'} today`;
  if (rec.offset === '1d') return `${rec.title} ${verb} tomorrow`;
  return `${rec.title} ${verb} in a week`;
}

async function schedule(rec) {
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Release reminders',
    description: 'Reminders for the films and series you chose',
    importance: 4,
    visibility: 1,
  }).catch(() => {});
  await LocalNotifications.cancel({ notifications: [{ id: rec.notifId }] }).catch(() => {});
  await LocalNotifications.schedule({
    notifications: [
      {
        id: rec.notifId,
        title: wording(rec),
        body: 'Tap to see where to watch it.',
        channelId: CHANNEL,
        schedule: { at: new Date(rec.fireAt), allowWhileIdle: true },
        extra: { route: `/${rec.media_type}/${rec.id}` },
      },
    ],
  });
}

/* Result: 'ok' (alert is set), 'web' (saved, but a website cannot alert),
   'off' (Notifications is switched off in Settings), 'denied' (Android blocks
   alerts), 'past' (that time has gone) or 'nodate' (no release date known) */
export async function setReminder(movie, offsetId) {
  const date = movie.release_date;
  const at = fireTime(date, offsetId);
  if (at === null) return 'nodate';
  if (at <= Date.now() + 30000) return 'past';

  const type = typeOf(movie);
  const rec = {
    key: keyOf(movie.id, type),
    id: Number(movie.id),
    media_type: type,
    title: movie.title || movie.name || 'Untitled',
    poster_path: movie.poster_path || null,
    release_date: date,
    offset: offsetId,
    fireAt: at,
    notifId: idFor(keyOf(movie.id, type)),
  };

  if (native) {
    if (!notificationsEnabled()) return 'off';
    if ((await ensureNotificationPermission()) !== 'granted') return 'denied';
    try {
      await schedule(rec);
    } catch {
      return 'denied';
    }
  }
  commit([rec, ...items.filter((r) => r.key !== rec.key)]);
  return native ? 'ok' : 'web';
}

export async function removeReminder(id, type = 'movie') {
  const rec = getReminder(id, type);
  if (!rec) return;
  if (native) {
    await LocalNotifications.cancel({ notifications: [{ id: rec.notifId }] }).catch(() => {});
  }
  commit(items.filter((r) => r.key !== rec.key));
}

/* A release date can move. When a title is opened and its date changed, the
   alert follows it. */
export async function followReleaseDate(movie) {
  const rec = getReminder(movie.id, typeOf(movie));
  if (!rec || !movie.release_date || movie.release_date === rec.release_date) return;
  const result = await setReminder(movie, rec.offset);
  if (result === 'past' || result === 'nodate') await removeReminder(movie.id, typeOf(movie));
}

export function useReminders() {
  const snapshot = useSyncExternalStore(subscribe, () => items);
  return {
    items: snapshot,
    get: (id, type = 'movie') => snapshot.find((r) => r.key === keyOf(id, type)) || null,
    // reminders still waiting for their day
    waiting: snapshot.filter((r) => isUnreleased(r.release_date) || daysUntil(r.release_date) === 0),
  };
}

export default useReminders;
