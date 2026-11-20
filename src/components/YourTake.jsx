import { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import Stars, { RATING_WORDS } from './Stars.jsx';
import { MAX_NOTE, saveReview, useReviews, useWatched } from '../services/mylists.js';
import '../styles/mylists.css';

/* Your own stars and a short note about a title. Private: it is only ever
   shown to you. Giving stars also marks the title as watched. */
export default function YourTake({ movie, onToast }) {
  const type = movie.media_type === 'tv' ? 'tv' : 'movie';
  const reviews = useReviews();
  const watched = useWatched();
  const review = reviews.get(movie.id, type);
  const isWatched = watched.has(movie.id, type);
  const saved = review?.note || '';

  const [draft, setDraft] = useState(saved);
  const [focused, setFocused] = useState(false);
  const dirty = draft.trim() !== saved;

  // follow the account when the saved note changes (after signing in, say)
  useEffect(() => {
    if (!focused) setDraft(saved);
  }, [saved, focused]);

  // leaving the page never loses a note that was typed
  const latest = useRef({ movie, draft, dirty, rating: 0 });
  latest.current = { movie, draft, dirty, rating: review?.rating || 0 };
  useEffect(
    () => () => {
      const { movie: m, draft: text, dirty: d, rating } = latest.current;
      if (d) saveReview(m, { rating, note: text });
    },
    []
  );

  const rate = (value) => {
    saveReview(movie, { rating: value, note: draft });
    onToast?.(value ? `Rated ${value} ${value === 1 ? 'star' : 'stars'}` : 'Rating removed');
  };

  const saveNote = () => {
    saveReview(movie, { rating: review?.rating || 0, note: draft });
    setFocused(false);
    onToast?.(draft.trim() ? 'Note saved' : 'Note removed');
  };

  return (
    <section className="d-section ml-take" aria-label="Your rating and note">
      <div className="ml-take-head">
        <h2>Your take</h2>
        <span className="ml-private">
          <Lock size={12} /> Only you can see this
        </span>
      </div>

      <div className="ml-take-card">
        <div className="ml-rate">
          <Stars value={review?.rating || 0} onChange={rate} size={30} />
          <span className="ml-rate-word">
            {review?.rating ? RATING_WORDS[review.rating] : 'Tap a star to rate'}
          </span>
        </div>

        <button
          type="button"
          className="ml-watch"
          role="switch"
          aria-checked={isWatched}
          onClick={() => {
            const now = watched.toggle(movie);
            onToast?.(now ? 'Marked as watched' : 'Removed from Watched');
          }}
        >
          <span className="ml-watch-text">
            <b>I've watched this</b>
            <span>It appears in Watched in your Library</span>
          </span>
          <span className={`switch ${isWatched ? 'on' : ''}`} />
        </button>

        <label className="ml-note">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTE))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Add a private note. Who you watched it with, what you thought…"
            rows={focused || draft ? 3 : 2}
            maxLength={MAX_NOTE}
          />
          <span className="ml-note-foot">
            <span className="ml-count">
              {draft.length}/{MAX_NOTE}
            </span>
            {dirty && (
              <button
                type="button"
                className="ml-save"
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveNote}
              >
                <Check size={15} strokeWidth={3} /> Save note
              </button>
            )}
          </span>
        </label>
      </div>
    </section>
  );
  }
