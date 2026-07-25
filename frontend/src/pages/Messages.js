import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ClientNavbar from '../components/client/Navbar';
import FreelancerNavbar from '../components/freelancer/Navbar';
import api from '../services/api';
import '../css/messages.css';

const errorText = (err, fallback) => err.response?.data?.detail?.message || err.response?.data?.detail || fallback;
const displayName = (u) => u?.username || u?.email || 'Unknown user';
const formatTime = (value) => value ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const safeJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };

export default function Messages() {
  const { search } = useLocation();
  const me = JSON.parse(localStorage.getItem('user') || '{}');
  const requestedUser = new URLSearchParams(search).get('user');
  const archiveKey = `freeledger_archived_threads_${me.id || 'guest'}`;
  const deleteKey = `freeledger_deleted_threads_${me.id || 'guest'}`;
  const pinnedKey = `freeledger_pinned_threads_${me.id || 'guest'}`;
  const mutedKey = `freeledger_muted_threads_${me.id || 'guest'}`;

  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [newContact, setNewContact] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [composeMode, setComposeMode] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactQuery, setContactQuery] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [archivedIds, setArchivedIds] = useState(() => safeJson(archiveKey));
  const [deletedIds, setDeletedIds] = useState(() => safeJson(deleteKey));
  const [pinnedIds, setPinnedIds] = useState(() => safeJson(pinnedKey));
  const [mutedIds, setMutedIds] = useState(() => safeJson(mutedKey));
  const bottom = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const { data } = await api.get('/messages/threads');
      setThreads(data.threads || []);
      return data.threads || [];
    } catch (err) {
      setError(errorText(err, 'Failed to load conversations'));
      return [];
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const role = me.role === 'client' ? 'freelancer' : 'client';
      const { data } = await api.get('/users', { params: { role, limit: 50, search: contactQuery || undefined } });
      setContacts((data.users || []).filter(u => u.id !== me.id));
    } catch (err) {
      setError(errorText(err, 'Failed to load contacts'));
    } finally {
      setContactsLoading(false);
    }
  }, [me.id, me.role, contactQuery]);

  const closeMenus = () => {
    setMoreOpen(false);
    setChatMenuOpen(false);
  };

  const goHome = () => {
    setActive(null);
    setNewContact(null);
    setMessages([]);
    setComposeMode(false);
    closeMenus();
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectMode(false);
  };

  const enterSelectionMode = () => {
    setSelectMode(true);
    setSelectedIds([]);
    setMoreOpen(false);
  };

  const cancelSelection = () => {
    clearSelection();
    closeMenus();
  };

  const openThread = useCallback(async (thread) => {
    setActive(thread);
    setNewContact(null);
    setComposeMode(false);
    closeMenus();
    try {
      const { data } = await api.get(`/messages/threads/${thread.id}`);
      setMessages(data.messages || []);
      setThreads(old => old.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
    } catch (err) {
      setError(errorText(err, 'Failed to load messages'));
    }
  }, []);

  const startNewConversation = () => {
    setComposeMode(true);
    setActive(null);
    setNewContact(null);
    setMessages([]);
    closeMenus();
    loadContacts();
  };

  const chooseContact = (user) => {
    const existing = threads.find(t => t.other_user?.id === user.id && !deletedIds.includes(t.id));
    if (existing) {
      openThread(existing);
      return;
    }
    setNewContact(user);
    setActive(null);
    setMessages([]);
    setComposeMode(false);
    closeMenus();
  };

  useEffect(() => {
    (async () => {
      const list = await loadThreads();
      if (requestedUser) {
        const found = list.find(t => t.other_user.id === requestedUser && !deletedIds.includes(t.id));
        if (found) openThread(found);
        else {
          try {
            const { data } = await api.get('/users', { params: { ids: requestedUser } });
            setNewContact(data.users?.[0] || null);
            setActive(null);
            setMessages([]);
          } catch {
            setError('Could not find that user');
          }
        }
      } else {
        setActive(null);
        setNewContact(null);
        setMessages([]);
        setComposeMode(false);
        closeMenus();
      }
      setLoading(false);
    })();
  }, [loadThreads, openThread, requestedUser, deletedIds]);

  useEffect(() => { localStorage.setItem(archiveKey, JSON.stringify(archivedIds)); }, [archiveKey, archivedIds]);
  useEffect(() => { localStorage.setItem(deleteKey, JSON.stringify(deletedIds)); }, [deleteKey, deletedIds]);
  useEffect(() => { localStorage.setItem(pinnedKey, JSON.stringify(pinnedIds)); }, [pinnedKey, pinnedIds]);
  useEffect(() => { localStorage.setItem(mutedKey, JSON.stringify(mutedIds)); }, [mutedKey, mutedIds]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/messages/threads/${active.id}`);
        setMessages(data.messages || []);
        loadThreads();
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [active, loadThreads]);
  useEffect(() => { if (composeMode) loadContacts(); }, [composeMode, loadContacts]);

  const visibleThreads = threads.filter(t => !deletedIds.includes(t.id));
  const unreadCount = visibleThreads.reduce((n, t) => n + (t.unread_count || 0), 0);
  const archivedCount = visibleThreads.filter(t => archivedIds.includes(t.id)).length;

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleThreads.filter(t => {
      const haystack = `${displayName(t.other_user)} ${t.latest_message?.content || ''} ${t.job?.title || ''}`.toLowerCase();
      const archived = archivedIds.includes(t.id);
      const matchesQuery = !q || haystack.includes(q);
      const matchesFilter = filter === 'all' ? !archived : filter === 'unread' ? !archived && t.unread_count > 0 : archived;
      return matchesQuery && matchesFilter;
    });
  }, [visibleThreads, query, filter, archivedIds]);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    return contacts.filter(u => !q || `${displayName(u)} ${u.email || ''} ${u.headline || ''}`.toLowerCase().includes(q));
  }, [contacts, contactQuery]);

  const toggleSelected = (id) => setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const markIdsRead = (ids) => { setThreads(old => old.map(t => ids.includes(t.id) ? { ...t, unread_count: 0 } : t)); clearSelection(); };
  const markAllRead = () => { setThreads(old => old.map(t => ({ ...t, unread_count: 0 }))); setMoreOpen(false); };
  const archiveIds = (ids) => { setArchivedIds(current => Array.from(new Set([...current, ...ids]))); if (active && ids.includes(active.id)) goHome(); clearSelection(); };
  const muteIds = (ids) => { setMutedIds(current => Array.from(new Set([...current, ...ids]))); clearSelection(); };
  const togglePinned = () => { if (!active) return; setPinnedIds(ids => ids.includes(active.id) ? ids.filter(id => id !== active.id) : [...ids, active.id]); setChatMenuOpen(false); };
  const toggleMuted = () => { if (!active) return; setMutedIds(ids => ids.includes(active.id) ? ids.filter(id => id !== active.id) : [...ids, active.id]); setChatMenuOpen(false); };
  const deleteIds = (ids) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} chat${ids.length > 1 ? 's' : ''} from this inbox?`)) return;
    setDeletedIds(current => Array.from(new Set([...current, ...ids])));
    setArchivedIds(current => current.filter(id => !ids.includes(id)));
    setPinnedIds(current => current.filter(id => !ids.includes(id)));
    setMutedIds(current => current.filter(id => !ids.includes(id)));
    if (active && ids.includes(active.id)) goHome();
    clearSelection();
  };

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    const receiver = active?.other_user?.id || newContact?.id;
    if (!content || !receiver) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/messages/send', { receiver_id: receiver, content });
      setMessages(old => [...old, data]);
      setDraft('');
      const list = await loadThreads();
      const thread = list.find(t => t.id === data.thread_id);
      if (thread) {
        setActive(thread);
        setNewContact(null);
        setDeletedIds(ids => ids.filter(id => id !== thread.id));
        setArchivedIds(ids => ids.filter(id => id !== thread.id));
      }
    } catch (err) {
      setError(errorText(err, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const Navbar = me.role === 'client' ? ClientNavbar : FreelancerNavbar;
  const target = active?.other_user || newContact;
  const selectedCount = selectedIds.length;

  return (
    <>
      <Navbar activePage="messages" />
      <main className="messages-page modern-messages">
        <div className="messages-shell">
          <aside className="conversation-list">
            <header className={`messages-sidebar-head ${selectMode ? 'select-head' : ''}`}>
              {selectMode ? (
                <>
                  <button className="cancel-select" type="button" onClick={cancelSelection}>← Cancel</button>
                  <strong>{selectedCount} Selected</strong>
                </>
              ) : (
                <>
                  <button className="messages-title-btn" type="button" onClick={goHome}>
                    <h1>Messages</h1>
                    <span>{unreadCount} unread</span>
                  </button>
                  <div className="tool-wrap">
                    <button className="text-tool main-more" type="button" title="More options" onClick={() => setMoreOpen(v => !v)}>⋮</button>
                    {moreOpen && (
                      <div className="tool-menu filter-menu message-more-menu">
                        <button type="button" onClick={enterSelectionMode}><span>☑</span>Select Conversations</button>
                        <div className="menu-divider"></div>
                        <button type="button" onClick={markAllRead}><span>✓</span>Mark all as read</button>
                        <button type="button" onClick={() => { loadThreads(); setMoreOpen(false); }}><span>↻</span>Refresh</button>
                        <div className="menu-divider"></div>
                        <button type="button" onClick={startNewConversation}><span>✏️</span>New Conversation</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </header>

            {selectMode && (
              <div className="selection-action-bar">
                <button type="button" disabled={!selectedCount} onClick={() => archiveIds(selectedIds)}><span>📁</span>Archive</button>
                <button type="button" disabled={!selectedCount} onClick={() => muteIds(selectedIds)}><span>🔕</span>Mute</button>
                <button type="button" disabled={!selectedCount} onClick={() => deleteIds(selectedIds)}><span>🗑</span>Delete</button>
                <button type="button" disabled={!selectedCount} onClick={() => markIdsRead(selectedIds)}><span>✓</span>Mark as Read</button>
              </div>
            )}

            <div className="message-tools">
              <label className="message-search"><span>Search</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations..." /></label>
            </div>
            <div className="message-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread</button><button className={filter === 'archived' ? 'active' : ''} onClick={() => setFilter('archived')}>Archived ({archivedCount})</button></div>
            <div className="conversation-scroll">
              {loading ? <div className="message-empty">Loading...</div> : filteredThreads.length === 0 ? <div className="message-empty">No conversations found.<small>{filter === 'archived' ? 'Archived conversations will appear here.' : 'Start one from the Messages home screen.'}</small></div> : filteredThreads.map(t => <div key={t.id} className={`conversation-row ${active?.id === t.id ? 'active' : ''} ${selectMode ? 'selecting' : ''}`} role="button" tabIndex={0} onClick={() => selectMode ? toggleSelected(t.id) : openThread(t)} onKeyDown={e => { if (e.key === 'Enter') selectMode ? toggleSelected(t.id) : openThread(t); }}>{selectMode && <input className="select-check" type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelected(t.id)} onClick={e => e.stopPropagation()} />}<div className="message-avatar">{displayName(t.other_user)[0].toUpperCase()}</div><div className="conversation-copy"><div><strong>{displayName(t.other_user)}</strong><time>{formatTime(t.latest_message?.created_at)}</time></div><p>{t.latest_message?.content || 'New conversation'}</p>{t.job && <small>{t.job.title}</small>}</div><div className="row-actions"><span className={`read-dot ${t.unread_count > 0 ? 'hot' : ''}`}></span></div></div>)}
            </div>
            <footer className="messages-sidebar-foot"><div className="inbox-icon">Inbox</div><div><strong>{unreadCount} unread messages</strong><p>{unreadCount ? 'You have messages waiting.' : "You're all caught up!"}</p></div></footer>
          </aside>

          <section className="chat-panel">
            {composeMode ? <div className="contact-picker"><button className="chat-home" type="button" onClick={goHome}>Back to inbox</button><span className="welcome-kicker">NEW CONVERSATION</span><h2>Choose someone to message</h2><p>Select a person below and write your first message from this page.</p><label className="contact-search"><span>Search</span><input value={contactQuery} onChange={e => setContactQuery(e.target.value)} placeholder={me.role === 'client' ? 'Search freelancers...' : 'Search clients...'} /></label><div className="contact-list">{contactsLoading ? <div className="message-empty">Loading contacts...</div> : filteredContacts.length === 0 ? <div className="message-empty">No people found.</div> : filteredContacts.map(u => <button key={u.id} type="button" className="contact-row" onClick={() => chooseContact(u)}><div className="message-avatar">{displayName(u)[0].toUpperCase()}</div><div><strong>{displayName(u)}</strong><p>{u.headline || u.role || u.email}</p></div></button>)}</div></div> : target ? <><header className="chat-header"><button className="chat-home" type="button" onClick={goHome}>Back to inbox</button><div className="message-avatar">{displayName(target)[0].toUpperCase()}</div><div><h2>{displayName(target)}</h2><p>{target.role}</p></div>{active && <div className="chat-menu-wrap"><button className="chat-overflow" type="button" onClick={() => setChatMenuOpen(v => !v)}>⋮</button>{chatMenuOpen && <div className="tool-menu chat-action-menu"><button type="button" onClick={togglePinned}><span>⭐</span>{pinnedIds.includes(active.id) ? 'Unpin Chat' : 'Pin Chat'}</button><button type="button" onClick={toggleMuted}><span>🔕</span>{mutedIds.includes(active.id) ? 'Unmute Chat' : 'Mute Chat'}</button><button type="button" onClick={() => archiveIds([active.id])}><span>📁</span>Archive Chat</button><button className="danger-menu" type="button" onClick={() => deleteIds([active.id])}><span>🗑</span>Delete Chat</button></div>}</div>}</header><div className="message-stream">{messages.length === 0 && <div className="message-empty">Start your conversation with {displayName(target)}.</div>}{messages.map(m => <div key={m.id} className={`bubble-wrap ${m.sender_id === me.id ? 'mine' : ''}`}><div className="message-bubble">{m.content}</div><time>{formatTime(m.created_at)}{m.sender_id === me.id && m.read ? ' - Read' : ''}</time></div>)}<div ref={bottom} /></div><form className="composer" onSubmit={send}><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Write a message..." maxLength={5000} /><button className="btn btn-primary" disabled={sending || !draft.trim()}>{sending ? 'Sending...' : 'Send'}</button></form></> : <div className="chat-welcome"><div className="welcome-art" aria-hidden="true"><div className="bubble big"><i></i><i></i><i></i></div><div className="bubble small"><i></i><i></i><i></i></div></div><span className="welcome-kicker">WELCOME TO YOUR MESSAGES</span><h2>Your conversations will appear here</h2><p>Select a conversation from the list to start chatting<br />or start a new conversation without leaving Messages.</p><button className="btn btn-primary welcome-cta" type="button" onClick={startNewConversation}>Start a New Conversation</button></div>}
            {error && <div className="messages-error">{String(error)}<button onClick={() => setError('')}>x</button></div>}
          </section>
        </div>
      </main>
    </>
  );
}