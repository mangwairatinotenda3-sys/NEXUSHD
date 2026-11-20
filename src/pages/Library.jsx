import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  Bookmark,
  Check,
  Eye,
  EyeOff,
  Film,
  FolderPlus,
  Info,
  LayoutGrid,
  List as ListIcon,
  ListPlus,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ListEditor from '../components/ListEditor.jsx';
import ListSheet from '../components/ListSheet.jsx';
import Stars from '../components/Stars.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMyLists, useReviews, useWatched } from '../services/mylists.js';
import { imageUrl } from '../services/tmdb.js';
import '../styles/library.css';
import '../styles/mylists.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const SORTS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'mine', label: 'My rating' },
];

const typeOf = (m) => m.media_type || 'movie';
const pathOf = (m) => `/${typeOf(m) === 'tv' ? 'tv' : 'movie'}/${m.id}`;
const keyOf = (m) => `${typeOf(m)}-${m.id}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Thumb({ item }) {
  const [loaded, setLoaded] = useState(false);
  const src = imageUrl(item.poster_path, 'w342') || imageUrl(item.backdrop_path, 'w300');
  if (!src) {
    return (
      <div className="poster-fallback">
        <Film size={28} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={loaded ? 'loaded' : ''}
      onLoad={() => setLoaded(true)}
    />
  );
}

function LibrarySkeleton({ grid }) {
  return (
    <>
      <div className="lib-collections" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton lib-coll-sk" />
        ))}
      </div>
      <div className="lib-bar" aria-hidden="true">
        <div className="skeleton" style={{ width: 190, height: 38, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 84, height: 38, borderRadius: 999, marginLeft: 'auto' }} />
      </div>
      {grid ? (
        <div className="lib-grid" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="lib-poster">
              <div className="skeleton lib-poster-img" />
              <div className="skeleton" style={{ height: 14, width: '80%', marginTop: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="lib-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="lib-card lib-sk-card">
              <div className="skeleton lib-thumb-sk" />
              <div className="lib-info">
                <div className="skeleton" style={{ height: 18, width: '65%' }} />
                <div className="skeleton" style={{ height: 13, width: '40%', marginTop: 4 }} />
                <div className="skeleton" style={{ height: 13, width: '50%', marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mine = useWatchlist();
  const custom = useMyLists();
  const watched = useWatched();
  const reviews = useReviews();

  const [tab, setTab] = useLocalStorage('nexushd:library-tab', 'list');
  const [mode, setMode] = useLocalStorage('nexushd:library-mode', 'grid');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useLocalStorage('nexushd:library-sort', 'recent');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'clear' | 'delete-list'
  const [editor, setEditor] = useState(null); // 'new' | 'rename'
  const [saveTo, setSaveTo] = useState(null);
  const [undo, setUndo] = useState(null);
  const [toast, setToast] = useState('');
  const undoTimer = useRef(null);
  const toastTimer = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(undoTimer.current);
      clearTimeout(toastTimer.current);
    },
    []
  );

  const grid = mode !== 'list';
  const loading = mine.loading || custom.loading || watched.loading || reviews.loading;

  // which view is open: My List, Watched, or one custom list
  const activeList = tab.startsWith('l:') ? custom.lists.find((l) => `l:${l.id}` === tab) : null;
  const view = tab === 'watched' ? 'watched' : activeList ? 'custom' : 'list';
  useEffect(() => {
    if (tab.startsWith('l:') && !loading && !activeList) setTab('list');
  }, [tab, activeList, loading, setTab]);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  // everything in the open view, with the facts that view shows
  const source = useMemo(() => {
    if (view === 'watched') return watched.items.map((m) => ({ ...m, stamp: m.watchedAt }));
    if (view === 'custom') {
      return custom.items
        .filter((i) => i.listId === activeList.id)
        .map((m) => ({ ...m, stamp: m.addedAt }));
    }
    return mine.items.map((m) => ({ ...m, stamp: m.addedAt }));
  }, [view, watched.items, custom.items, activeList, mine.items]);

  const viewName = view === 'watched' ? 'Watched' : view === 'custom' ? activeList.name : 'My List';
  const sorts = view === 'watched' ? SORTS : SORTS.filter((s) => s.id !== 'mine');
  const activeSort = sorts.some((s) => s.id === sort) ? sort : 'recent';

  const visible = useMemo(() => {
    const list = source.filter((m) => filter === 'all' || typeOf(m) === filter);
    const stars = (m) => reviews.get(m.id, typeOf(m))?.rating || 0;
    if (activeSort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (activeSort === 'rating') list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    else if (activeSort === 'mine') list.sort((a, b) => stars(b) - stars(a) || b.stamp - a.stamp);
    else list.sort((a, b) => b.stamp - a.stamp);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, filter, activeSort, reviews.items]);

  const open = (m) => navigate(pathOf(m));

  const removeFromView = (m) => {
    const type = typeOf(m);
    if (view === 'watched') watched.set(m, false);
    else if (view === 'custom') custom.removeFromList(activeList.id, m.id, type);
    else mine.remove(m.id, type);
    setItemMenu(null);
    setUndo({ item: m, view, listId: activeList?.id });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4500);
  };

  const doUndo = () => {
    if (undo) {
      if (undo.view === 'watched') watched.set(undo.item, true);
      else if (undo.view === 'custom') custom.addToList(undo.listId, undo.item);
      else mine.toggle(undo.item);
    }
    setUndo(null);
    clearTimeout(undoTimer.current);
  };

  const menuButton = (
    <button
      className="icon-btn"
      onClick={() => setMenuOpen(true)}
      disabled={loading}
      aria-label="List options"
    >
      <MoreVertical size={24} />
    </button>
  );

  const collection = (id, icon, name, count, on, onClick) => (
    <button
      key={id}
      role="tab"
      aria-selected={on}
      className={`lib-coll ${on ? 'on' : ''}`}
      onClick={onClick}
    >
      <span className="lib-coll-ico">{icon}</span>
      <b>{name}</b>
      <span>{plural(count, 'title', 'titles')}</span>
    </button>
  );

  const collections = (
    <div className="lib-collections" role="tablist" aria-label="Your lists">
      {collection('list', <Bookmark size={20} />, 'My List', mine.items.length, view === 'list', () =>
        setTab('list')
      )}
      {collection('watched', <Eye size={20} />, 'Watched', watched.items.length, view === 'watched', () =>
        setTab('watched')
      )}
      {custom.lists.map((l) =>
        collection(
          l.id,
          <span className="ml-emoji">{l.emoji}</span>,
          l.name,
          custom.itemsOf(l.id).length,
          activeList?.id === l.id,
          () => setTab(`l:${l.id}`)
        )
      )}
      <button className="lib-coll lib-coll-new" onClick={() => setEditor('new')} aria-label="New list">
        <span className="lib-coll-ico">
          <Plus size={20} />
        </span>
        <b>New list</b>
        <span>Make your own</span>
      </button>
    </div>
  );

  const bar = (
    <div className="lib-bar">
      <div className="lib-seg" role="tablist" aria-label="Type">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'on' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button className="lib-tool lib-sort" onClick={() => setSortOpen(true)} aria-label="Sort">
        <ArrowUpDown size={17} />
      </button>
      <button
        className="lib-tool"
        onClick={() => setMode(grid ? 'list' : 'grid')}
        aria-label={grid ? 'Show as a list' : 'Show as a grid'}
      >
        {grid ? <ListIcon size={18} /> : <LayoutGrid size={18} />}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <Header title="Library" right={menuButton} />
        <LibrarySkeleton grid={grid} />
      </div>
    );
  }

  const emptyView = {
    list: {
      icon: Bookmark,
      title: 'Your list is empty',
      text: 'Tap the bookmark on any movie or series to save it here.',
      actionLabel: 'Browse Movies',
      onAction: () => navigate('/'),
    },
    watched: {
      icon: Eye,
      title: 'Nothing watched yet',
      text: 'Mark a title as watched, or rate it, and it shows up here.',
      actionLabel: 'Browse Movies',
      onAction: () => navigate('/'),
    },
    custom: {
      icon: ListPlus,
      title: 'This list is empty',
      text: 'Open a title and choose “Save to…” to put it in this list.',
      actionLabel: 'Browse Movies',
      onAction: () => navigate('/'),
    },
  }[view];

  const mineLine = (m) => {
    const review = reviews.get(m.id, typeOf(m));
    if (review?.rating > 0) {
      return (
        <span className="ml-mine">
          <Stars value={review.rating} size={13} />
          {review.note && <MessageSquareText size={13} />}
        </span>
      );
    }
    if (review?.note) {
      return (
        <span className="ml-mine">
          <MessageSquareText size={13} /> Note
        </span>
      );
    }
    return null;
  };

  const posterCard = (m, i) => {
    const type = typeOf(m);
    const year = m.release_date ? m.release_date.slice(0, 4) : '';
    const rating = m.vote_average > 0 ? m.vote_average.toFixed(1) : '';
    const seen = watched.has(m.id, type);
    return (
      <article
        className="lib-poster"
        key={keyOf(m)}
        style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
      >
        <button className="lib-poster-img" onClick={() => open(m)} aria-label={`Open ${m.title}`}>
          <Thumb item={m} />
          <span className="lib-shade" />
          {rating && (
            <span className="lib-badge rate">
              <Star size={11} fill="currentColor" /> {rating}
            </span>
          )}
          {seen && (
            <span className="lib-badge seen" aria-label="Watched">
              <Check size={12} strokeWidth={3.2} />
            </span>
          )}
          {type === 'tv' && <span className="lib-badge tv">Series</span>}
        </button>
        <div className="lib-poster-foot">
          <button className="lib-poster-text" onClick={() => open(m)}>
            <span className="lib-title">{m.title}</span>
            <span className="lib-sub">
              {year || (view === 'watched' ? timeAgo(m.stamp) : '')}
              {year && view === 'watched' ? ` · ${timeAgo(m.stamp)}` : ''}
            </span>
            {mineLine(m)}
          </button>
          <button
            className="icon-btn lib-more"
            onClick={() => setItemMenu(m)}
            aria-label={`Options for ${m.title}`}
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </article>
    );
  };

  const rowCard = (m, i) => {
    const type = typeOf(m);
    const year = m.release_date ? m.release_date.slice(0, 4) : '';
    const rating = m.vote_average > 0 ? m.vote_average.toFixed(1) : '';
    const seen = watched.has(m.id, type);
    return (
      <article
        className="lib-card"
        key={keyOf(m)}
        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
      >
        <button className="lib-thumb" onClick={() => open(m)} aria-label={`Open ${m.title}`}>
          <Thumb item={m} />
        </button>
        <button className="lib-info" onClick={() => open(m)}>
          <span className="lib-title">{m.title}</span>
          <span className="lib-meta">
            {year && <span>{year}</span>}
            {rating && (
              <span className="lib-rating">
                <Star size={12} fill="currentColor" />
                {rating}
              </span>
            )}
            {type === 'tv' && <span className="lib-type">Series</span>}
          </span>
          {mineLine(m)}
          <span className="lib-status">
            <span className="check">
              <Check size={11} strokeWidth={3} />
            </span>
            {view === 'watched'
              ? `Watched · ${timeAgo(m.stamp)}`
              : `${view === 'custom' ? 'Added' : 'Saved'} · ${timeAgo(m.stamp)}`}
            {view !== 'watched' && seen && <span className="ml-seen">Watched</span>}
          </span>
        </button>
        <button className="lib-play" onClick={() => open(m)} aria-label={`Open ${m.title}`}>
          <Play size={20} fill="currentColor" />
        </button>
        <button
          className="icon-btn lib-more"
          onClick={() => setItemMenu(m)}
          aria-label={`Options for ${m.title}`}
        >
          <MoreVertical size={22} />
        </button>
      </article>
    );
  };

  return (
    <div className="page">
      <Header title="Library" right={menuButton} />
      {collections}
      {bar}

      {!user && (mine.items.length > 0 || custom.lists.length > 0 || watched.items.length > 0) && (
        <div className="lib-banner">
          <span>Sign in to keep your lists on all your devices.</span>
          <button onClick={() => navigate('/profile')}>Sign in</button>
        </div>
      )}

      {source.length === 0 ? (
        <EmptyState {...emptyView} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Film}
          title={filter === 'tv' ? 'No series here' : 'No movies here'}
          text={
            filter === 'tv'
              ? `Series you add to ${viewName} will show up here.`
              : `Movies you add to ${viewName} will show up here.`
          }
        />
      ) : (
        <>
          <div className="lib-count">
            <b>{viewName}</b> · {plural(visible.length, 'title', 'titles')}
          </div>
          {grid ? (
            <div className="lib-grid">{visible.map(posterCard)}</div>
          ) : (
            <div className="lib-list">{visible.map(rowCard)}</div>
          )}
        </>
      )}

      {sortOpen && (
        <div className="sheet-backdrop" onClick={() => setSortOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Sort {viewName} by</h3>
            <div className="sheet-list">
              {sorts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSort(s.id);
                    setSortOpen(false);
                  }}
                >
                  {s.label}
                  {activeSort === s.id && <Check size={20} className="tick" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{viewName}</h3>
            <div className="sheet-list">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setEditor('new');
                }}
              >
                <FolderPlus size={20} /> New list
              </button>
              {view === 'custom' && (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setEditor('rename');
                    }}
                  >
                    <Pencil size={20} /> Rename list
                  </button>
                  <div className="sep" />
                  <button
                    className="danger-text"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirm('delete-list');
                    }}
                  >
                    <Trash2 size={20} /> Delete list
                  </button>
                </>
              )}
              {view !== 'custom' && (
                <>
                  <div className="sep" />
                  <button
                    className="danger-text"
                    disabled={source.length === 0}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirm('clear');
                    }}
                  >
                    <Trash2 size={20} /> {view === 'watched' ? 'Clear Watched' : 'Clear My List'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {itemMenu && (
        <div className="sheet-backdrop" onClick={() => setItemMenu(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{itemMenu.title}</h3>
            <div className="sheet-list">
              <button
                onClick={() => {
                  const m = itemMenu;
                  setItemMenu(null);
                  open(m);
                }}
              >
                <Info size={20} /> View details
              </button>
              <button
                onClick={() => {
                  setSaveTo(itemMenu);
                  setItemMenu(null);
                }}
              >
                <ListPlus size={20} /> Save to…
              </button>
              <button
                onClick={() => {
                  const now = watched.toggle(itemMenu);
                  showToast(now ? 'Marked as watched' : 'Removed from Watched');
                  setItemMenu(null);
                }}
              >
                {watched.has(itemMenu.id, typeOf(itemMenu)) ? (
                  <>
                    <EyeOff size={20} /> Not watched
                  </>
                ) : (
                  <>
                    <Eye size={20} /> Mark as watched
                  </>
                )}
              </button>
              <div className="sep" />
              <button className="danger-text" onClick={() => removeFromView(itemMenu)}>
                <Trash2 size={20} /> Remove from {viewName}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveTo && <ListSheet movie={saveTo} onClose={() => setSaveTo(null)} onToast={showToast} />}

      {editor === 'new' && (
        <ListEditor
          onSave={(name, emoji) => {
            const list = custom.createList(name, emoji);
            setEditor(null);
            if (list) {
              setTab(`l:${list.id}`);
              showToast(`Created ${list.name}`);
            } else {
              showToast("Couldn't make this list");
            }
          }}
          onClose={() => setEditor(null)}
        />
      )}

      {editor === 'rename' && activeList && (
        <ListEditor
          title="Edit list"
          initialName={activeList.name}
          initialEmoji={activeList.emoji}
          confirmLabel="Save"
          onSave={(name, emoji) => {
            custom.renameList(activeList.id, name, emoji);
            setEditor(null);
            showToast('List updated');
          }}
          onClose={() => setEditor(null)}
        />
      )}

      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>
              {confirm === 'delete-list'
                ? `Delete “${activeList?.name}”?`
                : view === 'watched'
                  ? 'Clear Watched?'
                  : 'Clear My List?'}
            </h3>
            <p>
              {confirm === 'delete-list'
                ? 'The list is removed. The films and series in it are not deleted from the app.'
                : view === 'watched'
                  ? 'Every title is unmarked as watched. Your ratings and notes are kept.'
                  : 'This removes every saved title from your list.'}
            </p>
            <div className="sheet-actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm === 'delete-list') {
                    custom.deleteList(activeList.id);
                    setTab('list');
                  } else if (view === 'watched') watched.clear();
                  else mine.clear();
                  setConfirm(null);
                }}
              >
                {confirm === 'delete-list' ? 'Delete' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {undo && (
        <div className="toast">
          Removed
          <button className="undo" onClick={doUndo}>
            Undo
          </button>
        </div>
      )}
      {!undo && toast && <div className="toast">{toast}</div>}
    </div>
  );
                  }
