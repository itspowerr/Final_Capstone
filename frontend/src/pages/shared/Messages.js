import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Messages({ NavbarComponent }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [jobCache, setJobCache] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesRef = useRef([]);

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const myId = currentUser.id;

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
      showToast('Failed to send', '⚠️');
    }
    setSending(false);
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
      showToast(err.response?.data?.detail || 'Failed to accept', '⚠️');
    }
  }

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 2500);
  }

  const threadMessagesEndRef = useRef(null);

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

  return (
    <div>
      <NavbarComponent activePage="messages" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">Messages</h1>
            <p className="page-sub">
              Conversations with other users
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: connected ? '#10b98133' : '#ef444433',
                color: connected ? '#10b981' : '#ef4444',
                fontWeight: 600,
              }}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 40, color: 'var(--text-3)' }}>Loading...</p>
        ) : threads.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>No messages yet</p>
            <p style={{ fontSize: 13 }}>Invitations and messages will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, maxWidth: 900 }}>
            <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                Conversations
              </div>
              {threads.map(t => (
                <div
                  key={t.partnerId}
                  onClick={() => { setActiveThread(t); setReplyText(''); }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: activeThread?.partnerId === t.partnerId ? 'var(--accent-pale)' : 'var(--surface)',
                    border: activeThread?.partnerId === t.partnerId ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{t.partnerId}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {t.lastMessage.content?.slice(0, 40)}...
                  </div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {activeThread ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-1)' }}>
                    Conversation with {activeThread.partnerId}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', padding: '4px 0', marginBottom: 16 }}>
                    {activeThread.messages.map(msg => {
                      const isMe = msg.sender_id === myId;
                      const job = msg.job_id ? jobCache[msg.job_id] : null;
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '80%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: isMe ? 'var(--accent)' : 'var(--surface)',
                            color: isMe ? '#fff' : 'var(--text-1)',
                            border: isMe ? 'none' : '1px solid var(--border)',
                          }}>
                            {job && (
                              <div style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg)',
                                marginBottom: 6,
                                fontSize: 12,
                              }}>
                                <div style={{ fontWeight: 700 }}>
                                  <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(isMe ? '/client/my-contracts' : '/freelancer/jobs')}>
                                    {job.title}
                                  </span>
                                </div>
                                <div style={{ opacity: 0.8, marginTop: 2 }}>
                                  Budget: {job.budget} ETH · Status: {job.status}
                                </div>
                              </div>
                            )}
                            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.content}</div>
                            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                              {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadMessagesEndRef} />
                  </div>

                  {activeThread.messages.some(m => m.job_id && m.sender_id !== myId && !activeThread.messages.some(
                    r => r.sender_id === myId && r.job_id === m.job_id && r.content?.includes('accepted')
                  )) && (
                    <div style={{ marginBottom: 12 }}>
                      {(() => {
                        const inviteJobIds = [...new Set(
                          activeThread.messages
                            .filter(m => m.job_id && m.sender_id !== myId)
                            .map(m => m.job_id)
                        )];
                        return inviteJobIds.map(jid => {
                          const job = jobCache[jid];
                          const alreadyAccepted = activeThread.messages.some(
                            m => m.sender_id === myId && m.job_id === jid && m.content?.toLowerCase().includes('accepted')
                          );
                          if (alreadyAccepted || !job) return null;
                          return (
                            <div key={jid} style={{
                              padding: '10px 14px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              marginBottom: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{job.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Budget: {job.budget} ETH</div>
                              </div>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => acceptJob(jid, activeThread.partnerId)}
                              >
                                Accept Invitation
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      placeholder="Type a reply..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(activeThread.partnerId); } }}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => sendReply(activeThread.partnerId)} disabled={sending || !replyText.trim()}>
                      {sending ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
                  Select a conversation to view messages
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
