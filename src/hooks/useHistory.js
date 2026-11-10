import { useSyncExternalStore } from 'react';

/* Remembers the last titles you opened, on this device only. */

const KEY = 'nexushd:recent-views';
const MAX = 20;

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

export function recordView(movie) {
  if (!movie || !movie.id) return;
  const type = movie.media_type === 'tv' ? 'tv' : 'movie';
  const entry = {
    id: movie.id,
    media_type: type,
    title: movie.title,
    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
    release_date: movie.release_date || null,
    vote_average: movie.vote_average ?? null,
  };
  const rest = items.filter((m) => !(m.id === entry.id && (m.media_type || 'movie') === type));
  commit([entry, ...rest].slice(0, MAX));
}

export function clearViews() {
  commit([]);
}

export default function useHistory() {
  const snapshot = useSyncExternalStore(subscribe, () => items);
  return { items: snapshot, clear: clearViews };
}
