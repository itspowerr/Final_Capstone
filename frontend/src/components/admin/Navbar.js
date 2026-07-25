import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

function NavIcon({ type }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (type === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (type === 'users') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (type === 'jobs') return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /></svg>;
  if (type === 'proposals') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  if (type === 'contracts') return <svg {...common}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
  if (type === 'disputes') return <svg {...common}><path d="M12 3v18" /><path d="m5 8 7-5 7 5" /><path d="M5 8l-3 7h6L5 8Z" /><path d="M19 8l-3 7h6l-3-7Z" /><path d="M7 21h10" /></svg>;
  if (type === 'audit') return <svg {...common}><path d="M9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
  if (type === 'chevron') return <svg {...common} width="14" height="14"><path d="m6 9 6 6 6-6" /></svg>;
  if (type === 'logout') return <svg {...common} width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
  return null;
}

const links = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/users', label: 'Users', icon: 'users' },
  { path: '/jobs', label: 'Jobs', icon: 'jobs' },
  { path: '/proposals', label: 'Proposals', icon: 'proposals' },
  { path: '/contracts', label: 'Contracts', icon: 'contracts' },
  { path: '/disputes', label: 'Disputes', icon: 'disputes' },
  { path: '/audit-logs', label: 'Audit Logs', icon: 'audit' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState({ name: 'Admin', role: 'Administrator' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser({ name: u.username || u.email || 'Admin', role: 'Administrator' });
      }
    } catch {
      setUser({ name: 'Admin', role: 'Administrator' });
    }
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (event.key && event.key !== 'Escape') return;
      if (!event.key && navRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <nav className="dash-nav admin-modern-nav" ref={navRef}>
      <div className="admin-brand-wrap">
        <Link className="nav-logo admin-brand" to="/dashboard">
          <div className="nav-logo-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          <span>
            <strong>FreeLedger</strong>
            <small>Admin Workspace</small>
          </span>
        </Link>
      </div>

      <div className="dash-links admin-nav-links">
        {links.map((item) => (
          <Link key={item.path} to={item.path} className={pathname === item.path ? 'active' : ''}>
            <NavIcon type={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="dash-nav-right admin-nav-actions">
        <span className="admin-status-pill">System Admin</span>
        <div className="admin-user-menu">
          <button className="user-chip modern-user-chip" type="button" onClick={() => setMenuOpen(open => !open)}>
            <div className="user-avatar">{avatarLetter}</div>
            <div className="user-info">
              <div className="uname">{user.name}</div>
              <div className="urole">{user.role}</div>
            </div>
            <NavIcon type="chevron" />
          </button>
          {menuOpen && (
            <div className="admin-user-dropdown">
              <button type="button" onClick={logout}><NavIcon type="logout" /> Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}