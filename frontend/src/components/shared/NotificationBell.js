import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = async () => {
    try {
      const [notiRes, countRes] = await Promise.all([
        api.get('/notifications/'),
        api.get('/notifications/unread-count'),
      ]);
      setNotifications(notiRes.data);
      setUnreadCount(countRes.data.count);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const typeIcon = (type) => {
    switch (type) {
      case 'milestone_rejected': return '✕';
      case 'milestone_submitted': return '▶';
      case 'milestone_approved': return '✓';
      case 'contract_completed': return '★';
      case 'dispute_raised': return '⚖';
      case 'dispute_resolved': return '⚖';
      default: return '●';
    }
  };

  const typeColor = (type) => {
    switch (type) {
      case 'milestone_rejected': return '#dc2626';
      case 'milestone_submitted': return '#3b82f6';
      case 'milestone_approved': return '#10b981';
      case 'contract_completed': return '#10b981';
      case 'dispute_raised': return '#f59e0b';
      case 'dispute_resolved': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white',
            fontSize: 10, fontWeight: 700, borderRadius: '50%', minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 10px 40px rgba(0,0,0,.15)', zIndex: 1000, maxHeight: 420, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No notifications yet</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: n.is_read ? 'default' : 'pointer',
                  background: n.is_read ? 'transparent' : 'var(--accent-pale, #f0f9ff)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'white',
                  background: typeColor(n.type),
                }}>
                  {typeIcon(n.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: n.is_read ? 400 : 700, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, opacity: 0.7 }}>
                    {n.created_at ? timeAgo(n.created_at) : ''}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
