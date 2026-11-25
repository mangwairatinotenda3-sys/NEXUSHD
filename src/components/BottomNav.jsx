import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Download, User, LayoutGrid } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/library', label: 'Library', icon: LayoutGrid },
];

/* The menu floats above the page. It slides away while you scroll down and
   comes back as soon as you scroll up, or when you are at the top.
   On tablets and computers it is a rail on the left and stays put. */
export default function BottomNav() {
  const { pathname } = useLocation();
  const [away, setAway] = useState(false);

  useEffect(() => {
    setAway(false);
    const scroller = document.querySelector('.app-content');
    if (!scroller) return undefined;

    const rail = window.matchMedia('(min-width: 700px) and (min-height: 481px)');
    let last = scroller.scrollTop;
    let queued = false;

    const update = () => {
      queued = false;
      const y = scroller.scrollTop;
      const dy = y - last;
      if (rail.matches || y < 24) setAway(false);
      else if (dy > 10) setAway(true);
      else if (dy < -10) setAway(false);
      if (Math.abs(dy) > 10 || y < 24) last = y;
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // lets the pinned buttons on a title page drop down when the menu is away
  useEffect(() => {
    document.body.classList.toggle('nav-away', away);
    return () => document.body.classList.remove('nav-away');
  }, [away]);

  return (
    <nav className={`bottom-nav ${away ? 'away' : ''}`} aria-label="Main" aria-hidden={away}>
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          tabIndex={away ? -1 : 0}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={24} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
        }
