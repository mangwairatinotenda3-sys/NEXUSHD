import { NavLink } from 'react-router-dom';
import { Home, Download, User, LayoutGrid } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/library', label: 'Library', icon: LayoutGrid },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={24} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
