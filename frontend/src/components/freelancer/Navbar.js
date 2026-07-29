import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import NotificationBell from '../shared/NotificationBell.js';
import AccountMenu from '../shared/AccountMenu.js';
import api from '../../services/api';
import '../../css/freelancer/navbar.css';

export default function Navbar({ activePage }) {
  const navigate = useNavigate();
  const { walletAddress: ctxWalletAddress, disconnectWallet } = useApp();
  const [user, setUser] = useState({ name: '—', role: '—', avatar_cid: '' });
  const walletAddress = ctxWalletAddress || user?.wallet_address;

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

  return (
    <nav className="dash-nav">
      <div className="dash-nav-left">
        <a className="nav-logo" href="/freelancer/dashboard" onClick={(e) => { e.preventDefault(); navigate('/freelancer/dashboard'); }}>
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
        <AccountMenu user={user} roleLabel="Freelancer" walletAddress={walletAddress} profilePath="/freelancer/my-profile" onLogout={handleLogout} />
      </div>
    </nav>
  );
}
