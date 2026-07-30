import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import NotificationBell from '../shared/NotificationBell.js';
import api from '../../services/api';

const links = [
  { path: '/dashboard',  label: 'Dashboard' },
  { path: '/reports',    label: 'Reports' },
  { path: '/users',      label: 'Users' },
  { path: '/user-search', label: 'User Search' },
  { path: '/jobs',       label: 'Jobs' },
  { path: '/proposals',  label: 'Proposals' },
  { path: '/contracts',  label: 'Contracts' },
  { path: '/disputes',   label: 'Disputes' },
  { path: '/audit-logs', label: 'Audit Logs' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const onStorage = () => {
      try { setUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch { setUser({}); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className="admin-topbar">
      <div className="admin-topbar-left">
        <span style={{ fontSize: 18, marginRight: 4 }}>◈</span>
        <strong>FreeLedger</strong>
        <span className="admin-badge">Admin</span>
        <div className="dash-links">
          {links.map(l => (
            <Link key={l.path} to={l.path} className={pathname === l.path ? 'active' : ''}>{l.label}</Link>
          ))}
        </div>
      </div>
      <div className="admin-topbar-right">
        <NotificationBell />
        <div className="user-chip" onClick={() => navigate('/profile')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
            {(user.username || user.name || 'A').charAt(0).toUpperCase()}
          </div>
          <span style={{ color: 'var(--text-1)' }}>{user.username || user.name || 'Admin'}</span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { api.clearCache(); localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); localStorage.removeItem('user'); localStorage.removeItem('backup_login'); navigate('/login'); }}>Logout</button>
      </div>
    </div>
  );
}
