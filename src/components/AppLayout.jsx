import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
import BottomNav from './BottomNav.jsx';
import useOnline from '../hooks/useOnline.js';
import useDownloads, { pauseDownload, resumeDownload } from '../services/downloadManager.js';
import '../styles/offline.css';

const HIDE_NAV_ON = ['/settings'];

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const { items } = useDownloads();
  const showNav = !HIDE_NAV_ON.some((p) => pathname.startsWith(p));

  const [banner, setBanner] = useState({ visible: false, kind: 'offline' });
  const [waiting, setWaiting] = useState(0);
  const wasOffline = useRef(false);
  const autoPaused = useRef(new Set());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    // Went offline: pause running downloads so they can pick up again later
    if (!online) {
      wasOffline.current = true;
      itemsRef.current
        .filter((d) => d.status === 'downloading')
        .forEach((d) => {
          autoPaused.current.add(d.id);
          pauseDownload(d.id);
        });
      setWaiting(autoPaused.current.size);
      setBanner({ visible: true, kind: 'offline' });
      return undefined;
    }

    if (!wasOffline.current) return undefined;
    wasOffline.current = false;

    // Back online: resume what we paused, plus downloads that failed from losing the connection
    const retry = new Set(autoPaused.current);
    itemsRef.current
      .filter((d) => d.status === 'error' && /connection/i.test(d.error || ''))
      .forEach((d) => retry.add(d.id));

    let resumed = 0;
    retry.forEach((id) => {
      const rec = itemsRef.current.find((d) => d.id === id);
      if (rec && rec.status !== 'completed' && rec.status !== 'downloading') {
        resumeDownload(id);
        resumed += 1;
      }
    });
    autoPaused.current.clear();

    setWaiting(resumed);
    setBanner({ visible: true, kind: 'restored' });
    const timer = setTimeout(() => setBanner((b) => ({ ...b, visible: false })), 2500);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div className={`app-shell ${banner.visible ? 'has-banner' : ''}`}>
      <div
        className={`net-banner ${banner.visible ? 'visible' : ''} ${banner.kind}`}
        role="status"
        aria-live="polite"
        aria-hidden={!banner.visible}
      >
        <div className="net-banner-inner">
          {banner.kind === 'restored' ? (
            <>
              <Wifi size={16} />
              <strong>Back online</strong>
              {waiting > 0 && <span>Resuming downloads</span>}
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <strong>You're offline</strong>
              <span>
                {waiting > 0
                  ? "Downloads will resume when you're back online"
                  : 'Downloaded films still play'}
              </span>
              {pathname !== '/downloads' && (
                <button onClick={() => navigate('/downloads')}>Downloads</button>
              )}
            </>
          )}
        </div>
      </div>

      <main className={`app-content ${showNav ? '' : 'no-nav'}`}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
    }
