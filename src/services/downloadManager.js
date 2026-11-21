import { useSyncExternalStore } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fetchSubtitleVtt } from './subtitles.js';
import { ensureNotificationPermission, notifyDownload } from './notify.js';
import { blockedByWifiOnly, networkReady, subscribeNetwork } from './network.js';

/* Offline downloads. Files are saved in the browser's storage (IndexedDB) in
   pieces, so a download can be paused and resumed. A download only runs
   while NexusHD is open. A download that was interrupted (app closed,
   connection lost) carries on by itself when NexusHD is opened again, up to
   three tries in a row, unless you paused it yourself.

   In the Android app the file is cut into 512 KB blocks and several blocks are
   downloaded at the same time over separate connections, using the phone's
   own network layer (CapacitorHttp). The Internet Archive limits the speed of
   each single connection, so this is much faster than one connection. Each
   finished block is saved straight away, so pausing or losing the connection
   never loses finished blocks. A browser would block these requests: the
   Internet Archive does not allow other websites to read its files, so
   downloads are for the Android app.

   With "Download on Wi-Fi only" switched on, downloads wait while the phone is
   on mobile data and carry on by themselves when Wi-Fi is back. A download the
   person starts by hand with "Download anyway" is allowed to use mobile data. */

const DB_NAME = 'nexushd-offline';
const CHUNK_BYTES = 4 * 1024 * 1024;
const MIRROR_KEY = 'nexushd:downloads';
const MAX_AUTO_TRIES = 3;
// Android: the file is split into blocks that are fetched in parallel.
const BLOCK = 512 * 1024;
const PARALLEL = 6;

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
// downloads the person chose to run on mobile data even with Wi-Fi only on
const forced = new Set();
// recent finished blocks per download, used to work out the speed
const meters = new Map();
const SPEED_WINDOW = 6000;
const listeners = new Set();
let state = { items: [], loading: true };
let lastMirror = '';

/* Stops a running download at once and frees its place, so Resume works right
   away. The stopped run may take a moment to notice; it throws its unfinished
   blocks away and never touches the run that replaces it. */
function release(id) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  meters.delete(id);
}

function noteBytes(id, count) {
  const now = Date.now();
  let meter = meters.get(id);
  if (!meter) {
    meter = [];
    meters.set(id, meter);
  }
  meter.push({ t: now, b: count });
  while (meter.length && meter[0].t < now - SPEED_WINDOW) meter.shift();
}

/* bytes per second over the last few seconds, 0 when nothing is arriving */
function speedOf(rec) {
  if (rec.status !== 'downloading') return 0;
  const meter = meters.get(rec.id);
  if (!meter || meter.length < 2) return 0;
  const last = meter[meter.length - 1];
  if (Date.now() - last.t > 4000) return 0;
  const span = (last.t - meter[0].t) / 1000;
  if (span < 0.5) return 0;
  let bytes = 0;
  for (let i = 1; i < meter.length; i += 1) bytes += meter[i].b;
  return bytes / span;
}

function emit(loading = state.loading) {
  const items = [...records.values()]
    .map((rec) => ({ ...rec, speed: speedOf(rec) }))
    .sort((a, b) => b.createdAt - a.createdAt);
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

const NO_CONNECTION = 'Could not download. Check your connection and try again.';

function errorMessage(err) {
  const msg = String(err?.message || '');
  if (msg.startsWith('Not enough storage') || err?.name === 'QuotaExceededError') {
    return 'Not enough storage space on this device.';
  }
  if (msg.startsWith('The server')) return msg;
  if (Capacitor.isNativePlatform()) return NO_CONNECTION;
  if (err instanceof TypeError) {
    return navigator.onLine === false
      ? NO_CONNECTION
      : 'This browser blocked the download. Use the NexusHD Android app to download films.';
  }
  return 'The download stopped. Try again.';
}

// a lost connection is worth trying again; a full phone, a refusing server
// or a blocking browser is not
const isTransient = (message) =>
  !(
    message.startsWith('Not enough storage') ||
    message.startsWith('The server') ||
    message.startsWith('This browser')
  );

async function ensureSpace(remaining) {
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota && remaining) {
    const free = estimate.quota - (estimate.usage || 0);
    if (free < remaining + 50 * 1024 * 1024) throw new Error('Not enough storage space');
  }
}

const headerOf = (headers = {}, name) => {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key]) : '';
};

function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* The Internet Archive answers with a redirect to the server that really holds
   the file. Following it once here saves a round trip for every block. If
   anything goes wrong we simply keep the original address. */
async function resolveUrl(src) {
  let url = src;
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      const res = await CapacitorHttp.request({
        url,
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        disableRedirects: true,
        responseType: 'text',
        connectTimeout: 20000,
        readTimeout: 30000,
      });
      if (res.status >= 300 && res.status < 400) {
        const location = headerOf(res.headers, 'location');
        if (!location) break;
        url = new URL(location, url).toString();
        continue;
      }
      break;
    }
  } catch {
    return url;
  }
  return url;
}

const isFatal = (err) =>
  /^(The server|Not enough storage)/.test(String(err?.message || '')) ||
  err?.name === 'QuotaExceededError';

  /* Android app. Returns true when the whole file is saved, false when it was
   paused or removed on the way. */
async function downloadNative(id, controller) {
  let rec = records.get(id);
  if (!rec) return false;

  // data saved by an older, one-piece-at-a-time version cannot be mixed with blocks
  if (rec.block !== BLOCK && (rec.stored > 0 || rec.chunks > 0)) {
    await deleteChunks(id);
    rec = patch(id, { stored: 0, bytes: 0, chunks: 0, done: [], block: 0, blocks: 0 }, true);
  }

  const url = await resolveUrl(rec.src);
  const resolved = url !== rec.src;
  if (controller.signal.aborted || !records.has(id)) return false;

  // Finished blocks are saved one after the other, so the saved record always
  // lists every block that is really stored.
  let chain = Promise.resolve();
  const commit = (index, bytes, extra = {}) => {
    const job = async () => {
      const cur = records.get(id);
      if (!cur) return;
      const done = cur.done || [];
      if (done.includes(index)) return;
      const next = {
        ...cur,
        ...extra,
        done: [...done, index],
        stored: cur.stored + bytes.length,
        bytes: cur.stored + bytes.length,
        chunks: cur.chunks + 1,
        tries: 0,
      };
      await saveChunk(next, index, new Blob([bytes], { type: 'video/mp4' }));
      if (!records.has(id)) return;
      records.set(id, next);
      noteBytes(id, bytes.length);
      emit();
    };
    const p = chain.then(job);
    chain = p.catch(() => {});
    return p;
  };

  // block 0 first: it tells us how big the file is and shows progress quickly
  if (!(rec.done || []).includes(0) || !rec.size || !rec.blocks) {
    const res = await CapacitorHttp.request({
      url,
      method: 'GET',
      headers: { Range: `bytes=0-${BLOCK - 1}` },
      responseType: 'blob',
      connectTimeout: 30000,
      readTimeout: 120000,
    });
    if (controller.signal.aborted || !records.has(id)) return false;
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`The server returned ${res.status}.`);
    }
    const bytes = base64ToBytes(res.data || '');
    if (!bytes.length) throw new Error('The server returned an empty file.');
    const match = /\/(\d+)\s*$/.exec(headerOf(res.headers, 'content-range'));
    const ranged = res.status === 206 && match;
    const total = ranged ? Number(match[1]) : bytes.length;
    await ensureSpace(total);
    await commit(0, bytes, {
      size: total,
      block: BLOCK,
      // a server that ignores ranges sends the whole file at once
      blocks: ranged ? Math.ceil(total / BLOCK) : 1,
    });
    if (controller.signal.aborted || !records.has(id)) return false;
  }

  rec = records.get(id);
  const total = rec.size;
  const blocks = rec.blocks;
  const have = new Set(rec.done || []);
  const queue = [];
  for (let i = 0; i < blocks; i += 1) if (!have.has(i)) queue.push(i);

  const getBlock = async (index) => {
    const from = index * BLOCK;
    const to = Math.min(total, from + BLOCK) - 1;
    const res = await CapacitorHttp.request({
      url,
      method: 'GET',
      headers: { Range: `bytes=${from}-${to}` },
      responseType: 'blob',
      connectTimeout: 30000,
      readTimeout: 120000,
    });
    if (controller.signal.aborted || !records.has(id)) return;
    if (res.status === 200) throw new Error('The server does not allow resuming this download.');
    if (res.status !== 206) {
      // an expired address, or a busy server, is worth another try
      const again = res.status === 429 || res.status >= 500 || (resolved && res.status >= 400);
      if (again) throw new Error('Busy');
      throw new Error(`The server returned ${res.status}.`);
    }
    const bytes = base64ToBytes(res.data || '');
    if (bytes.length !== to - from + 1) throw new Error('Incomplete block');
    await commit(index, bytes);
  };

  let failure = null;
  const worker = async () => {
    while (!failure && !controller.signal.aborted) {
      const index = queue.shift();
      if (index === undefined) return;
      for (let attempt = 1; ; attempt += 1) {
        try {
          await getBlock(index);
          break;
        } catch (err) {
          if (controller.signal.aborted || !records.has(id)) return;
          if (isFatal(err) || attempt >= 3) {
            failure = failure || err;
            return;
          }
          await wait(800 * attempt);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
  await chain;
  if (controller.signal.aborted || !records.has(id)) return false;
  if (failure) throw failure;
  return (records.get(id).done || []).length >= blocks;
}

async function run(id, force = false) {
  if (!records.get(id) || controllers.has(id)) return;
  if (force) forced.add(id);
  if (!forced.has(id) && blockedByWifiOnly()) {
    // Wi-Fi only and on mobile data: wait, and carry on by itself on Wi-Fi
    patch(id, { status: 'paused', waitingWifi: true, resumeOnOpen: true, error: '' }, true);
    return;
  }
  const controller = new AbortController();
  controllers.set(id, controller);
  patch(id, { status: 'downloading', error: '', resumeOnOpen: true, waitingWifi: false }, true);

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
    // paused while saving: drop this piece, the next run fetches it again
    if (!records.has(id) || controller.signal.aborted) return;
    records.set(id, next);
    buffer = [];
    bufferBytes = 0;
    emit();
  };

  const viaWeb = async () => {
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

    await ensureSpace(total ? total - current.stored : 0);

    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer.push(value);
      bufferBytes += value.length;
      noteBytes(id, value.length);
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
  };

  try {
    if (Capacitor.isNativePlatform()) {
      if (!(await downloadNative(id, controller))) return;
    } else {
      await viaWeb();
    }
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
          waitingWifi: false,
          tries: 0,
        },
        true
      );
      forced.delete(id);
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
    // only clean up after this run: a newer run may already have taken over
    if (controllers.get(id) === controller) {
      controllers.delete(id);
      meters.delete(id);
    }
    emit();
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
      rec.waitingWifi = Boolean(rec.waitingWifi);
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
  // wait for the first reading of the connection, so nothing restarts on
  // mobile data by mistake when Wi-Fi only is on
  await networkReady.catch(() => {});
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
    waitingWifi: false,
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
    block: 0,
    blocks: 0,
    done: [],
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
  if (!auto) forced.delete(id);
  release(id);
  patch(
    id,
    { status: 'paused', bytes: rec.stored, resumeOnOpen: auto, waitingWifi: false, tries: 0 },
    true
  );
}

/* The phone moved to mobile data while Wi-Fi only is on */
function pauseForWifi(id) {
  const rec = records.get(id);
  if (!rec) return;
  release(id);
  patch(
    id,
    { status: 'paused', bytes: rec.stored, resumeOnOpen: true, waitingWifi: true, tries: 0 },
    true
  );
  notifyDownload({
    key: `wifi-${id}`,
    title: 'Waiting for Wi-Fi',
    body: `${rec.title} will carry on when you are on Wi-Fi.`,
  });
}

/* force = true when the person taps "Download anyway": it may use mobile data */
export function resumeDownload(id, force = false) {
  const rec = records.get(id);
  if (!rec || rec.status === 'completed') return;
  patch(id, { tries: 0, waitingWifi: false });
  run(id, force);
}

export async function removeDownload(id) {
  release(id);
  forced.delete(id);
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

/* Deletes the finished films and keeps what is still downloading */
export async function removeCompleted() {
  const done = [...records.values()].filter((r) => r.status === 'completed');
  await Promise.all(done.map((r) => removeDownload(r.id)));
}

/* How much room the saved films use and roughly how much is left on the phone */
export async function getStorageInfo() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota) return { used: estimate.usage || 0, quota: estimate.quota };
  } catch {
    /* not available */
  }
  return null;
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
    if (!forced.has(rec.id) && blockedByWifiOnly()) {
      if (!rec.waitingWifi) patch(rec.id, { waitingWifi: true }, true);
      return;
    }
    patch(rec.id, { tries: (rec.tries || 0) + 1 });
    run(rec.id);
  });
}

// Wi-Fi only: pause on mobile data, carry on when Wi-Fi is back or the switch goes off
subscribeNetwork(() => {
  if (blockedByWifiOnly()) {
    records.forEach((rec) => {
      if (rec.status === 'downloading' && !forced.has(rec.id)) pauseForWifi(rec.id);
    });
  } else {
    resumeInterrupted();
  }
});

// keeps the speed and time left moving while something downloads
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (controllers.size) emit();
  }, 1000);
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
