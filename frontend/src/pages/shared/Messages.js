import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConversationList from '../../components/messages/ConversationList';
import ChatArea from '../../components/messages/ChatArea';
import ContextPanel from '../../components/messages/ContextPanel';
import api from '../../services/api';
import config from '../../config';
import '../../css/shared/messages.css';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const wsRef = useRef(null);
  const messagesRef = useRef([]);
  const threadMessagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [dismissedJobs, setDismissedJobs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissedJobs') || '[]')); }
    catch { return new Set(); }
  });
  const [proposalJobIds, setProposalJobIds] = useState(new Set());
  const [backendDismissedJobs, setBackendDismissedJobs] = useState(new Set());

  const effectiveDismissed = new Set([...dismissedJobs, ...backendDismissedJobs]);

  const [searchParams] = useSearchParams();
  const initialUserParam = useRef(searchParams.get('user'));
  const initialHandled = useRef(false);
  const threadsRef = useRef([]);

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

    if (myRole === 'freelancer') {
      try {
        const { data: proposalsData } = await api.get('/proposals');
        setProposalJobIds(new Set((proposalsData.proposals || []).map(p => p.job_id)));
      } catch {}
      try {
        const { data: dismissedData } = await api.get('/messages/invitations/dismissed');
        setBackendDismissedJobs(new Set(dismissedData.job_ids || []));
      } catch {}
    }

    setLoading(false);
  }, [myRole]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (loading || initialHandled.current || !initialUserParam.current) return;
    initialHandled.current = true;

    const path = window.location.pathname;
    navigate(path, { replace: true });

    const userId = initialUserParam.current;
    const existing = threadsRef.current.find(t => t.partnerId === userId);
    if (existing) {
      setActiveThread(existing);
      markThreadRead(existing.partnerId);
      return;
    }

    (async () => {
      try {
        const { data } = await api.get('/users', { params: { ids: userId } });
        const user = (data.users || [])[0];
        if (user) {
          setAvatarCache(prev => ({
            ...prev,
            [userId]: { avatar_cid: user.avatar_cid || '', name: user.username || user.email || '' }
          }));
        }
      } catch {}
      setActiveThread({ partnerId: userId, messages: [], lastMessage: null, unread: 0 });
    })();
  }, [loading, navigate]);

  useEffect(() => {
    if (!myId) return;
    const apiOrigin = new URL(config.apiUrl).origin;
    const wsProtocol = apiOrigin.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = apiOrigin.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}/api/messages/ws/${myId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onclose = () => {
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
    const content = replyText.trim();
    try {
      const threadMsgs = messages.filter(m =>
        (m.sender_id === myId && m.receiver_id === partnerId) ||
        (m.sender_id === partnerId && m.receiver_id === myId)
      );
      const lastWithJob = [...threadMsgs].reverse().find(m => m.job_id);
      const { data } = await api.post('/messages/send', {
        receiver_id: partnerId,
        job_id: lastWithJob?.job_id || undefined,
        content,
      });
      const optimistic = {
        id: data.message_id,
        sender_id: myId,
        receiver_id: partnerId,
        content,
        job_id: lastWithJob?.job_id || null,
        read: false,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => {
        if (prev.some(m => m.id === optimistic.id)) return prev;
        const updated = [...prev, optimistic];
        messagesRef.current = updated;
        return updated;
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
      setProposalJobIds(prev => new Set([...prev, jobId]));
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

  async function dismissJob(jobId) {
    setDismissedJobs(prev => {
      const next = new Set([...prev, jobId]);
      localStorage.setItem('dismissedJobs', JSON.stringify([...next]));
      return next;
    });
    try {
      await api.post(`/messages/invitations/${jobId}/dismiss`);
    } catch {}
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

  function handleSelectThread(t) {
    setActiveThread(t);
    setReplyText('');
    markThreadRead(t.partnerId);
  }

  function handleBack() {
    setActiveThread(null);
  }

  function handleToggleContextPanel() {
    setContextPanelOpen(prev => !prev);
  }

  useEffect(() => {
    if (activeThread && threadMessagesEndRef.current) {
      threadMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeThread]);

  const threads = getThreads();
  threadsRef.current = threads;

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
    <div style={{ minHeight: '100vh', background: 'var(--landing-mist, #f7f9fc)' }}>
      <NavbarComponent activePage="messages" />

      <div style={{ padding: '32px 24px', height: 'calc(100vh - 76px)', maxWidth: 1280, margin: '0 auto' }}>
        <div className="msg-layout">
          <ConversationList
            threads={threads}
            activeThread={activeThread}
            onSelectThread={handleSelectThread}
            avatarCache={avatarCache}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            loading={loading}
          />

          <ChatArea
            loading={loading}
            activeThread={activeThread}
            messages={messages}
            jobCache={jobCache}
            avatarCache={avatarCache}
            replyText={replyText}
            onReplyChange={setReplyText}
            sending={sending}
            onSend={sendReply}
            myId={myId}
            myRole={myRole}
            effectiveDismissed={effectiveDismissed}
            proposalJobIds={proposalJobIds}
            onAcceptJob={acceptJob}
            onDismissJob={dismissJob}
            onDeleteThread={deleteThread}
            threadMessagesEndRef={threadMessagesEndRef}
            inputRef={inputRef}
            onBack={handleBack}
            navigate={navigate}
          />

          <ContextPanel
            activeThread={activeThread}
            avatarCache={avatarCache}
            collapsed={!contextPanelOpen}
            onToggle={handleToggleContextPanel}
            myRole={myRole}
            myId={myId}
          />
        </div>
      </div>

      {toast && (
        <div className="toast">
          <span className="toast-icon">{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
