/* Genres for filtering. TMDB uses different numbers for movies and series, so
   each genre here has one for each (or none when that kind has no such genre). */

export const GENRES = [
  { id: 'action', label: 'Action', movie: 28, tv: 10759 },
  { id: 'adventure', label: 'Adventure', movie: 12, tv: 10759 },
  { id: 'animation', label: 'Animation', movie: 16, tv: 16 },
  { id: 'comedy', label: 'Comedy', movie: 35, tv: 35 },
  { id: 'crime', label: 'Crime', movie: 80, tv: 80 },
  { id: 'documentary', label: 'Documentary', movie: 99, tv: 99 },
  { id: 'drama', label: 'Drama', movie: 18, tv: 18 },
  { id: 'family', label: 'Family', movie: 10751, tv: 10751 },
  { id: 'fantasy', label: 'Fantasy', movie: 14, tv: 10765 },
  { id: 'history', label: 'History', movie: 36, tv: null },
  { id: 'horror', label: 'Horror', movie: 27, tv: null },
  { id: 'mystery', label: 'Mystery', movie: 9648, tv: 9648 },
  { id: 'romance', label: 'Romance', movie: 10749, tv: null },
  { id: 'scifi', label: 'Sci-Fi', movie: 878, tv: 10765 },
  { id: 'thriller', label: 'Thriller', movie: 53, tv: null },
  { id: 'war', label: 'War', movie: 10752, tv: 10768 },
  { id: 'western', label: 'Western', movie: 37, tv: 37 },
];

const NAMES = {
  movie: {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
  },
  tv: {
    10759: 'Action & Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    10762: 'Kids',
    9648: 'Mystery',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
    37: 'Western',
  },
};

const kindOf = (item) => (item?.media_type === 'tv' ? 'tv' : 'movie');

/* "Action · Sci-Fi" for a result that carries genre_ids */
export function genreLine(item, max = 2) {
  const names = NAMES[kindOf(item)];
  return (item?.genre_ids || [])
    .map((id) => names[id])
    .filter(Boolean)
    .slice(0, max)
    .join(' · ');
}

export function matchesGenre(item, genre) {
  if (!genre) return true;
  const id = genre[kindOf(item)];
  return id != null && (item.genre_ids || []).includes(id);
}

/* Release year ranges for the filter */
export const YEARS = [
  { id: 'any', label: 'Any year' },
  { id: '2020s', label: '2020s', from: 2020, to: 2029 },
  { id: '2010s', label: '2010s', from: 2010, to: 2019 },
  { id: '2000s', label: '2000s', from: 2000, to: 2009 },
  { id: '1990s', label: '1990s', from: 1990, to: 1999 },
  { id: 'old', label: 'Before 1990', to: 1989 },
];

export const RATINGS = [
  { id: 0, label: 'Any rating' },
  { id: 6, label: '6+' },
  { id: 7, label: '7+' },
  { id: 8, label: '8+' },
];

export function yearOf(item) {
  const y = Number(String(item?.release_date || '').slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : 0;
}

export function matchesYear(item, range) {
  if (!range || range.id === 'any') return true;
  const y = yearOf(item);
  if (!y) return false;
  return (range.from == null || y >= range.from) && (range.to == null || y <= range.to);
}
