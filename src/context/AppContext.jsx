import { createContext, useContext, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('nexushd:theme', 'dark');
  const [notifications, setNotifications] = useLocalStorage('nexushd:notifications', true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07040f' : '#f6f3fd');
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, notifications, setNotifications }),
    [theme, setTheme, notifications, setNotifications]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
