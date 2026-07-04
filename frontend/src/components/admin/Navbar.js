import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const links = [
  { path: '/dashboard',  label: 'Dashboard' },
  { path: '/users',      label: 'Users' },
  { path: '/jobs',       label: 'Jobs' },
  { path: '/proposals',  label: 'Proposals' },
  { path: '/contracts',  label: 'Contracts' },
  { path: '/disputes',   label: 'Disputes' },
  { path: '/audit-logs', label: 'Audit Logs' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
        <span style={{ fontSize: 12, opacity: 0.7 }}>Admin</span>
        <button className="btn btn-outline btn-sm" onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); localStorage.removeItem('user'); navigate('/login'); }}>Logout</button>
      </div>
    </div>
  );
}
