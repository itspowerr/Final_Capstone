import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import useUnreadMessages from '../../hooks/useUnreadMessages';
import api from '../../services/api';
import '../../css/freelancer/navbar.css';

function NavIcon({ type }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (type === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (type === 'jobs') return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /></svg>;
  if (type === 'contracts') return <svg {...common}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
  if (type === 'messages') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
  if (type === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
  if (type === 'chevron') return <svg {...common} width="14" height="14"><path d="m6 9 6 6 6-6" /></svg>;
  if (type === 'check') return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  if (type === 'spark') return <svg {...common}><path d="M13 2 4 14h7l-1 8 10-12h-7l1-8Z" /></svg>;
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
  const [user, setUser] = useState({ name: '-', role: '-' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [seenIds, setSeenIds] = useState(() => safeArray('fl_seen_notifications'));
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
      const [contractsRes, jobsRes] = await Promise.all([
        api.get('/contracts', { params: { limit: 10 } }).catch(() => null),
        api.get('/jobs', { params: { status: 'open', limit: 10 } }).catch(() => null),
      ]);
      setContracts(contractsRes?.data?.contracts || []);
      setJobs(Array.isArray(jobsRes?.data) ? jobsRes.data : []);
    } catch {
      // Notification polling should never break the navbar.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 30000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    localStorage.setItem('fl_seen_notifications', JSON.stringify(seenIds));
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
    const hired = contracts
      .filter(c => c.freelancer_id === user.id || !user.id)
      .map(c => ({
        id: `hired:${c.id}`,
        type: 'hired',
        title: 'You were hired',
        body: c.title || 'A client assigned you to a contract',
        time: c.created_at,
        path: '/freelancer/contracts',
      }));

    const newJobs = jobs.map(j => ({
      id: `job:${j.id}`,
      type: 'job',
      title: 'New job listed',
      body: j.title || 'A new open project is available',
      time: j.created_at,
      path: '/freelancer/jobs',
    }));

    return [...hired, ...newJobs]
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
      .slice(0, 8);
  }, [contracts, jobs, user.id]);

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
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/freelancer/dashboard', icon: 'dashboard' },
    { key: 'find-jobs', label: 'Find Jobs', path: '/freelancer/jobs', icon: 'jobs' },
    { key: 'my-contracts', label: 'Contracts', path: '/freelancer/contracts', icon: 'contracts' },
    { key: 'messages', label: 'Messages', path: '/freelancer/messages', icon: 'messages' },
  ];

  return (
    <nav className="dash-nav freelancer-modern-nav" ref={navRef}>
      <div className="freelancer-brand-wrap">
        <a className="nav-logo freelancer-brand" href="/freelancer/dashboard" onClick={go('/freelancer/dashboard')}>
          <div className="nav-logo-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          <span>
            <strong>FreeLedger</strong>
            <small>Freelancer Workspace</small>
          </span>
        </a>
      </div>

      <div className="dash-links freelancer-nav-links">
        {navItems.map((item) => (
          <a key={item.key} className={activePage === item.key ? 'active' : ''} href={item.path} onClick={go(item.path)}>
            <NavIcon type={item.icon} />
            <span>{item.label}</span>
            {item.key === 'messages' && unreadMessages > 0 && <em>{unreadMessages > 99 ? '99+' : unreadMessages}</em>}
          </a>
        ))}
      </div>

      <div className="dash-nav-right freelancer-nav-actions">
        <div className="freelancer-notification-wrap">
          <button className="nav-bell" type="button" aria-label="Notifications" onClick={() => { setNotificationsOpen(open => !open); setMenuOpen(false); }}>
            <NavIcon type="bell" />
            {unreadNotifications > 0 && <span>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
          </button>
          {notificationsOpen && (
            <div className="freelancer-notification-panel">
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
                    <span className={'notification-icon ' + item.type}><NavIcon type={item.type === 'hired' ? 'check' : 'spark'} /></span>
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
        <div className="freelancer-user-menu">
          <button className="user-chip modern-user-chip" type="button" onClick={() => { setMenuOpen(open => !open); setNotificationsOpen(false); }}>
            <div className="user-avatar">{avatarLetter}</div>
            <div className="user-info">
              <div className="uname">{user.name}</div>
              <div className="urole">Freelancer</div>
              {walletAddress && <div className="wallet-mini">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}
            </div>
            <NavIcon type="chevron" />
          </button>
          {menuOpen && (
            <div className="freelancer-user-dropdown">
              <button type="button" onClick={() => { setMenuOpen(false); navigate('/freelancer/my-profile'); }}>My Profile</button>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}