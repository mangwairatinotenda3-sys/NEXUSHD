import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

const HIDE_NAV_ON = ['/settings'];

export default function AppLayout() {
  const { pathname } = useLocation();
  const showNav = !HIDE_NAV_ON.some((p) => pathname.startsWith(p));

  return (
    <div className="app-shell">
      <main className={`app-content ${showNav ? '' : 'no-nav'}`}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
