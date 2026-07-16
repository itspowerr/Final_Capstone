import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#c026d3'];

function getAvatarColor(id) {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

function Avatar({ id, avatarCid, size = 42, style = {} }) {
  const color = getAvatarColor(id);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff',
      background: color, overflow: 'hidden', ...style,
    }}>
      {avatarCid
        ? <img src={`http://localhost:8080/ipfs/${avatarCid}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (id || '?')[0].toUpperCase()
      }
    </div>
  );
}

export default function Messages({ NavbarComponent }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [jobCache, setJobCache] = useState({});
  const [avatarCache, setAvatarCache] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesRef = useRef([]);
  const threadMessagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const myId = currentUser.id;
  const myRole = currentUser.role;

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await api.get('/messages/inbox');
      setMessages(data);
      messagesRef.current = data;
      const jobIds = [...new Set(data.filter(m => m.job_id).map(m => m.job_id))];
      const cache = {};
      await Promise.all(jobIds.map(async id => {
        try {
          const { data: job } = await api.get(`/jobs/${id}`);
          cache[id] = job;
        } catch {
          try {
            const { data: jdata } = await api.get('/jobs', { params: { ids: id } });
            if (jdata.jobs?.length) cache[id] = jdata.jobs[0];
          } catch {}
        }
      }));
      setJobCache(prev => ({ ...prev, ...cache }));
      const partnerIds = [...new Set(data.map(m => m.sender_id === myId ? m.receiver_id : m.sender_id).filter(Boolean))];
      if (partnerIds.length) {
        try {
          const { data: udata } = await api.get('/users', { params: { ids: partnerIds.join(',') } });
          const amap = {};
          (udata.users || []).forEach(u => { amap[u.id] = { avatar_cid: u.avatar_cid || '', name: u.username || u.email || '' }; });
          setAvatarCache(prev => ({ ...prev, ...amap }));
        } catch {}
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!myId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/messages/ws/${myId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (wsRef.current === ws) {
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
        }
      }, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            const updated = [...prev, data.message];
            messagesRef.current = updated;
            return updated;
          });
        } else if (data.type === 'message_read') {
          setMessages(prev => {
            const updated = prev.map(m => m.id === data.message_id ? { ...m, read: true } : m);
            messagesRef.current = updated;
            return updated;
          });
        } else if (data.type === 'thread_deleted') {
          setMessages(prev => {
            const updated = prev.filter(m =>
              !((m.sender_id === data.partner_id && m.receiver_id === myId) ||
                (m.sender_id === myId && m.receiver_id === data.partner_id))
            );
            messagesRef.current = updated;
            return updated;
          });
          setActiveThread(prev => prev?.partnerId === data.partner_id ? null : prev);
        }
      } catch {}
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [myId]);

  function getThreads() {
    const threadMap = {};
    messages.forEach(msg => {
      const partner = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
      if (!threadMap[partner]) threadMap[partner] = [];
      threadMap[partner].push(msg);
    });
    return Object.entries(threadMap)
      .map(([partnerId, msgs]) => ({
        partnerId,
        messages: msgs,
        lastMessage: msgs[msgs.length - 1],
        unread: msgs.filter(m => m.receiver_id === myId && !m.read).length,
      }))
      .sort((a, b) => (b.lastMessage.created_at || '').localeCompare(a.lastMessage.created_at || ''));
  }

  async function sendReply(partnerId) {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const threadMsgs = messages.filter(m =>
        (m.sender_id === myId && m.receiver_id === partnerId) ||
        (m.sender_id === partnerId && m.receiver_id === myId)
      );
      const lastWithJob = [...threadMsgs].reverse().find(m => m.job_id);
      await api.post('/messages/send', {
        receiver_id: partnerId,
        job_id: lastWithJob?.job_id || undefined,
        content: replyText.trim(),
      });
      setReplyText('');
    } catch {
      showToast('Failed to send', '!');
    }
    setSending(false);
  }

  async function markThreadRead(partnerId) {
    setMessages(prev => prev.map(m =>
      m.sender_id === partnerId && m.receiver_id === myId ? { ...m, read: true } : m
    ));
    try {
      await api.post(`/messages/thread/${partnerId}/read`);
    } catch {}
  }

  async function acceptJob(jobId, partnerId) {
    try {
      await api.post('/proposals', {
        job_id: jobId,
        cover_letter: 'I accept this invitation.',
        bid_amount: jobCache[jobId]?.budget || 0,
        estimated_days: jobCache[jobId]?.duration_days || 30,
      });
      await api.post('/messages/send', {
        receiver_id: partnerId,
        job_id: jobId,
        content: 'I accepted the invitation! Looking forward to working on this.',
      });
      showToast('Job accepted!');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to accept', '!');
    }
  }

  async function deleteThread(partnerId) {
    if (!window.confirm('Delete this entire conversation?')) return;
    try {
      await api.delete(`/messages/thread/${partnerId}`);
      setMessages(prev => prev.filter(m =>
        !((m.sender_id === myId && m.receiver_id === partnerId) ||
          (m.sender_id === partnerId && m.receiver_id === myId))
      ));
      setActiveThread(null);
      showToast('Conversation deleted');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to delete';
      showToast(msg, '!');
    }
  }

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '+' });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    if (activeThread && threadMessagesEndRef.current) {
      threadMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeThread]);

  const threads = getThreads();

  useEffect(() => {
    if (activeThread) {
      const updated = threads.find(t => t.partnerId === activeThread.partnerId);
      if (updated) setActiveThread(updated);
    }
  }, [messages]);

  useEffect(() => {
    if (activeThread && inputRef.current) inputRef.current.focus();
  }, [activeThread]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <NavbarComponent activePage="messages" />

      <style>{`
        .msg-layout { display: flex; height: calc(100vh - 80px); max-width: 1200px; margin: 0 auto; }
        .msg-sidebar {
          width: 320px; flex-shrink: 0; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; background: var(--white);
        }
        .msg-sidebar-header {
          padding: 20px 20px 16px; border-bottom: 1px solid var(--border);
        }
        .msg-sidebar-header h2 {
          font-size: 20px; font-weight: 800; letter-spacing: -.4px; margin-bottom: 2px;
        }
        .msg-sidebar-header p { font-size: 13px; color: var(--text-3); }
        .msg-list { flex: 1; overflow-y: auto; }
        .msg-thread {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; cursor: pointer; transition: background .15s;
          border-bottom: 1px solid #f1f5f9; position: relative;
        }
        .msg-thread:hover { background: #f8fafc; }
        .msg-thread:hover .msg-thread-delete { opacity: .6; }
        .msg-thread-delete:hover { opacity: 1 !important; }
        .msg-thread.active { background: var(--accent-pale); }
        .msg-thread-avatar {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: #fff;
        }
        .msg-thread-info { flex: 1; min-width: 0; }
        .msg-thread-name {
          font-size: 13.5px; font-weight: 600; color: var(--text); margin-bottom: 2px;
          display: flex; align-items: center; gap: 6px;
        }
        .msg-thread-preview {
          font-size: 12.5px; color: var(--text-3); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .msg-thread-meta { text-align: right; flex-shrink: 0; }
        .msg-thread-time { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
        .msg-unread-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; border-radius: 9px;
          background: var(--accent); color: #fff; font-size: 10px; font-weight: 700;
          padding: 0 5px;
        }
        .msg-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .msg-chat-header {
          padding: 16px 24px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 12px; background: var(--white);
        }
        .msg-chat-header-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
        }
        .msg-chat-header-info h3 { font-size: 14px; font-weight: 700; }
        .msg-chat-header-info p { font-size: 12px; color: var(--text-3); }
        .msg-chat-messages {
          flex: 1; overflow-y: auto; padding: 20px 24px;
          display: flex; flex-direction: column; gap: 6px;
          background: #f8fafc;
        }
        .msg-bubble-row { display: flex; }
        .msg-bubble-row.me { justify-content: flex-end; }
        .msg-bubble-row.them { justify-content: flex-start; }
        .msg-bubble {
          max-width: 65%; padding: 10px 14px; border-radius: 16px;
          font-size: 13.5px; line-height: 1.55; position: relative;
        }
        .msg-bubble.me {
          background: var(--accent); color: #fff;
          border-bottom-right-radius: 4px;
        }
        .msg-bubble.them {
          background: var(--white); color: var(--text);
          border: 1px solid var(--border); border-bottom-left-radius: 4px;
        }
        .msg-bubble-time {
          font-size: 10.5px; margin-top: 4px; opacity: .55;
        }
        .msg-bubble.me .msg-bubble-time { text-align: right; }
        .msg-job-card {
          padding: 8px 12px; border-radius: 8px; margin-bottom: 6;
          font-size: 12px; background: rgba(255,255,255,.15);
        }
        .msg-bubble.them .msg-job-card { background: var(--surface); }
        .msg-job-card-title { font-weight: 700; margin-bottom: 2px; }
        .msg-job-card-title span {
          cursor: pointer; text-decoration: underline;
        }
        .msg-job-card-meta { opacity: .8; font-size: 11px; }
        .msg-invite-card {
          background: var(--white); border: 1px solid var(--accent-border);
          border-radius: 12px; padding: 16px; margin-bottom: 10px;
        }
        .msg-invite-card h4 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .msg-invite-card p { font-size: 12px; color: var(--text-3); margin-bottom: 12px; }
        .msg-invite-card .btn-accept {
          width: 100%; padding: 10px; border-radius: 8px; font-size: 13px;
          font-weight: 600; border: none; cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, var(--accent), var(--accent-dark));
          color: #fff; transition: all .18s;
        }
        .msg-invite-card .btn-accept:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(37,99,235,.35);
        }
        .msg-input-bar {
          padding: 16px 24px; border-top: 1px solid var(--border);
          display: flex; gap: 10px; align-items: center; background: var(--white);
        }
        .msg-input-bar input {
          flex: 1; padding: 11px 16px; border-radius: 10px;
          border: 1px solid var(--border); font-size: 13.5px;
          font-family: inherit; outline: none; transition: border .15s;
          background: var(--surface);
        }
        .msg-input-bar input:focus { border-color: var(--accent); }
        .msg-send-btn {
          width: 40px; height: 40px; border-radius: 10px; border: none;
          background: var(--accent); color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .18s; flex-shrink: 0;
        }
        .msg-send-btn:hover:not(:disabled) {
          background: var(--accent-dark);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,.3);
        }
        .msg-send-btn:disabled { opacity: .4; cursor: default; }
        .msg-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; color: var(--text-3); padding: 60px;
        }
        .msg-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: .3; }
        .msg-empty h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: var(--text-2); }
        .msg-empty p { font-size: 13px; }
        .msg-loading {
          flex: 1; display: flex; align-items: center; justify-content: center;
          color: var(--text-3); font-size: 14px;
        }
        .msg-date-sep {
          text-align: center; font-size: 11px; font-weight: 600;
          color: var(--text-3); padding: 8px 0; letter-spacing: .3px;
        }
        @media (max-width: 768px) {
          .msg-sidebar { width: 100%; }
          .msg-chat { display: none; }
          .msg-chat.visible { display: flex; position: fixed; inset: 0; z-index: 100; }
          .msg-back-btn { display: flex !important; }
        }
      `}</style>

      <div className="msg-layout">
        {/* Sidebar */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2>Messages</h2>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600,
                background: connected ? '#ecfdf5' : '#fef2f2',
                color: connected ? '#059669' : '#dc2626',
                border: `1px solid ${connected ? '#a7f3d0' : '#fecaca'}`,
              }}>
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
            <p>{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="msg-list">
            {threads.map(t => (
              <div
                key={t.partnerId}
                className={`msg-thread ${activeThread?.partnerId === t.partnerId ? 'active' : ''}`}
                onClick={() => { setActiveThread(t); setReplyText(''); markThreadRead(t.partnerId); }}
              >
                <Avatar id={t.partnerId} avatarCid={avatarCache[t.partnerId]?.avatar_cid} size={42} />
                <div className="msg-thread-info">
                  <div className="msg-thread-name">
                    {avatarCache[t.partnerId]?.name || (t.partnerId || '').slice(0, 18)}
                  </div>
                  <div className="msg-thread-preview">
                    {t.lastMessage.sender_id === myId ? 'You: ' : ''}
                    {t.lastMessage.content?.slice(0, 45)}
                  </div>
                </div>
                <div className="msg-thread-meta">
                  <div className="msg-thread-time">{formatTime(t.lastMessage.created_at)}</div>
                  {t.unread > 0 && <div className="msg-unread-badge">{t.unread}</div>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteThread(t.partnerId); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, background: 'none',
                    border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity .15s',
                    color: '#dc2626', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className="msg-thread-delete"
                  title="Delete conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            ))}
            {threads.length === 0 && !loading && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`msg-chat ${activeThread ? 'visible' : ''}`}>
          {loading ? (
            <div className="msg-loading">Loading messages...</div>
          ) : !activeThread ? (
            <div className="msg-empty">
              <div className="msg-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3>Select a conversation</h3>
              <p>Choose a thread from the sidebar to start messaging</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="msg-chat-header">
                <button
                  className="msg-back-btn"
                  onClick={() => setActiveThread(null)}
                  style={{
                    display: 'none', border: 'none', background: 'none',
                    fontSize: 20, cursor: 'pointer', color: 'var(--text-2)', padding: '0 8px 0 0',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <Avatar id={activeThread.partnerId} avatarCid={avatarCache[activeThread.partnerId]?.avatar_cid} size={36} />
                <div className="msg-chat-header-info">
                  <h3>{avatarCache[activeThread.partnerId]?.name || activeThread.partnerId}</h3>
                  <p>{activeThread.messages.length} message{activeThread.messages.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => deleteThread(activeThread.partnerId)}
                    style={{
                      background: 'none', border: '1px solid #fecaca', borderRadius: 8,
                      padding: '6px 10px', cursor: 'pointer', color: '#dc2626',
                      fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'all .15s',
                    }}
                    title="Delete conversation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="msg-chat-messages">
                {activeThread.messages.map((msg, i) => {
                  const isMe = msg.sender_id === myId;
                  const job = msg.job_id ? jobCache[msg.job_id] : null;
                  const prevMsg = activeThread.messages[i - 1];
                  const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                  const isFirstOfJob = job && (!prevMsg || prevMsg.job_id !== msg.job_id);

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="msg-date-sep">
                          {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                      <div className={`msg-bubble-row ${isMe ? 'me' : 'them'}`}>
                        {!isMe && <Avatar id={activeThread.partnerId} avatarCid={avatarCache[activeThread.partnerId]?.avatar_cid} size={28} style={{ marginTop: 2, marginRight: 6 }} />}
                        <div className={`msg-bubble ${isMe ? 'me' : 'them'}`}>
                          {isFirstOfJob && (
                            <div className="msg-job-card">
                              <div className="msg-job-card-title">
                                <span onClick={() => navigate(isMe ? '/client/my-contracts' : '/freelancer/jobs')}>
                                  {job.title}
                                </span>
                              </div>
                              <div className="msg-job-card-meta">
                                Budget: {job.budget} ETH &middot; {job.status}
                              </div>
                            </div>
                          )}
                          <div>{msg.content}</div>
                          <div className="msg-bubble-time">{formatFullTime(msg.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadMessagesEndRef} />
              </div>

              {/* Job invitation cards — only visible to freelancers (recipients) */}
              {myRole === 'freelancer' && activeThread.messages.some(m => m.job_id && m.sender_id !== myId && !activeThread.messages.some(
                r => r.sender_id === myId && r.job_id === m.job_id && r.content?.includes('accepted')
              )) && (
                <div style={{ padding: '0 24px' }}>
                  {[...new Set(
                    activeThread.messages.filter(m => m.job_id && m.sender_id !== myId).map(m => m.job_id)
                  )].map(jid => {
                    const job = jobCache[jid];
                    const alreadyAccepted = activeThread.messages.some(
                      m => m.sender_id === myId && m.job_id === jid && m.content?.toLowerCase().includes('accepted')
                    );
                    if (alreadyAccepted || !job) return null;
                    return (
                      <div className="msg-invite-card" key={jid}>
                        <h4>{job.title}</h4>
                        <p>Budget: {job.budget} ETH &middot; Duration: {job.duration_days || 30} days</p>
                        <button className="btn-accept" onClick={() => acceptJob(jid, activeThread.partnerId)}>
                          Accept Invitation
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Input */}
              <div className="msg-input-bar">
                <input
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(activeThread.partnerId); } }}
                />
                <button
                  className="msg-send-btn"
                  onClick={() => sendReply(activeThread.partnerId)}
                  disabled={sending || !replyText.trim()}
                  title="Send"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
