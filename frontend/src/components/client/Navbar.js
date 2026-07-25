import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PostProjectModal from '../shared/PostProjectModal.js';
import { useApp } from '../../context/AppContext';
import useUnreadMessages from '../../hooks/useUnreadMessages';
import api from '../../services/api';
import '../../css/client/navbar.css';

function NavIcon({ type }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (type === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (type === 'freelancers') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (type === 'jobs') return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /></svg>;
  if (type === 'contracts') return <svg {...common}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
  if (type === 'messages') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
  if (type === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
  if (type === 'chevron') return <svg {...common} width="14" height="14"><path d="m6 9 6 6 6-6" /></svg>;
  if (type === 'proposal') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  if (type === 'review') return <svg {...common}><path d="M9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
  if (type === 'logout') return <svg {...common} width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
  return null;
}

function safeArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function relativeTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.max(1, Math.floor(diff / 3600000))}h ago`;
  return `${Math.max(1, Math.floor(diff / 86400000))}d ago`;
}

export default function Navbar({ activePage }) {
  const navigate = useNavigate();
  const { walletAddress, disconnectWallet } = useApp();
  const unreadMessages = useUnreadMessages();
  const [user, setUser] = useState({ name: '-', role: '-', id: null });
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [seenIds, setSeenIds] = useState(() => safeArray('client_seen_notifications'));
  const navRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      setUser({ name: u.username || u.email, role: u.role, id: u.id });
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!localStorage.getItem('access_token')) return;
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const [proposalRes, contractRes] = await Promise.all([
        currentUser.id ? api.get('/proposals', { params: { client_id: currentUser.id, limit: 10 } }).catch(() => null) : null,
        api.get('/contracts', { params: { limit: 10 } }).catch(() => null),
      ]);
      setProposals(proposalRes?.data?.proposals || []);
      setContracts(contractRes?.data?.contracts || []);
    } catch {
      // Navbar notifications should fail silently.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 30000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    localStorage.setItem('client_seen_notifications', JSON.stringify(seenIds));
  }, [seenIds]);
  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (event.key && event.key !== 'Escape') return;
      if (!event.key && navRef.current?.contains(event.target)) return;
      setMenuOpen(false);
      setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    document.addEventListener('keydown', handleOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('keydown', handleOutsideInteraction);
    };
  }, []);

  const notifications = useMemo(() => {
    const proposalItems = proposals.map(p => ({
      id: `proposal:${p.id}`,
      type: 'proposal',
      title: 'New proposal received',
      body: `Bid: ${Number(p.bid_amount || 0).toLocaleString()} ETH`,
      time: p.created_at,
      path: '/client/dashboard',
    }));

    const reviewItems = contracts.flatMap(c => (c.milestones || [])
      .filter(m => (m.status || '').toLowerCase() === 'submitted')
      .map(m => ({
        id: `review:${c.id}:${m.index}`,
        type: 'review',
        title: 'Contract needs review',
        body: c.title || m.description || 'A milestone was submitted',
        time: m.submitted_at || c.updated_at || c.created_at,
        path: '/client/my-contracts',
      })));

    return [...proposalItems, ...reviewItems]
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
      .slice(0, 8);
  }, [proposals, contracts]);

  const unreadNotifications = notifications.filter(n => !seenIds.includes(n.id)).length;

  const markAllNotificationsRead = () => {
    setSeenIds(prev => Array.from(new Set([...prev, ...notifications.map(n => n.id)])));
  };

  const openNotification = (item) => {
    setSeenIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
    setNotificationsOpen(false);
    navigate(item.path);
  };

  const handleLogout = () => {
    disconnectWallet();
    navigate('/login');
  };

  const go = (path) => (event) => {
    event.preventDefault();
    navigate(path);
  };

  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';
  const roleLabel = String(user.role || '').toLowerCase() === 'client' ? 'Client' : user.role;
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/client/dashboard', icon: 'dashboard' },
    { key: 'browse-freelancers', label: 'Freelancers', path: '/client/browse-freelancers', icon: 'freelancers' },
    { key: 'explore-jobs', label: 'Jobs', path: '/client/explore-jobs', icon: 'jobs' },
    { key: 'my-contracts', label: 'Contracts', path: '/client/my-contracts', icon: 'contracts' },
    { key: 'messages', label: 'Messages', path: '/client/messages', icon: 'messages' },
  ];

  return (
    <>
      <nav className="dash-nav client-modern-nav" ref={navRef}>
        <div className="client-brand-wrap">
          <a className="nav-logo client-brand" href="/client/dashboard" onClick={go('/client/dashboard')}>
            <div className="nav-logo-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <span>
              <strong>FreeLedger</strong>
              <small>Client Workspace</small>
            </span>
          </a>
        </div>

        <div className="dash-nav-links client-nav-links">
          {navItems.map(item => (
            <a key={item.key} className={activePage === item.key ? 'active' : ''} href={item.path} onClick={go(item.path)}>
              <NavIcon type={item.icon} />
              <span>{item.label}</span>
              {item.key === 'messages' && unreadMessages > 0 && <em>{unreadMessages > 99 ? '99+' : unreadMessages}</em>}
            </a>
          ))}
        </div>

        <div className="dash-nav-right client-nav-actions">
          <button className="client-post-btn" type="button" onClick={() => setModalOpen(true)}>+ Post New Project</button>
          <div className="client-notification-wrap">
            <button className="nav-bell" type="button" aria-label="Notifications" onClick={() => { setNotificationsOpen(open => !open); setMenuOpen(false); }}>
              <NavIcon type="bell" />
              {unreadNotifications > 0 && <span>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
            </button>
            {notificationsOpen && (
              <div className="client-notification-panel">
                <div className="notification-panel-head">
                  <div>
                    <strong>Notifications</strong>
                    <small>{unreadNotifications} unread</small>
                  </div>
                  <button type="button" onClick={markAllNotificationsRead}>Mark read</button>
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="notification-empty">No notifications yet.</div>
                  ) : notifications.map(item => (
                    <button key={item.id} type="button" className={'notification-item' + (!seenIds.includes(item.id) ? ' unread' : '')} onClick={() => openNotification(item)}>
                      <span className={'notification-icon ' + item.type}><NavIcon type={item.type} /></span>
                      <span className="notification-copy">
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                        <small>{relativeTime(item.time)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="client-user-menu">
            <button className="user-chip modern-user-chip" type="button" onClick={() => { setMenuOpen(open => !open); setNotificationsOpen(false); }}>
              <div className="user-avatar">{avatarLetter}</div>
              <div className="user-info">
                <div className="uname">{user.name}</div>
                <div className="urole">{roleLabel}</div>
                {walletAddress && <div className="wallet-mini">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}
              </div>
              <NavIcon type="chevron" />
            </button>
            {menuOpen && (
              <div className="client-user-dropdown">
                <button type="button" onClick={() => { setMenuOpen(false); navigate('/client/profile'); }}>Profile</button>
                <button type="button" onClick={handleLogout}><NavIcon type="logout" /> Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <PostProjectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}