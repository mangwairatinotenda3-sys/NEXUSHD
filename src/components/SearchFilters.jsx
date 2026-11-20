import { useState } from 'react';
import { GENRES, RATINGS, YEARS } from '../services/genres.js';
import '../styles/search.css';

export const SORT_OPTIONS = (browsing) => [
  { id: 'default', label: browsing ? 'Most popular' : 'Best match' },
  { id: 'rating', label: 'Top rated' },
  { id: 'newest', label: 'Newest' },
  { id: 'title', label: 'A–Z' },
];

export const NO_FILTERS = { genre: null, year: 'any', rating: 0 };

export const filtersActive = (f) => Boolean(f.genre) || f.year !== 'any' || f.rating > 0;

/* A sheet to narrow and sort results: genre, year, rating and order */
export default function SearchFilters({ filters, sort, browsing, onApply, onClose }) {
  const [draft, setDraft] = useState(filters);
  const [order, setOrder] = useState(sort);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const changed = filtersActive(draft) || order !== 'default';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sf-head">
          <h3>Filter and sort</h3>
          <button
            className="link-btn"
            disabled={!changed}
            onClick={() => {
              setDraft(NO_FILTERS);
              setOrder('default');
            }}
          >
            Reset
          </button>
        </div>

        <div className="sf-body">
          <h4 className="sf-label">Genre</h4>
          <div className="sf-chips">
            <button className={!draft.genre ? 'on' : ''} onClick={() => set({ genre: null })}>
              Any
            </button>
            {GENRES.map((g) => (
              <button
                key={g.id}
                className={draft.genre === g.id ? 'on' : ''}
                onClick={() => set({ genre: draft.genre === g.id ? null : g.id })}
              >
                {g.label}
              </button>
            ))}
          </div>

          <h4 className="sf-label">Year</h4>
          <div className="sf-chips">
            {YEARS.map((y) => (
              <button
                key={y.id}
                className={draft.year === y.id ? 'on' : ''}
                onClick={() => set({ year: y.id })}
              >
                {y.label}
              </button>
            ))}
          </div>

          <h4 className="sf-label">Rating</h4>
          <div className="sf-chips">
            {RATINGS.map((r) => (
              <button
                key={r.id}
                className={draft.rating === r.id ? 'on' : ''}
                onClick={() => set({ rating: r.id })}
              >
                {r.label}
              </button>
            ))}
          </div>

          <h4 className="sf-label">Sort by</h4>
          <div className="sf-chips">
            {SORT_OPTIONS(browsing).map((s) => (
              <button
                key={s.id}
                className={order === s.id ? 'on' : ''}
                onClick={() => setOrder(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary sf-apply"
          onClick={() => {
            onApply(draft, order);
            onClose();
          }}
        >
          Show results
        </button>
      </div>
    </div>
  );
}
