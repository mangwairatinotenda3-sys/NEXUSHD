import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fetchSubtitleVtt } from './subtitles.js';
import { ensureNotificationPermission, notifyDownload } from './notify.js';

/* Offline downloads. Files are saved in the browser's storage (IndexedDB) in
   4 MB pieces, so a download can be paused and resumed. On the web a download
   only runs while NexusHD is open. A download that was interrupted (app
   closed, connection lost) carries on by itself when NexusHD is opened again,
   up to three tries in a row, unless you paused it yourself. */

const DB_NAME = 'nexushd-offline';
const CHUNK_BYTES = 4 * 1024 * 1024;
const MIRROR_KEY = 'nexushd:downloads';
const MAX_AUTO_TRIES = 3;

export const downloadsSupported = () =>
  typeof indexedDB !== 'undefined' &&
  typeof ReadableStream !== 'undefined' &&
  typeof fetch === 'function';

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('downloads', { keyPath: 'id' });
        db.createObjectStore('chunks');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const finished = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const chunkRange = (id) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);

const records = new Map();
const controllers = new Map();
const listeners = new Set();
let state = { items: [], loading: true };
let lastMirror = '';

function emit(loading = state.loading) {
  const items = [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
  state = { items, loading };

  // Keeps a small list so other screens (like Profile) can show the count.
  const mirror = JSON.stringify(items.map((i) => ({ id: i.id, title: i.title })));
  if (mirror !== lastMirror) {
    lastMirror = mirror;
    try {
      window.localStorage.setItem(MIRROR_KEY, mirror);
    } catch {
      /* storage unavailable */
    }
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

async function putRecord(rec) {
  const db = await openDb();
  const tx = db.transaction('downloads', 'readwrite');
  tx.objectStore('downloads').put(rec);
  await finished(tx);
}

async function saveChunk(rec, index, blob) {
  const db = await openDb();
  const tx = db.transaction(['downloads', 'chunks'], 'readwrite');
  tx.objectStore('chunks').put(blob, [rec.id, index]);
  tx.objectStore('downloads').put(rec);
  await finished(tx);
}

async function deleteChunks(id) {
  const db = await openDb();
  const tx = db.transaction('chunks', 'readwrite');
  tx.objectStore('chunks').delete(chunkRange(id));
  await finished(tx);
}

async function deleteRecord(id) {
  const db = await openDb();
  const tx = db.transaction(['downloads', 'chunks'], 'readwrite');
  tx.objectStore('downloads').delete(id);
  tx.objectStore('chunks').delete(chunkRange(id));
  await finished(tx);
}

function patch(id, changes, persist = false) {
  const current = records.get(id);
  if (!current) return null;
  const next = { ...current, ...changes };
  records.set(id, next);
  emit();
  if (persist) putRecord(next).catch(() => {});
  return next;
}

function errorMessage(err) {
  const msg = String(err?.message || '');
  if (msg.startsWith('Not enough storage') || err?.name === 'QuotaExceededError') {
    return 'Not enough storage space on this device.';
  }
  if (msg.startsWith('The server')) return msg;
  if (err instanceof TypeError) return 'Could not download. Check your connection and try again.';
  return 'The download stopped. Try again.';
}

// a lost connection is worth trying again; a full phone or a refusing server is not
const isTransient = (message) =>
  !(message.startsWith('Not enough storage') || message.startsWith('The server'));

async function run(id) {
  if (!records.get(id) || controllers.has(id)) return;
  const controller = new AbortController();
  controllers.set(id, controller);
  patch(id, { status: 'downloading', error: '', resumeOnOpen: true }, true);

  let buffer = [];
  let bufferBytes = 0;
  let lastEmit = 0;

  const flush = async () => {
    const rec = records.get(id);
    if (!rec || !bufferBytes) return;
    const blob = new Blob(buffer);
    const next = {
      ...rec,
      stored: rec.stored + blob.size,
      bytes: rec.stored + blob.size,
      chunks: rec.chunks + 1,
      tries: 0,
    };
    await saveChunk(next, rec.chunks, blob);
    if (!records.has(id)) return;
    records.set(id, next);
    buffer = [];
    bufferBytes = 0;
    emit();
  };

  try {
    const start = records.get(id);
    const headers = start.stored > 0 ? { Range: `bytes=${start.stored}-` } : {};
    const res = await fetch(start.src, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`The server returned ${res.status}.`);

    if (start.stored > 0 && res.status !== 206) {
      // The server ignored the resume request, so start again from the beginning.
      await deleteChunks(id);
      patch(id, { stored: 0, bytes: 0, chunks: 0 });
    }

    const current = records.get(id);
    const length = Number(res.headers.get('content-length')) || 0;
    const total = length ? current.stored + length : current.size;
    if (total && total !== current.size) patch(id, { size: total });

    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota && total) {
      const free = estimate.quota - (estimate.usage || 0);
      if (free < total - current.stored + 50 * 1024 * 1024) {
        throw new Error('Not enough storage space');
      }
    }

    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer.push(value);
      bufferBytes += value.length;
      if (bufferBytes >= CHUNK_BYTES) await flush();
      const now = Date.now();
      if (now - lastEmit > 250) {
        lastEmit = now;
        const rec = records.get(id);
        if (!rec) return;
        patch(id, { bytes: rec.stored + bufferBytes });
      }
    }
    await flush();
    const done = records.get(id);
    if (done) {
      patch(
        id,
        {
          status: 'completed',
          bytes: done.stored,
          size: done.stored,
          completedAt: Date.now(),
          resumeOnOpen: false,
          tries: 0,
        },
        true
      );
      notifyDownload({
        key: id,
        title: 'Download finished',
        body: `${done.title} is ready to watch offline.`,
      });
    }
  } catch (err) {
    if (!controller.signal.aborted && records.has(id)) {
      const message = errorMessage(err);
      const transient = isTransient(message);
      const rec = records.get(id);
      patch(id, { status: 'error', error: message, bytes: rec.stored, resumeOnOpen: transient }, true);
      if (transient && (rec.tries || 0) < MAX_AUTO_TRIES) {
        // try again shortly, waiting a little longer each time
        setTimeout(() => resumeInterrupted(id), 2500 * ((rec.tries || 0) + 1));
      } else {
        notifyDownload({ key: id, title: 'Download stopped', body: `${rec.title}: ${message}` });
      }
    }
  } finally {
    controllers.delete(id);
  }
   }

async function init() {
  if (!downloadsSupported()) {
    emit(false);
    return;
  }
  try {
    const db = await openDb();
    const all = await request(db.transaction('downloads').objectStore('downloads').getAll());
    all.forEach((rec) => {
      rec.tries = 0;
      // A download that was running when the app closed is now paused.
      if (rec.status === 'downloading') {
        rec.status = 'paused';
        putRecord(rec).catch(() => {});
      }
      records.set(rec.id, rec);
    });
  } catch {
    /* storage blocked */
  }
  emit(false);
  resumeInterrupted();
}
init();

export async function startDownload(film) {
  if (!downloadsSupported() || !film?.src) return;
  const existing = records.get(film.id);
  if (existing) {
    if (existing.status !== 'completed') {
      patch(film.id, { tries: 0 });
      run(film.id);
    }
    return;
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not available */
  }
  const rec = {
    id: film.id,
    title: film.title,
    year: film.year || null,
    media_type: 'movie',
    src: film.src,
    size: film.sizeBytes || 0,
    seconds: film.seconds || 0,
    status: 'paused',
    bytes: 0,
    stored: 0,
    chunks: 0,
    error: '',
    subs: [],
    resumeOnOpen: false,
    tries: 0,
    createdAt: Date.now(),
  };
  records.set(rec.id, rec);
  emit();
  await putRecord(rec).catch(() => {});
  ensureNotificationPermission();
  run(rec.id);
  saveSubtitles(rec.id, film.subs);
}

/* Keeps the film's subtitles with the download so they work offline too */
async function saveSubtitles(id, subs = []) {
  const saved = [];
  for (const s of subs.slice(0, 3)) {
    try {
      saved.push({ label: s.label, text: await fetchSubtitleVtt(s.url) });
    } catch {
      /* this one is not available */
    }
  }
  if (saved.length && records.has(id)) patch(id, { subs: saved }, true);
}

/* auto = true when the app pauses it (for example, no connection): it then
   carries on by itself later. A pause from the person stays paused. */
export function pauseDownload(id, auto = false) {
  const rec = records.get(id);
  if (!rec) return;
  controllers.get(id)?.abort();
  patch(id, { status: 'paused', bytes: rec.stored, resumeOnOpen: auto, tries: 0 }, true);
}

export function resumeDownload(id) {
  const rec = records.get(id);
  if (!rec || rec.status === 'completed') return;
  patch(id, { tries: 0 });
  run(id);
}

export async function removeDownload(id) {
  controllers.get(id)?.abort();
  records.delete(id);
  emit();
  try {
    await deleteRecord(id);
  } catch {
    /* already gone */
  }
}

export async function clearDownloads() {
  await Promise.all([...records.keys()].map((id) => removeDownload(id)));
}

/* Returns a temporary address the video player can use. Call
   URL.revokeObjectURL() on it when the player closes. */
export async function getPlayableUrl(id) {
  const db = await openDb();
  const chunks = await request(
    db.transaction('chunks').objectStore('chunks').getAll(chunkRange(id))
  );
  if (!chunks.length) throw new Error('No saved data');
  return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
}

/* Starts again what was interrupted, without the person doing anything:
   downloads that were running when the app closed or the connection dropped. */
function resumeInterrupted(onlyId) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  records.forEach((rec) => {
    if (onlyId && rec.id !== onlyId) return;
    if (!rec.resumeOnOpen || rec.status === 'completed' || rec.status === 'downloading') return;
    if (controllers.has(rec.id) || (rec.tries || 0) >= MAX_AUTO_TRIES) return;
    patch(rec.id, { tries: (rec.tries || 0) + 1 });
    run(rec.id);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeInterrupted();
  });
  if (Capacitor.isNativePlatform()) App.addListener('resume', () => resumeInterrupted());
}

export default function useDownloads() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { items: snapshot.items, loading: snapshot.loading, supported: downloadsSupported() };
     }
