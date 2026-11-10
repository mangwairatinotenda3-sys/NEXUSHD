import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabaseClient.js';

/* One shared watchlist for the whole app. Signed in: saved to your account and
   available on every device. Signed out: kept on this phone, and merged into
   your account the first time you sign in. */

const ITEMS_KEY = 'nexushd:watchlist';
const OWNER_KEY = 'nexushd:watchlist-owner';
const CONFLICT = 'user_id,media_type,movie_id';

function readItems() {
  try {
    const v = JSON.parse(window.localStorage.getItem(ITEMS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function readOwner() {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
function writeItems(items) {
  try {
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable */
  }
}
function writeOwner(id) {
  try {
    if (id) window.localStorage.setItem(OWNER_KEY, id);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
}

let state = { items: readItems(), loading: true, userId: null };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  if (patch.items) writeItems(patch.items);
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

const typeOf = (m) => m.media_type || 'movie';
const sameItem = (m, id, type) => m.id === id && typeOf(m) === type;

const toRow = (userId, m) => ({
  user_id: userId,
  movie_id: m.id,
  media_type: typeOf(m),
  title: m.title,
  poster_path: m.poster_path || null,
  backdrop_path: m.backdrop_path || null,
  release_date: m.release_date || null,
  vote_average: m.vote_average ?? null,
});

const fromRow = (r) => ({
  id: r.movie_id,
  media_type: r.media_type,
  title: r.title,
  poster_path: r.poster_path,
  backdrop_path: r.backdrop_path,
  release_date: r.release_date,
  vote_average: r.vote_average === null ? null : Number(r.vote_average),
  addedAt: Date.parse(r.added_at) || Date.now(),
});

let syncToken = 0;

async function sync(userId) {
  const token = ++syncToken;
  setState({ userId, loading: true });
  try {
    const owner = readOwner();
    // Items saved while signed out are merged into the account once.
    const guestItems = owner ? [] : state.items;
    if (owner && owner !== userId) setState({ items: [] });

    if (guestItems.length) {
      const { error: upError } = await supabase
        .from('watchlist')
        .upsert(
          guestItems.map((m) => toRow(userId, m)),
          { onConflict: CONFLICT, ignoreDuplicates: true }
        );
      if (upError) throw upError;
    }

    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    if (token !== syncToken) return;
    if (error) throw error;

    writeOwner(userId);
    setState({ items: data.map(fromRow), loading: false });
  } catch {
    if (token === syncToken) setState({ loading: false });
  }
}

function reset() {
  syncToken += 1;
  writeOwner(null);
  setState({ userId: null, items: [], loading: false });
}

supabase.auth
  .getSession()
  .then(({ data }) => {
    if (data.session) sync(data.session.user.id);
    else setState({ loading: false });
  })
  .catch(() => setState({ loading: false }));

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    const id = session.user.id;
    setTimeout(() => {
      if (state.userId !== id) sync(id);
    }, 0);
  } else if (event === 'SIGNED_OUT') {
    reset();
  }
});

function add(movie) {
  const type = typeOf(movie);
  const item = {
    id: movie.id,
    media_type: type,
    title: movie.title,
    poster_path: movie.poster_path || null,
    backdrop_path: movie.backdrop_path || null,
    release_date: movie.release_date || null,
    vote_average: movie.vote_average ?? null,
    addedAt: Date.now(),
  };
  setState({ items: [item, ...state.items.filter((m) => !sameItem(m, item.id, type))] });

  const uid = state.userId;
  if (uid) {
    supabase
      .from('watchlist')
      .upsert(toRow(uid, item), { onConflict: CONFLICT, ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) setState({ items: state.items.filter((m) => !sameItem(m, item.id, type)) });
      });
  }
}

function remove(id, type = 'movie') {
  const prev = state.items;
  setState({ items: prev.filter((m) => !sameItem(m, id, type)) });

  const uid = state.userId;
  if (uid) {
    supabase
      .from('watchlist')
      .delete()
      .eq('user_id', uid)
      .eq('movie_id', id)
      .eq('media_type', type)
      .then(({ error }) => {
        if (error) setState({ items: prev });
      });
  }
}

function clear() {
  const prev = state.items;
  setState({ items: [] });

  const uid = state.userId;
  if (uid) {
    supabase
      .from('watchlist')
      .delete()
      .eq('user_id', uid)
      .then(({ error }) => {
        if (error) setState({ items: prev });
      });
  }
}

/* Adds the title if it isn't saved, removes it if it is. Returns true when added. */
function toggle(movie) {
  const type = typeOf(movie);
  const exists = state.items.some((m) => sameItem(m, movie.id, type));
  if (exists) remove(movie.id, type);
  else add(movie);
  return !exists;
}

export default function useWatchlist() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return {
    items: snap.items,
    loading: snap.loading,
    has: (id, type = 'movie') => snap.items.some((m) => sameItem(m, id, type)),
    toggle,
    remove,
    clear,
  };
  }
