import { useEffect, useRef, useState } from 'react';
import { Moon, Bell, Info, ChevronRight, Search, Eye, RefreshCw } from 'lucide-react';
import Header from '../components/Header.jsx';
import BrandMark from '../components/BrandMark.jsx';
import { UpdateSheet } from '../components/UpdatePrompt.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useHistory from '../hooks/useHistory.js';
import { useApp } from '../context/AppContext.jsx';
import { ensureNotificationPermission } from '../services/notify.js';
import { APP_VERSION, BUILD, checkForUpdate, updatesSupported } from '../services/update.js';
import '../styles/update.css';

export default function Settings() {
  const { theme, setTheme, notifications, setNotifications } = useApp();
  const [recent, setRecent] = useLocalStorage('nexushd:recent-searches', []);
  const history = useHistory();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  // Turning alerts on asks Android for permission first
  const toggleNotifications = async () => {
    if (notifications) {
      setNotifications(false);
      return;
    }
    const permission = await ensureNotificationPermission();
    if (permission === 'denied') {
      showToast('Notifications are blocked. Allow them for NexusHD in Android settings.');
      return;
    }
    setNotifications(true);
  };

  const checkUpdates = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await checkForUpdate({ force: true });
      if (result.available) setUpdate(result);
      else showToast("You're on the latest version");
    } catch {
      showToast("Couldn't check for updates. Check your connection.");
    } finally {
      setChecking(false);
    }
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
          onClick={toggleNotifications}
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
          <span className="muted">
            v{APP_VERSION}
            {BUILD ? ` · build ${BUILD}` : ''}
          </span>
        </div>

        {updatesSupported() && (
          <button className="row" onClick={checkUpdates} disabled={checking}>
            <RefreshCw size={22} />
            <span className="row-label">Check for updates</span>
            <span className="row-status">{checking ? 'Checking…' : ''}</span>
            <ChevronRight size={20} className="muted" />
          </button>
        )}
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

      {update && <UpdateSheet info={update} onLater={() => setUpdate(null)} />}

      {toast && <div className="toast" style={{ bottom: 'calc(var(--safe-bottom) + 24px)' }}>{toast}</div>}
    </div>
  );
}
