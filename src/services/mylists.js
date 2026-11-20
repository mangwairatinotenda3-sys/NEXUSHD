import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabaseClient.js';

/* Custom lists, "Watched", ratings and private notes.
   Signed in: saved to your account and available on every device. Signed out:
   kept on this phone, and moved into your account the first time you sign in.
   Everything here is private, only you can see it. */

const DATA_KEY = 'nexushd:mylists';
const OWNER_KEY = 'nexushd:mylists-owner';

export const MAX_LISTS = 30;
export const MAX_NAME = 40;
export const MAX_NOTE = 280;

const KEYS = ['lists', 'items', 'watched', 'reviews'];
const TITLE_KEY = 'user_id,media_type,movie_id';
const ITEM_KEY = 'list_id,media_type,movie_id';

const empty = () => ({ lists: [], items: [], watched: [], reviews: [] });

function readData() {
  try {
    const v = JSON.parse(window.localStorage.getItem(DATA_KEY));
    const data = empty();
    KEYS.forEach((k) => {
      if (Array.isArray(v?.[k])) data[k] = v[k];
    });
    return data;
  } catch {
    return empty();
  }
}

function writeData(s) {
  try {
    window.localStorage.setItem(
      DATA_KEY,
      JSON.stringify({ lists: s.lists, items: s.items, watched: s.watched, reviews: s.reviews })
    );
  } catch {
    /* storage unavailable */
  }
}

const readOwner = () => {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};

const writeOwner = (id) => {
  try {
    if (id) window.localStorage.setItem(OWNER_KEY, id);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
};

let state = { ...readData(), loading: true, userId: null };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  if (KEYS.some((k) => k in patch)) writeData(state);
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

/* ---------- helpers ---------- */

const typeOf = (m) => (m?.media_type === 'tv' ? 'tv' : 'movie');
const same = (a, id, type) => a.id === id && a.media_type === type;

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

/* The few facts kept about a title, so lists can show it without asking TMDB */
function snap(m) {
  return {
    id: Number(m.id),
    media_type: typeOf(m),
    title: m.title || m.name || 'Untitled',
    poster_path: m.poster_path || null,
    backdrop_path: m.backdrop_path || null,
    release_date: m.release_date || null,
    vote_average: m.vote_average ?? null,
  };
}

const titleRow = (userId, s) => ({
  user_id: userId,
  media_type: s.media_type,
  movie_id: s.id,
  title: s.title,
  poster_path: s.poster_path,
  backdrop_path: s.backdrop_path,
  release_date: s.release_date,
  vote_average: s.vote_average,
});

const titleFrom = (r) => ({
  id: Number(r.movie_id),
  media_type: r.media_type,
  title: r.title,
  poster_path: r.poster_path,
  backdrop_path: r.backdrop_path,
  release_date: r.release_date || null,
  vote_average: r.vote_average == null ? null : Number(r.vote_average),
});

const listFrom = (r) => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  createdAt: Date.parse(r.created_at) || Date.now(),
});
const itemFrom = (r) => ({
  ...titleFrom(r),
  listId: r.list_id,
  addedAt: Date.parse(r.added_at) || Date.now(),
});
const watchedFrom = (r) => ({ ...titleFrom(r), watchedAt: Date.parse(r.watched_at) || Date.now() });
const reviewFrom = (r) => ({
  ...titleFrom(r),
  rating: r.rating || 0,
  note: r.note || '',
  updatedAt: Date.parse(r.updated_at) || Date.now(),
});

/* ---------- talking to Supabase ---------- */

async function pull(userId) {
  const [lists, items, watched, reviews] = await Promise.all([
    supabase.from('lists').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase
      .from('list_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false }),
    supabase
      .from('watched')
      .select('*')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false }),
    supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);
  const failed = [lists, items, watched, reviews].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    lists: lists.data.map(listFrom),
    items: items.data.map(itemFrom),
    watched: watched.data.map(watchedFrom),
    reviews: reviews.data.map(reviewFrom),
  };
}

/* Things made while signed out go into the account once */
async function pushGuestData(userId) {
  const check = ({ error }) => {
    if (error) throw error;
  };
  if (state.lists.length) {
    check(
      await supabase.from('lists').upsert(
        state.lists.map((l) => ({
          id: l.id,
          user_id: userId,
          name: l.name,
          emoji: l.emoji,
          created_at: new Date(l.createdAt).toISOString(),
        })),
        { onConflict: 'id', ignoreDuplicates: true }
      )
    );
  }
  if (state.items.length) {
    check(
      await supabase.from('list_items').upsert(
        state.items.map((i) => ({
          ...titleRow(userId, i),
          list_id: i.listId,
          added_at: new Date(i.addedAt).toISOString(),
        })),
        { onConflict: ITEM_KEY, ignoreDuplicates: true }
      )
    );
  }
  if (state.watched.length) {
    check(
      await supabase.from('watched').upsert(
        state.watched.map((w) => ({
          ...titleRow(userId, w),
          watched_at: new Date(w.watchedAt).toISOString(),
        })),
        { onConflict: TITLE_KEY, ignoreDuplicates: true }
      )
    );
  }
  if (state.reviews.length) {
    check(
      await supabase.from('reviews').upsert(
        state.reviews.map((r) => ({
          ...titleRow(userId, r),
          rating: r.rating || null,
          note: r.note,
          updated_at: new Date(r.updatedAt).toISOString(),
        })),
        { onConflict: TITLE_KEY, ignoreDuplicates: true }
      )
    );
  }
}

let syncToken = 0;

async function sync(userId) {
  const token = ++syncToken;
  setState({ userId, loading: true });
  try {
    const owner = readOwner();
    if (owner && owner !== userId) setState(empty());
    if (!owner) await pushGuestData(userId);
    const data = await pull(userId);
    if (token !== syncToken) return;
    writeOwner(userId);
    setState({ ...data, loading: false });
  } catch {
    if (token === syncToken) setState({ loading: false });
  }
}

/* Quietly reloads from the account, used to undo a change the server refused */
async function refresh() {
  const uid = state.userId;
  if (!uid) return;
  const token = ++syncToken;
  try {
    const data = await pull(uid);
    if (token === syncToken) setState(data);
  } catch {
    /* offline, keep what is on screen */
  }
}

function reset() {
  syncToken += 1;
  writeOwner(null);
  setState({ ...empty(), userId: null, loading: false });
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

/* Changes to the account go one after the other, so a new list always exists
   before something is put in it */
let chain = Promise.resolve();
function remote(run) {
  const uid = state.userId;
  if (!uid) return;
  chain = chain.then(async () => {
    if (state.userId !== uid) return;
    try {
      const res = await run(uid);
      if (res?.error) await refresh();
    } catch {
      await refresh();
    }
  });
}

/* ---------- lists ---------- */

export function createList(name, emoji = '🎬') {
  const clean = String(name || '').trim().slice(0, MAX_NAME);
  if (!clean || state.lists.length >= MAX_LISTS) return null;
  const list = { id: uuid(), name: clean, emoji: emoji || '🎬', createdAt: Date.now() };
  setState({ lists: [...state.lists, list] });
  remote((uid) =>
    supabase.from('lists').insert({ id: list.id, user_id: uid, name: list.name, emoji: list.emoji })
  );
  return list;
}

export function renameList(id, name, emoji) {
  const clean = String(name || '').trim().slice(0, MAX_NAME);
  if (!clean) return false;
  setState({
    lists: state.lists.map((l) => (l.id === id ? { ...l, name: clean, emoji: emoji || l.emoji } : l)),
  });
  const next = state.lists.find((l) => l.id === id);
  remote((uid) =>
    supabase
      .from('lists')
      .update({ name: clean, emoji: next?.emoji || '🎬' })
      .eq('id', id)
      .eq('user_id', uid)
  );
  return true;
}

export function deleteList(id) {
  setState({
    lists: state.lists.filter((l) => l.id !== id),
    items: state.items.filter((i) => i.listId !== id),
  });
  remote((uid) => supabase.from('lists').delete().eq('id', id).eq('user_id', uid));
}

export function addToList(listId, movie) {
  const s = snap(movie);
  if (!state.lists.some((l) => l.id === listId)) return false;
  if (state.items.some((i) => i.listId === listId && same(i, s.id, s.media_type))) return false;
  setState({ items: [{ ...s, listId, addedAt: Date.now() }, ...state.items] });
  remote((uid) =>
    supabase
      .from('list_items')
      .upsert(
        { ...titleRow(uid, s), list_id: listId },
        { onConflict: ITEM_KEY, ignoreDuplicates: true }
      )
  );
  return true;
}

export function removeFromList(listId, id, type = 'movie') {
  setState({ items: state.items.filter((i) => !(i.listId === listId && same(i, id, type))) });
  remote((uid) =>
    supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', uid)
      .eq('movie_id', id)
      .eq('media_type', type)
  );
}

/* Returns true when the title was added, false when it was taken out */
export function toggleInList(listId, movie) {
  const s = snap(movie);
  const there = state.items.some((i) => i.listId === listId && same(i, s.id, s.media_type));
  if (there) removeFromList(listId, s.id, s.media_type);
  else addToList(listId, movie);
  return !there;
}

/* ---------- watched ---------- */

export function setWatched(movie, value) {
  const s = snap(movie);
  const there = state.watched.some((w) => same(w, s.id, s.media_type));
  if (value && !there) {
    setState({ watched: [{ ...s, watchedAt: Date.now() }, ...state.watched] });
    remote((uid) =>
      supabase
        .from('watched')
        .upsert(titleRow(uid, s), { onConflict: TITLE_KEY, ignoreDuplicates: true })
    );
  } else if (!value && there) {
    setState({ watched: state.watched.filter((w) => !same(w, s.id, s.media_type)) });
    remote((uid) =>
      supabase
        .from('watched')
        .delete()
        .eq('user_id', uid)
        .eq('movie_id', s.id)
        .eq('media_type', s.media_type)
    );
  }
}

/* Returns true when the title is now marked as watched */
export function toggleWatched(movie) {
  const s = snap(movie);
  const there = state.watched.some((w) => same(w, s.id, s.media_type));
  setWatched(movie, !there);
  return !there;
}

export function clearWatched() {
  setState({ watched: [] });
  remote((uid) => supabase.from('watched').delete().eq('user_id', uid));
}

/* ---------- ratings and notes ---------- */

/* rating 0 means no stars. With no stars and no note the review is removed.
   Giving stars also marks the title as watched. */
export function saveReview(movie, { rating = 0, note = '' } = {}) {
  const s = snap(movie);
  const stars = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const text = String(note || '').trim().slice(0, MAX_NOTE);

  if (!stars && !text) {
    setState({ reviews: state.reviews.filter((r) => !same(r, s.id, s.media_type)) });
    remote((uid) =>
      supabase
        .from('reviews')
        .delete()
        .eq('user_id', uid)
        .eq('movie_id', s.id)
        .eq('media_type', s.media_type)
    );
    return null;
  }

  const review = { ...s, rating: stars, note: text, updatedAt: Date.now() };
  setState({
    reviews: [review, ...state.reviews.filter((r) => !same(r, s.id, s.media_type))],
  });
  remote((uid) =>
    supabase.from('reviews').upsert(
      {
        ...titleRow(uid, s),
        rating: stars || null,
        note: text,
        updated_at: new Date(review.updatedAt).toISOString(),
      },
      { onConflict: TITLE_KEY }
    )
  );
  if (stars) setWatched(movie, true);
  return review;
}

/* ---------- hooks ---------- */

export function useMyLists() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    lists: s.lists,
    items: s.items,
    loading: s.loading,
    itemsOf: (listId) => s.items.filter((i) => i.listId === listId),
    inList: (listId, id, type = 'movie') =>
      s.items.some((i) => i.listId === listId && same(i, id, type)),
    createList,
    renameList,
    deleteList,
    addToList,
    removeFromList,
    toggleInList,
  };
}

export function useWatched() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    items: s.watched,
    loading: s.loading,
    has: (id, type = 'movie') => s.watched.some((w) => same(w, id, type)),
    set: setWatched,
    toggle: toggleWatched,
    clear: clearWatched,
  };
}

export function useReviews() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    items: s.reviews,
    loading: s.loading,
    get: (id, type = 'movie') => s.reviews.find((r) => r.id === id && r.media_type === type) || null,
    save: saveReview,
  };
}
