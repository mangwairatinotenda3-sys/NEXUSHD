import { useCallback, useEffect, useState } from 'react';

const KEY = 'nexushd:downloads';

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export default function useDownloads() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setItems(read());
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const persist = useCallback((next) => {
    setItems(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const remove = useCallback((id) => persist(read().filter((d) => d.id !== id)), [persist]);
  const clear = useCallback(() => persist([]), [persist]);

  return { items, loading, remove, clear };
}
