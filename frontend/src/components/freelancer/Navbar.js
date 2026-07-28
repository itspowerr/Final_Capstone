import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import NotificationBell from '../shared/NotificationBell.js';
import api from '../../services/api';
import { getIPFSGatewayUrl } from '../../services/ipfs';
import '../../css/freelancer/navbar.css';

export default function Navbar({ activePage }) {
  const navigate = useNavigate();
  const { walletAddress, disconnectWallet } = useApp();
  const [user, setUser] = useState({ name: '—', role: '—', avatar_cid: '' });

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser({ name: u.username || u.email, role: u.role, avatar_cid: u.avatar_cid || '' });
      }
    };
    load();
    
    api.get('/users/me').then(res => {
      if (res.data) {
        setUser(prev => ({ ...prev, name: res.data.username || res.data.email, avatar_cid: res.data.avatar_cid || '' }));
        const raw = localStorage.getItem('user');
        if (raw) {
          const lsu = JSON.parse(raw);
          lsu.avatar_cid = res.data.avatar_cid;
          lsu.username = res.data.username;
          localStorage.setItem('user', JSON.stringify(lsu));
        }
      }
    }).catch(() => {});

    window.addEventListener('avatar-updated', load);
    return () => window.removeEventListener('avatar-updated', load);
  }, []);

  const handleLogout = () => {
    disconnectWallet();
    api.clearCache();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('backup_login');
    navigate('/login');
  };

  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <nav className="dash-nav">
      <div className="dash-nav-left">
        <a className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          FreeLedger
        </a>
        <div className="portal-tag">FREELANCER PORTAL</div>
        <div className="dash-links">
          <a className={activePage === 'dashboard' ? 'active' : ''} href="/freelancer/dashboard" onClick={(e) => { e.preventDefault(); navigate('/freelancer/dashboard'); }}>Dashboard</a>
          <a className={activePage === 'find-jobs' ? 'active' : ''} href="/freelancer/jobs" onClick={(e) => { e.preventDefault(); navigate('/freelancer/jobs'); }}>Find Jobs</a>
          <a className={activePage === 'my-contracts' ? 'active' : ''} href="/freelancer/contracts" onClick={(e) => { e.preventDefault(); navigate('/freelancer/contracts'); }}>My Contracts</a>
          <a className={activePage === 'messages' ? 'active' : ''} href="/freelancer/messages" onClick={(e) => { e.preventDefault(); navigate('/freelancer/messages'); }}>Messages</a>
        </div>
      </div>
      <div className="dash-nav-right">
        <NotificationBell />
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Logout
        </button>
        <div className="user-chip" onClick={() => navigate('/freelancer/my-profile')} style={{ cursor: 'pointer' }}>
          <div className="user-info">
            <div className="uname">{user.name}</div>
            <div className="urole">Freelancer</div>
            {walletAddress && (
              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
            )}
          </div>
          <div className="user-avatar">
            {user.avatar_cid ? <img src={getIPFSGatewayUrl(user.avatar_cid)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : avatarLetter}
          </div>
        </div>
      </div>
    </nav>
  );
}
