import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PostProjectModal from '../shared/PostProjectModal.js';
import NotificationBell from '../shared/NotificationBell.js';
import { useApp } from '../../context/AppContext';
import '../../css/client/navbar.css';

export default function Navbar({ activePage }) {
  const navigate = useNavigate();
  const { walletAddress, disconnectWallet } = useApp();
  const [user, setUser] = useState({ name: '—', role: '—', id: null, avatar_cid: '' });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser({ name: u.username || u.email, role: u.role, id: u.id, avatar_cid: u.avatar_cid || '' });
      }
    };
    load();
    window.addEventListener('avatar-updated', load);
    return () => window.removeEventListener('avatar-updated', load);
  }, []);

  const handleLogout = () => {
    disconnectWallet();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('backup_login');
    navigate('/login');
  };

  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <>
      <nav className="dash-nav">
        <div className="dash-nav-left">
          <a className="nav-logo">
            <div className="nav-logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            FreeLedger
          </a>
          <div className="dash-tag">CLIENT PORTAL</div>
          <div className="dash-nav-links">
            <a className={activePage === 'dashboard' ? 'active' : ''} href="/client/dashboard" onClick={(e) => { e.preventDefault(); navigate('/client/dashboard'); }}>Dashboard</a>
            <a className={activePage === 'browse-freelancers' ? 'active' : ''} href="/client/browse-freelancers" onClick={(e) => { e.preventDefault(); navigate('/client/browse-freelancers'); }}>Browse Freelancers</a>
            <a className={activePage === 'explore-jobs' ? 'active' : ''} href="/client/explore-jobs" onClick={(e) => { e.preventDefault(); navigate('/client/explore-jobs'); }}>Explore Jobs</a>
            <a className={activePage === 'my-contracts' ? 'active' : ''} href="/client/my-contracts" onClick={(e) => { e.preventDefault(); navigate('/client/my-contracts'); }}>My Contracts</a>
            <a className={activePage === 'messages' ? 'active' : ''} href="/client/messages" onClick={(e) => { e.preventDefault(); navigate('/client/messages'); }}>Messages</a>
          </div>
        </div>
        <div className="dash-nav-right">
          <NotificationBell />
          <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>+ Post New Project</button>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Logout
          </button>
          <div className="settings-btn" onClick={() => console.log('[Nav] Settings')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></svg>
          </div>
          <div className="user-chip" onClick={() => navigate('/client/profile')} style={{ cursor: 'pointer' }}>
            <div className="user-info">
              <div className="uname">{user.name}</div>
              <div className="urole">{user.role === 'Client' ? 'Client' : user.role}</div>
              {walletAddress && (
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
              )}
            </div>
            <div className="user-avatar">
              {user.avatar_cid ? <img src={`http://localhost:8080/ipfs/${user.avatar_cid}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : avatarLetter}
            </div>
          </div>
        </div>
      </nav>

      <PostProjectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
