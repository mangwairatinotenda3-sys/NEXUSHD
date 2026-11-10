import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseClient.js';

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

export async function tmdbRequest(path, params = {}) {
  const query = new URLSearchParams({ path });
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, v);
  });
  const url = `${SUPABASE_URL}/functions/v1/tmdb?${query}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.data;

  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  cache.set(url, { data, time: Date.now() });
  return data;
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
};

export function imageUrl(path, size = 'w500') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/* Loads data with loading and error state. Pass deps to reload when they change. */
export function useMovies(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
  }
