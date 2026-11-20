import { useState } from 'react';
import { Bookmark, Check, Plus } from 'lucide-react';
import ListEditor from './ListEditor.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import { MAX_LISTS, useMyLists } from '../services/mylists.js';
import '../styles/mylists.css';

/* "Save to…": My List and every custom list, each with a tick. New lists can be
   made right here, and the title goes straight into them. */
export default function ListSheet({ movie, onClose, onToast }) {
  const mine = useWatchlist();
  const { lists, inList, toggleInList, createList } = useMyLists();
  const [creating, setCreating] = useState(false);
  const type = movie.media_type === 'tv' ? 'tv' : 'movie';
  const full = lists.length >= MAX_LISTS;

  const toggleMine = () => {
    const added = mine.toggle(movie);
    onToast?.(added ? 'Added to My List' : 'Removed from My List');
  };

  const toggleCustom = (list) => {
    const added = toggleInList(list.id, movie);
    onToast?.(added ? `Added to ${list.name}` : `Removed from ${list.name}`);
  };

  const create = (name, emoji) => {
    const list = createList(name, emoji);
    setCreating(false);
    if (list) {
      toggleInList(list.id, movie);
      onToast?.(`Added to ${list.name}`);
    }
  };

  if (creating) {
    return <ListEditor onSave={create} onClose={() => setCreating(false)} />;
  }

  const row = (key, icon, label, on, onClick) => (
    <button key={key} className="ml-pick" role="checkbox" aria-checked={on} onClick={onClick}>
      <span className="ml-pick-icon">{icon}</span>
      <span className="ml-pick-label">{label}</span>
      <span className={`ml-check ${on ? 'on' : ''}`}>{on && <Check size={14} strokeWidth={3} />}</span>
    </button>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet ml-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Save to…</h3>
        <p className="ml-sheet-sub">{movie.title}</p>

        <div className="ml-pick-list">
          {row('mine', <Bookmark size={20} />, 'My List', mine.has(movie.id, type), toggleMine)}
          {lists.map((l) =>
            row(l.id, <span className="ml-emoji">{l.emoji}</span>, l.name, inList(l.id, movie.id, type), () =>
              toggleCustom(l)
            )
          )}
        </div>

        <button className="ml-new" onClick={() => setCreating(true)} disabled={full}>
          <span className="ml-pick-icon">
            <Plus size={20} />
          </span>
          {full ? `You can have up to ${MAX_LISTS} lists` : 'New list'}
        </button>

        <button className="btn-primary ml-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
    }
