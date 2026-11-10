import { useEffect, useRef, useState } from 'react';
import { Moon, Bell, Info, ChevronRight, Search, Eye } from 'lucide-react';
import Header from '../components/Header.jsx';
import BrandMark from '../components/BrandMark.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useHistory from '../hooks/useHistory.js';
import { useApp } from '../context/AppContext.jsx';

export default function Settings() {
  const { theme, setTheme, notifications, setNotifications } = useApp();
  const [recent, setRecent] = useLocalStorage('nexushd:recent-searches', []);
  const history = useHistory();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2000);
  };

  return (
    <div className="page">
      <Header title="Settings" back />

      <div className="card">
        <div className="row">
          <Moon size={22} />
          <span className="row-label">App Theme</span>
          <div className="segmented" role="group" aria-label="Theme">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
              Light
            </button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
              Dark
            </button>
          </div>
        </div>

        <button
          className="row"
          onClick={() => setNotifications(!notifications)}
          role="switch"
          aria-checked={notifications}
        >
          <Bell size={22} />
          <span className="row-label">Notifications</span>
          <span className={`switch ${notifications ? 'on' : ''}`} />
        </button>

        <button className="row" onClick={() => setAboutOpen(!aboutOpen)} aria-expanded={aboutOpen}>
          <Info size={22} />
          <span className="row-label">About NexusHD</span>
          <ChevronRight
            size={20}
            className="muted"
            style={{ transform: aboutOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}
          />
        </button>

        {aboutOpen && (
          <div className="about-panel">
            NexusHD helps you discover movies and series, watch trailers, and keep your library in one
            place. Movie data is provided by TMDB. This product uses the TMDB API but is not endorsed or
            certified by TMDB.
          </div>
        )}

        <div className="row">
          <span style={{ width: 22 }} />
          <span className="row-label">Version</span>
          <span className="muted">v1.0.0</span>
        </div>
      </div>

      <div className="card">
        <button
          className="row"
          disabled={recent.length === 0}
          style={recent.length === 0 ? { opacity: 0.45 } : undefined}
          onClick={() => {
            setRecent([]);
            showToast('Search history cleared');
          }}
        >
          <Search size={22} />
          <span className="row-label">Clear search history</span>
          <span className="muted">{recent.length}</span>
        </button>
        <button
          className="row"
          disabled={history.items.length === 0}
          style={history.items.length === 0 ? { opacity: 0.45 } : undefined}
          onClick={() => {
            history.clear();
            showToast('Recently viewed cleared');
          }}
        >
          <Eye size={22} />
          <span className="row-label">Clear recently viewed</span>
          <span className="muted">{history.items.length}</span>
        </button>
      </div>

      <div className="brand-card">
        <BrandMark size={52} />
        <div className="brand-name">
          NEXUS<span>HD</span>
        </div>
        <div className="brand-tag">Stream · Download · Enjoy</div>
        <div className="brand-tag" style={{ marginTop: 6 }}>
          Made for movie lovers ❤️
        </div>
      </div>

      {toast && <div className="toast" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }}>{toast}</div>}
    </div>
  );
}
