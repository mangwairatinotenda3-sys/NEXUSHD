import { useSyncExternalStore } from 'react';

/* "Continue watching": films from Free Films that you started and have not
   finished. Kept on this device only. Series are worked out from the episodes
   you ticked off, so they are not stored here. */

const KEY = 'nexushd:continue';
const MAX = 12;
const FINISHED_MARGIN = 60; // seconds before the end that count as finished

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

/* Called while a film plays. Under 10 seconds, or within the last minute, the
   film is taken off the list (not started, or finished). */
export function recordFilmProgress(film, seconds) {
  if (!film || !film.id) return;
  const existing = items.find((i) => i.id === film.id);
  const duration = film.seconds || existing?.duration || 0;
  const finished = duration > 0 && seconds >= duration - FINISHED_MARGIN;

  if (seconds < 10 || finished) {
    if (existing) commit(items.filter((i) => i.id !== film.id));
    return;
  }

  const entry = {
    kind: 'film',
    id: film.id,
    title: film.title,
    year: film.year || null,
    seconds: Math.floor(seconds),
    duration,
    updatedAt: Date.now(),
  };
  commit([entry, ...items.filter((i) => i.id !== film.id)].slice(0, MAX));
}

export function removeContinue(id) {
  commit(items.filter((i) => i.id !== id));
}

export default function useContinue() {
  return useSyncExternalStore(subscribe, () => items);
}
