import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const icon = (path) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const TABS = [
  { to: '/', label: 'Inspections', end: true, icon: icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />) },
  { to: '/new', label: 'Log new', icon: icon(<path d="M12 5v14M5 12h14" />) },
  { to: '/summary', label: 'Summary', icon: icon(<path d="M5 20V10M12 20V4M19 20v-7" />) },
];

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
