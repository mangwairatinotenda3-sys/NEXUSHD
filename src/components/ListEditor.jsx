import { useState } from 'react';
import { MAX_NAME } from '../services/mylists.js';
import '../styles/mylists.css';

const EMOJIS = ['🎬', '🍿', '⭐', '❤️', '🔥', '😂', '😱', '🌙', '🧠', '👨‍👩‍👧', '🏆', '🎄'];
const IDEAS = ['Weekend picks', 'Date night', 'Family night', 'Scary movies'];

/* A small sheet to make or rename a list: a name and a picture */
export default function ListEditor({
  title = 'New list',
  initialName = '',
  initialEmoji = '🎬',
  confirmLabel = 'Create',
  onSave,
  onClose,
}) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const clean = name.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!clean) return;
    onSave(clean, emoji);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet ml-editor" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{title}</h3>

        <div className="ml-emojis" role="radiogroup" aria-label="Picture">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              className={emoji === e ? 'on' : ''}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="ml-input">
          <span className="ml-input-emoji">{emoji}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            placeholder="List name"
            maxLength={MAX_NAME}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
          <span className="ml-count">
            {name.length}/{MAX_NAME}
          </span>
        </label>

        {!clean && initialName === '' && (
          <div className="ml-ideas">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setName(idea)}>
                {idea}
              </button>
            ))}
          </div>
        )}

        <div className="sheet-actions" style={{ marginTop: 18 }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ml-confirm" disabled={!clean}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
    }
