import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Play, Check, Star, Film, Info, Trash2, Bookmark } from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { imageUrl } from '../services/tmdb.js';
import '../styles/library.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const SORTS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'rating', label: 'Highest rated' },
];

const typeOf = (m) => m.media_type || 'movie';
const pathOf = (m) => `/${typeOf(m) === 'tv' ? 'tv' : 'movie'}/${m.id}`;

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

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, toggle, remove, clear } = useWatchlist();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useLocalStorage('nexushd:library-sort', 'recent');
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const visible = useMemo(() => {
    const list = items.filter((m) => filter === 'all' || typeOf(m) === filter);
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'rating') list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    else list.sort((a, b) => b.addedAt - a.addedAt);
    return list;
  }, [items, filter, sort]);

  const open = (m) => navigate(pathOf(m));

  const removeWithUndo = (m) => {
    remove(m.id, typeOf(m));
    setItemMenu(null);
    setUndo(m);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4500);
  };

  const doUndo = () => {
    if (undo) toggle(undo);
    setUndo(null);
    clearTimeout(undoTimer.current);
  };

  const menuButton = (
    <button
      className="icon-btn"
      onClick={() => setMenuOpen(true)}
      disabled={loading}
      aria-label="Library options"
    >
      <MoreVertical size={24} />
    </button>
  );

  const chips = (
    <div className="lib-chips" role="tablist">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={filter === f.id}
          className={`lib-chip ${filter === f.id ? 'on' : ''}`}
          onClick={() => setFilter(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <Header title="Library" right={menuButton} />
        {chips}
        <div className="lib-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="lib-card lib-sk-card">
              <div className="skeleton lib-thumb-sk" />
              <div className="lib-info">
                <div className="skeleton" style={{ height: 18, width: '65%' }} />
                <div className="skeleton" style={{ height: 13, width: '40%', marginTop: 4 }} />
                <div className="skeleton" style={{ height: 13, width: '50%', marginTop: 4 }} />
              </div>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%', margin: 'auto 14px auto 0' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Library" right={menuButton} />
      {chips}

      {!user && items.length > 0 && (
        <div className="lib-banner">
          <span>Sign in to keep your list on all your devices.</span>
          <button onClick={() => navigate('/profile')}>Sign in</button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Your list is empty"
          text="Tap the bookmark on any movie or series to save it here."
          actionLabel="Browse Movies"
          onAction={() => navigate('/')}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Film}
          title={filter === 'tv' ? 'No series saved' : 'No movies saved'}
          text={
            filter === 'tv'
              ? 'Series you save will show up here.'
              : 'Movies you save will show up here.'
          }
        />
      ) : (
        <>
          <div className="lib-count">
            {visible.length} {visible.length === 1 ? 'title' : 'titles'}
          </div>
          <div className="lib-list">
            {visible.map((m, i) => {
              const year = m.release_date ? m.release_date.slice(0, 4) : '';
              const rating = m.vote_average > 0 ? m.vote_average.toFixed(1) : '';
              return (
                <article
                  className="lib-card"
                  key={`${typeOf(m)}-${m.id}`}
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
                      {typeOf(m) === 'tv' && <span className="lib-type">Series</span>}
                    </span>
                    <span className="lib-status">
                      <span className="check">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      Saved · {timeAgo(m.addedAt)}
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
            })}
          </div>
        </>
      )}

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Sort by</h3>
            <div className="sheet-list">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSort(s.id);
                    setMenuOpen(false);
                  }}
                >
                  {s.label}
                  {sort === s.id && <Check size={20} className="tick" />}
                </button>
              ))}
              <div className="sep" />
              <button
                className="danger-text"
                disabled={items.length === 0}
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmClear(true);
                }}
              >
                <Trash2 size={20} /> Clear My List
              </button>
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
              <button className="danger-text" onClick={() => removeWithUndo(itemMenu)}>
                <Trash2 size={20} /> Remove from My List
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClear && (
        <div className="sheet-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Clear My List?</h3>
            <p>This removes every saved title from your list.</p>
            <div className="sheet-actions">
              <button onClick={() => setConfirmClear(false)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  clear();
                  setConfirmClear(false);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {undo && (
        <div className="toast">
          Removed from My List
          <button className="undo" onClick={doUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
