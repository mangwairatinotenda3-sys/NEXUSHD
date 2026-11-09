import useLocalStorage from './useLocalStorage.js';

export default function useWatchlist() {
  const [items, setItems] = useLocalStorage('nexushd:watchlist', []);

  const has = (id) => items.some((m) => m.id === id);

  const toggle = (movie) => {
    const exists = items.some((m) => m.id === movie.id);
    setItems((prev) =>
      prev.some((m) => m.id === movie.id)
        ? prev.filter((m) => m.id !== movie.id)
        : [
            {
              id: movie.id,
              title: movie.title,
              poster_path: movie.poster_path,
              backdrop_path: movie.backdrop_path,
              release_date: movie.release_date,
              vote_average: movie.vote_average,
              addedAt: Date.now(),
            },
            ...prev,
          ]
    );
    return !exists;
  };

  return { items, has, toggle };
}
