import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseClient.js';
import { isOnline, subscribeConnection } from './connection.js';

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

/* The home and browse lists are also kept on the phone. With no internet the
   last ones you saw still appear (tapping a title says there is no internet).
   Only list pages are kept, so this stays small. */
const SAVED_PREFIX = 'nexushd:tc:';
const SAVED_INDEX = 'nexushd:tc-index';
const SAVED_MAX = 36;
const SAVED_LIMIT = 260 * 1024; // characters per saved list
const KEEP = /^(trending\/|movie\/(popular|top_rated|upcoming|now_playing)$|tv\/(popular|top_rated|on_the_air)$|genre\/|discover\/)/;

const hashOf = (text) => {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const readIndex = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_INDEX));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function saveCopy(path, url, params, data) {
  const page = Number(params.page || 1);
  if (!KEEP.test(path) || page > 2) return;
  try {
    const body = JSON.stringify({ u: url, t: Date.now(), d: data });
    if (body.length > SAVED_LIMIT) return;
    const key = hashOf(url);
    const write = () => window.localStorage.setItem(SAVED_PREFIX + key, body);
    try {
      write();
    } catch {
      // storage is full: drop the oldest saved lists and try once more
      const old = readIndex();
      old.slice(Math.ceil(old.length / 2)).forEach((k) => window.localStorage.removeItem(SAVED_PREFIX + k));
      window.localStorage.setItem(SAVED_INDEX, JSON.stringify(old.slice(0, Math.ceil(old.length / 2))));
      write();
    }
    const index = [key, ...readIndex().filter((k) => k !== key)];
    index.slice(SAVED_MAX).forEach((k) => window.localStorage.removeItem(SAVED_PREFIX + k));
    window.localStorage.setItem(SAVED_INDEX, JSON.stringify(index.slice(0, SAVED_MAX)));
  } catch {
    /* storage unavailable: lists just are not kept */
  }
}

function readCopy(url) {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_PREFIX + hashOf(url)));
    return v && v.u === url ? v.d : null;
  } catch {
    return null;
  }
}

export async function tmdbRequest(path, params = {}) {
  const query = new URLSearchParams({ path });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, v);
  });
  const url = `${SUPABASE_URL}/functions/v1/tmdb?${query}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.data;

  // no internet: use the last copy kept on the phone, if there is one
  if (!isOnline()) {
    const kept = KEEP.test(path) ? readCopy(url) : null;
    if (kept) return kept;
    throw new Error('No internet connection');
  }

  try {
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    cache.set(url, { data, time: Date.now() });
    saveCopy(path, url, params, data);
    return data;
  } catch (err) {
    // a bad moment on the network: an older copy is better than an empty screen
    const kept = KEEP.test(path) ? readCopy(url) : null;
    if (kept) return kept;
    throw err;
  }
}

/* Series come back from TMDB with different field names. These helpers give
   them the same shape as movies so every screen can treat them alike. */
const asTv = (item) => ({
  ...item,
  media_type: 'tv',
  title: item.name || item.original_name || 'Untitled',
  release_date: item.first_air_date || '',
});

const asTvDetails = (d) => ({
  ...d,
  media_type: 'tv',
  title: d.name || d.original_name || 'Untitled',
  release_date: d.first_air_date || '',
  runtime: (d.episode_run_time && d.episode_run_time[0]) || d.last_episode_to_air?.runtime || 0,
});

const mapResults = (data, fn) => ({ ...data, results: (data.results || []).map(fn) });

export const tmdb = {
  trending: (page = 1) => tmdbRequest('trending/movie/week', { page }),
  popular: (page = 1) => tmdbRequest('movie/popular', { page }),
  topRated: (page = 1) => tmdbRequest('movie/top_rated', { page }),
  upcoming: (page = 1) => tmdbRequest('movie/upcoming', { page }),
  nowPlaying: (page = 1) => tmdbRequest('movie/now_playing', { page }),
  genres: () => tmdbRequest('genre/movie/list'),
  byGenre: (id, page = 1) =>
    tmdbRequest('discover/movie', { with_genres: id, sort_by: 'popularity.desc', page }),
  search: (query, page = 1) => tmdbRequest('search/movie', { query, page }),
  details: (id) => tmdbRequest(`movie/${id}`, { append_to_response: 'videos,credits' }),
  similar: (id) => tmdbRequest(`movie/${id}/similar`),

  tvPopular: async (page = 1) => mapResults(await tmdbRequest('tv/popular', { page }), asTv),
  tvTopRated: async (page = 1) => mapResults(await tmdbRequest('tv/top_rated', { page }), asTv),
  tvDetails: async (id) =>
    asTvDetails(await tmdbRequest(`tv/${id}`, { append_to_response: 'videos,credits' })),
  tvSimilar: async (id) => mapResults(await tmdbRequest(`tv/${id}/similar`), asTv),
  // one season with all its episodes
  tvSeason: (id, season) => tmdbRequest(`tv/${id}/season/${season}`),

  // browse with filters (kind: 'movie' | 'tv'); both kinds come back in the same shape
  discover: async (kind, params = {}, page = 1) => {
    const data = await tmdbRequest(`discover/${kind}`, { ...params, page });
    return mapResults(data, kind === 'tv' ? asTv : (item) => ({ ...item, media_type: 'movie' }));
  },

  // where a movie or series can be watched, for every country (kind: 'movie' | 'tv')
  watchProviders: (kind, id) => tmdbRequest(`${kind}/${id}/watch/providers`),
};

export function imageUrl(path, size = 'w500') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/* Loads data with loading and error state. Pass deps to reload when they change.
   If it was loaded without internet (an older copy, or nothing), it loads again
   by itself when the connection comes back. */
export function useMovies(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const offlineLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((data) => {
        if (cancelled) return;
        offlineLoad.current = !isOnline();
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        offlineLoad.current = true;
        setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(
    () =>
      subscribeConnection(() => {
        if (isOnline() && offlineLoad.current) {
          offlineLoad.current = false;
          setTick((t) => t + 1);
        }
      }),
    []
  );

  return { ...state, reload };
        }
