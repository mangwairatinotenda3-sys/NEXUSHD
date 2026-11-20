import { Star } from 'lucide-react';

export const RATING_WORDS = ['', 'Not for me', 'It was okay', 'Good', 'Great', 'Loved it'];

/* Five stars. With onChange it is a control: tap a star to rate, tap the same
   star again to clear. Without it, it only shows the rating. */
export default function Stars({ value = 0, onChange, size = 20 }) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span className="ml-stars static" role="img" aria-label={`${value} out of 5 stars`}>
        {stars.map((n) => (
          <Star
            key={n}
            size={size}
            className={n <= value ? 'on' : ''}
            fill={n <= value ? 'currentColor' : 'none'}
          />
        ))}
      </span>
    );
  }

  return (
    <div className="ml-stars" role="radiogroup" aria-label="Your rating">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}
