import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import { SkeletonTable } from '../../components/shared/Skeleton';
import api from '../../services/api';
import { uploadFile } from '../../services/ipfs';
import config from '../../config';
import '../../css/freelancer/dashboard.css';
import '../../css/freelancer/my-contracts.css';

function statusGroup(status) {
  const s = (status || '').toLowerCase();
  if (['completed', 'delivered', 'cancelled', 'disputed'].includes(s)) return 'archived';
  if (s === 'active') return 'active';
  return 'pending';
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);

  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState('all');
  const [detailId, setDetailId] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [submitFile, setSubmitFile] = useState(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [disputeModal, setDisputeModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalDisputeId, setModalDisputeId] = useState(null);
  const [contractHistory, setContractHistory] = useState([]);
  const [showDisputeChat, setShowDisputeChat] = useState(false);
  const [disputeChatMessages, setDisputeChatMessages] = useState([]);
  const [disputeChatInitiated, setDisputeChatInitiated] = useState(false);
  const [disputeChatInput, setDisputeChatInput] = useState('');
  const [disputeChatSending, setDisputeChatSending] = useState(false);
  const [disputeChatConnected, setDisputeChatConnected] = useState(false);
  const disputeWsRef = useRef(null);
  const disputeMessagesEndRef = useRef(null);
  const disputeInputRef = useRef(null);

  const loadContracts = useCallback(async () => {
    try {
      const res = await api.get('/contracts');
      const list = (res.data && res.data.contracts) || [];
      setContracts(list);
      setError(null);
      const ids = [...new Set(list.flatMap(c => [c.client_id, c.freelancer_id].filter(Boolean)))];
      if (ids.length) {
        try {
          const uRes = await api.get('/users', { params: { ids: ids.join(',') } });
          const map = {};
          (uRes.data || []).forEach(u => { map[u.id] = u; });
          setUsers(map);
        } catch {}
      }
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.message || 'Failed to load contracts');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollId;

    setLoading(true);
    setError(null);
    loadContracts().finally(() => { if (!cancelled) setLoading(false); });
    pollId = setInterval(() => { loadContracts(); }, 10000);
    return () => { cancelled = true; clearInterval(pollId); };
  }, [loadContracts]);

  const tabs = [
    { key: 'all', label: 'All Contracts' },
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'archived', label: 'Archived' },
  ];

  const displayed = useMemo(() => {
    if (currentTab === 'all') return contracts;
    return contracts.filter(c => statusGroup(c.status) === currentTab);
  }, [contracts, currentTab]);

  const stats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'active');
    const archived = contracts.filter(c => ['completed', 'delivered', 'cancelled', 'disputed'].includes((c.status || '').toLowerCase()));
    const earned = archived.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);
    return {
      total: contracts.length,
      active: active.length,
      earned,
      completed: archived.length,
    };
  }, [contracts]);

  const detail = detailId ? contracts.find(c => c.id === detailId) : null;

  useEffect(() => {
    if (!detail) {
      setModalDisputeId(null);
      setShowDisputeChat(false);
      setDisputeChatMessages([]);
      setDisputeChatInitiated(false);
      setContractHistory([]);
    } else {
      if (detail.status === 'disputed') {
        api.get('/disputes', { params: { page: 1, limit: 50 } }).then(res => {
          const dispute = (res.data?.disputes || []).find(d => d.contract_id === detail.id);
          setModalDisputeId(dispute ? dispute.id : null);
        }).catch(() => setModalDisputeId(null));
      } else {
        setModalDisputeId(null);
      }
      api.get(`/contracts/${detail.id}/history`).then(res => {
        setContractHistory(res.data?.history || []);
      }).catch(() => setContractHistory([]));
    }
  }, [detail]);

  useEffect(() => {
    if (detail || disputeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [detail, disputeModal]);

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 2500);
  }

  function toggleExpand(idx) {
    setExpandedIdx(prev => (prev === idx ? null : idx));
    setSubmitFile(null);
    setSubmitNotes('');
  }

  async function submitMilestone(contractId, index) {
    if (!submitFile) {
      showToast('Please upload a deliverable file before submitting.', '⚠️');
      return;
    }
    setSubmitting(true);
    let cid = null;
    try {
      const result = await uploadFile(submitFile);
      cid = result.cid;
    } catch (uploadErr) {
      showToast(uploadErr.response?.data?.detail?.message || uploadErr.message || 'Failed to upload to IPFS', '⚠️');
      setSubmitting(false);
      return;
    }
    try {
      const res = await api.post(`/contracts/${contractId}/milestones/${index}/submit`, {
        deliverable_cid: cid,
        submission_notes: submitNotes || null,
      });
      setContracts(prev => prev.map(c => {
        if (c.id !== contractId) return c;
        const ms = c.milestones.map(m => (m.index === index ? { ...m, ...res.data } : m));
        return { ...c, milestones: ms };
      }));
      setSubmitFile(null);
      setSubmitNotes('');
      showToast('Deliverable submitted!', '📦');
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.message || 'Failed to submit', '⚠️');
      await loadContracts();
    } finally {
      setSubmitting(false);
    }
  }

  async function signContract(contractId) {
    setSubmitting(true);
    try {
      const res = await api.post(`/contracts/${contractId}/sign`);
      const updated = res.data.contract;
      setContracts(prev => prev.map(c =>
        c.id === contractId ? { ...c, ...updated, milestones: res.data.milestones || c.milestones } : c
      ));
      showToast('Contract signed ✅');
      setDetailId(null);
      setExpandedIdx(null);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.message || 'Failed to sign', '⚠️');
      await loadContracts();
    } finally {
      setSubmitting(false);
    }
  }

  const raiseDispute = async (contractId, reason) => {
    setActionLoading(true);
    setContracts(prev => prev.map(c =>
      c.id === contractId ? { ...c, status: 'disputed' } : c
    ));
    try {
      await api.post(`/contracts/${contractId}/disputes`, { reason });
      showToast('Dispute raised. Admin will review.');
      setDisputeModal(null);
      setDetailId(null);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || 'Failed to raise dispute', '❌');
      await loadContracts();
    } finally {
      setActionLoading(false);
    }
  };

  const loadDisputeMessages = useCallback(async (disputeId) => {
    try {
      const { data } = await api.get(`/dispute-messages/${disputeId}`);
      setDisputeChatMessages(data);
      setDisputeChatInitiated(data.length > 0);
    } catch {
      setDisputeChatInitiated(false);
    }
  }, []);

  const openDisputeChat = async () => {
    if (!modalDisputeId) return;
    setShowDisputeChat(true);
    await loadDisputeMessages(modalDisputeId);
  };

  useEffect(() => {
    if (!showDisputeChat || !modalDisputeId) return;
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const myId = currentUser.id;
    if (!myId) return;
    const apiOrigin = new URL(config.apiUrl).origin;
    const wsProtocol = apiOrigin.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = apiOrigin.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}/api/dispute-messages/ws/${myId}`;
    const ws = new WebSocket(wsUrl);
    disputeWsRef.current = ws;
    ws.onopen = () => setDisputeChatConnected(true);
    ws.onclose = () => { setDisputeChatConnected(false); };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'dispute_message' && data.message?.dispute_id === modalDisputeId) {
          setDisputeChatMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          setDisputeChatInitiated(true);
        }
        if (data.type === 'dispute_chat_deleted' && data.dispute_id === modalDisputeId) {
          setDisputeChatMessages([]);
          setDisputeChatInitiated(false);
          setShowDisputeChat(false);
          setModalDisputeId(null);
        }
      } catch {}
    };
    return () => { ws.close(); disputeWsRef.current = null; };
  }, [showDisputeChat, modalDisputeId]);

  useEffect(() => { disputeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [disputeChatMessages]);

  const sendDisputeMessage = async () => {
    if (!disputeChatInput.trim() || !modalDisputeId) return;
    setDisputeChatSending(true);
    try {
      await api.post('/dispute-messages/send', {
        dispute_id: modalDisputeId,
        content: disputeChatInput.trim(),
      });
      setDisputeChatInput('');
    } catch (err) {
      showToast(err.response?.data?.detail?.message || 'Failed to send', '❌');
    }
    setDisputeChatSending(false);
  };

  const handleDisputeChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendDisputeMessage();
    }
  };

  return (
    <div style={{ background: 'var(--landing-mist)', minHeight: '100vh' }}>
      <Navbar activePage="my-contracts" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Contracts</h1>
            <p className="page-sub">Track your active work and submit deliverables</p>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 32 }}>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Contracts</span>
              <div className="s-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
            </div>
            <div className="s-val">{stats.total}</div>
            <div className="s-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Active</span>
              <div className="s-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div>
            </div>
            <div className="s-val">{stats.active}</div>
            <div className="s-badge" style={{display: 'inline-block', marginTop: 8}}>In progress</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Earned</span>
              <div className="s-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></div>
            </div>
            <div className="s-val">{stats.earned > 0 ? stats.earned.toLocaleString() + ' ETH' : '0 ETH'}</div>
            <div className="s-sub" style={{color: 'var(--landing-blue)'}}>Via Escrow</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Completed</span>
              <div className="s-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg></div>
            </div>
            <div className="s-val">{stats.completed}</div>
            <div className="s-sub">{stats.completed > 0 ? 'Successfully finished' : '–'}</div>
          </div>
        </div>

        <div className="fl-tabs">
          {tabs.map(tab => (
            <button key={tab.key} className={'fl-tab' + (currentTab === tab.key ? ' active' : '')} onClick={() => setCurrentTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⚠️</div>
            <h3>Failed to load contracts</h3>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
            <h3>{currentTab === 'pending' ? 'No pending items' : 'No contracts here'}</h3>
            <p>Apply to jobs to start getting contracts.</p>
            <button className="btn btn-primary" onClick={() => navigate('/freelancer/jobs')}>Browse Jobs →</button>
          </div>
        ) : (
          <div>
            {displayed.map(c => {
              const user = users[c.client_id];
              const clientName = user?.username || c.client_id?.slice(0, 12) || 'Client';
              const done = c.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length;
              const p = c.milestones.length ? Math.round(done / c.milestones.length * 100) : 0;
              const deliverableCount = c.milestones.filter(m => m.deliverable_cid).length;
              return (
                <div key={c.id} className="contract-card" onClick={() => setDetailId(c.id)}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="contract-title">{c.title}</span>
                      <span className={'badge badge-' + c.status}>{c.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="contract-meta">
                      <div className="contract-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        {clientName}
                      </div>
                      {c.deadline ? (
                        <div className="contract-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          Due {fmtDate(c.deadline)}
                        </div>
                      ) : null}
                      <div className="contract-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        {done}/{c.milestones.length} milestones
                      </div>
                      {deliverableCount > 0 ? (
                        <div className="contract-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                          {deliverableCount} deliverable{deliverableCount > 1 ? 's' : ''}
                        </div>
                      ) : null}
                    </div>
                    {c.status === 'active' ? (
                      <div style={{ maxWidth: 300 }}>
                        <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 700, marginBottom: 4 }}>Progress: {p}%</div>
                        <div className="prog-bar"><div className="prog-fill" style={{ width: p + '%' }}></div></div>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--landing-blue)', fontFamily: 'var(--landing-display)' }}>{Number(c.total_amount || 0).toLocaleString()} ETH</div>
                    <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 600, marginTop: 4 }}>Contract value</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                      {c.status === 'active' ? (
                        <button className="btn btn-primary" style={{padding: '8px 16px'}} onClick={e => { e.stopPropagation(); const firstPending = c.milestones.findIndex(m => (m.status || '').toLowerCase() === 'pending'); setDetailId(c.id); setExpandedIdx(firstPending >= 0 ? firstPending : 0); }}>Submit Work</button>
                      ) : null}
                      {c.status === 'pending_signatures' && !c.freelancer_signed ? (
                        <button className="btn btn-primary" style={{padding: '8px 16px'}} onClick={e => { e.stopPropagation(); signContract(c.id); }}>Sign Contract</button>
                      ) : null}
                      {c.status === 'pending_signatures' && c.freelancer_signed ? (
                        <span className="btn btn-outline" style={{ opacity: 0.7, cursor: 'default', padding: '8px 16px' }}>Signed</span>
                      ) : null}
                      <button className="btn btn-outline" style={{padding: '8px 16px'}} onClick={e => { e.stopPropagation(); setDetailId(c.id); }}>Details</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detail && createPortal(
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) { setDetailId(null); setExpandedIdx(null); } }}>
          <div className="modal-box" style={{ maxWidth: 720 }}>
            <button className="modal-close" onClick={() => { setDetailId(null); setExpandedIdx(null); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className={'badge badge-' + detail.status}>{detail.status.replace(/_/g, ' ')}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: 'var(--landing-navy)', fontFamily: 'var(--landing-display)' }}>{detail.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--landing-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                {(users[detail.client_id]?.username || 'C').split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--landing-navy)' }}>{users[detail.client_id]?.username || detail.client_id?.slice(0, 12)}</div>
                <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 600 }}>Client</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2457e6, #173aa6)', borderRadius: 20, padding: 24, color: '#fff', marginBottom: 24, boxShadow: '0 12px 24px rgba(36, 87, 230, 0.2)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escrow Amount</div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--landing-display)' }}>{Number(detail.total_amount || 0).toLocaleString()} ETH</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, fontWeight: 500 }}>Safely held in smart contract</div>
            </div>
            {detail.status === 'active' ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--landing-navy)', fontWeight: 800, marginBottom: 8 }}><span>Overall Progress</span><span>{detail.milestones.length ? Math.round(detail.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length / detail.milestones.length * 100) : 0}%</span></div>
                <div className="prog-bar" style={{height: 10}}><div className="prog-fill" style={{ width: detail.milestones.length ? Math.round(detail.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length / detail.milestones.length * 100) : 0 + '%' }}></div></div>
              </div>
            ) : null}
            <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--landing-navy)', marginBottom: 16 }}>Milestones</h4>
            {detail.milestones.map((m, i) => {
              const isOpen = expandedIdx === i;
              const canSubmit = detail.status === 'active' && ['pending', 'in_progress'].includes((m.status || '').toLowerCase());
              const isPaid = (m.status || '').toLowerCase() === 'approved' || (m.status || '').toLowerCase() === 'paid';
              const isRejected = m.rejection_reason && ['pending', 'in_progress'].includes((m.status || '').toLowerCase());
              return (
                <div key={i} className={`milestone-item ${isRejected ? 'rejected' : ''}`}>
                  <div className="milestone-header" onClick={() => toggleExpand(i)}>
                    <div className={`milestone-icon ${isPaid ? 'paid' : isRejected ? 'rejected' : m.status === 'submitted' ? 'submitted' : ''}`}>
                      {isPaid ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : isRejected ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> : m.status === 'submitted' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> : (i+1)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--landing-navy)' }}>{m.description}</div>
                      <div style={{ fontSize: 13, color: 'var(--landing-muted)', fontWeight: 500, marginTop: 2 }}>
                        {m.status === 'submitted' ? 'Awaiting client review' : m.status === 'approved' || m.status === 'paid' ? 'Completed & paid' : isRejected ? 'Rejected — resubmit below' : m.status === 'in_progress' ? 'In progress' : 'Pending'}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--landing-blue)' }}>{Number(m.amount || 0).toLocaleString()} ETH</div>
                    <button className="btn btn-outline" onClick={e => { e.stopPropagation(); toggleExpand(i); }} style={{ padding: '6px 12px', minHeight: 'auto', fontSize: 12 }}>
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--landing-line)', background: 'var(--landing-white)' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--landing-navy)', marginBottom: 12 }}>Deliverables</div>
                      {m.rejection_reason && (
                        <div style={{ background: '#fef3f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#b42318', marginBottom: 4 }}>⚠ Rejected by client</div>
                          <div style={{ fontSize: 13, color: '#b42318', fontWeight: 500 }}>{m.rejection_reason}</div>
                        </div>
                      )}
                      {m.deliverable_cid || m.submission_notes || m.submitted_at ? (
                        <div style={{ marginBottom: 16, background: 'var(--landing-mist)', padding: 16, borderRadius: 12, border: '1px solid var(--landing-line)' }}>
                          {m.deliverable_cid ? <div style={{ fontSize: 13, marginBottom: 8, fontFamily: "'DM Mono', monospace", color: 'var(--landing-navy)', wordBreak: 'break-all' }}><strong>CID:</strong> {m.deliverable_cid}</div> : null}
                          {m.submission_notes ? <div style={{ fontSize: 14, marginBottom: 8, color: 'var(--landing-text)' }}>{m.submission_notes}</div> : null}
                          <div style={{display: 'flex', gap: 16, marginTop: 12}}>
                            {m.submitted_at ? <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 600 }}>Submitted: {fmtDate(m.submitted_at)}</div> : null}
                            {m.approved_at ? <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 600 }}>Approved: {fmtDate(m.approved_at)}</div> : null}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--landing-muted)', fontWeight: 500, marginBottom: isOpen && canSubmit ? 16 : 0 }}>No deliverables submitted yet.</div>
                      )}
                      {canSubmit && (
                        <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); submitMilestone(detail.id, m.index); }}>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--landing-navy)', marginBottom: 12 }}>Submit Deliverable</div>
                          <div className="upload-box" onClick={() => document.getElementById(`file-${detail.id}-${m.index}`).click()}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--landing-blue)', marginBottom: 4 }}>Click to upload file</div>
                            <div style={{ fontSize: 13, color: 'var(--landing-muted)', fontWeight: 500 }}>Any file type — stored safely on IPFS</div>
                            <input id={`file-${detail.id}-${m.index}`} type="file" style={{ display: 'none' }} onChange={e => setSubmitFile(e.target.files[0] || null)} />
                          </div>
                          {submitFile ? (
                            <div style={{ fontSize: 13, color: 'var(--landing-blue)', fontWeight: 700, marginBottom: 12, background: 'rgba(36, 87, 230, 0.05)', padding: '8px 12px', borderRadius: 8 }}>Selected: {submitFile.name} ({(submitFile.size / 1024).toFixed(1)} KB)</div>
                          ) : null}
                          <textarea className="form-input" rows="3" placeholder="Describe what you've delivered..." style={{ resize: 'vertical', marginBottom: 16 }} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)}></textarea>
                          <button className="btn btn-primary" type="submit" disabled={submitting || !submitFile} style={{width: '100%', height: 48, fontSize: 15}}>
                            {submitting ? 'Submitting...' : submitFile ? 'Submit Deliverable' : 'Upload a file first'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {contractHistory.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--landing-navy)', marginBottom: 16 }}>Activity Timeline</h4>
                <div style={{ borderLeft: '2px solid var(--landing-line)', marginLeft: 8, paddingLeft: 20 }}>
                  {contractHistory.slice(-10).reverse().map((entry) => {
                    const date = entry.created_at ? new Date(entry.created_at) : null;
                    const timeStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const label = entry.entity_type === 'milestone'
                      ? `Milestone ${entry.action}`
                      : entry.action.charAt(0).toUpperCase() + entry.action.slice(1);
                    return (
                      <div key={entry.id} style={{ marginBottom: 16, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -27, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--landing-blue)', border: '2px solid var(--landing-white)' }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--landing-navy)' }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 500, marginTop: 2 }}>
                          {entry.from_status && entry.to_status ? `${entry.from_status} → ${entry.to_status}` : ''}
                          {entry.details ? ` — ${entry.details}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--landing-muted)', marginTop: 2 }}>{timeStr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {showDisputeChat && modalDisputeId && (
              <div style={{
                marginTop: 20, borderRadius: 16, border: '1px solid var(--landing-line)',
                overflow: 'hidden', background: 'var(--landing-white)',
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '1px solid var(--landing-line)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--landing-mist)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--landing-navy)' }}>Chat with Admin</span>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: disputeChatConnected ? '#10b981' : '#ef4444', display: 'inline-block',
                    }} />
                  </div>
                  <button className="btn btn-outline" onClick={() => setShowDisputeChat(false)} style={{ padding: '6px 12px', minHeight: 'auto', fontSize: 12 }}>Close</button>
                </div>
                <div style={{ padding: '16px 20px', minHeight: 120, maxHeight: 350, overflowY: 'auto' }}>
                  {!disputeChatInitiated ? (
                    <p style={{ fontSize: 14, color: 'var(--landing-muted)', textAlign: 'center', padding: '24px 0', fontWeight: 500 }}>
                      Waiting for admin to initiate a chat...
                    </p>
                  ) : (
                    <>
                      {disputeChatMessages.map(msg => {
                        const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                          <div key={msg.id} style={{
                            display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
                            marginBottom: 12,
                          }}>
                            <div style={{
                              maxWidth: '80%', padding: '12px 16px', borderRadius: 16,
                              background: isMe ? 'var(--landing-blue)' : 'var(--landing-mist)',
                              color: isMe ? '#fff' : 'var(--landing-navy)',
                              fontSize: 14, lineHeight: 1.5,
                              borderBottomRightRadius: isMe ? 4 : 16,
                              borderBottomLeftRadius: isMe ? 16 : 4
                            }}>
                              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4, fontWeight: 700 }}>
                                {isMe ? 'You' : detail?.client_id === msg.sender_id ? 'Client' : 'Admin'} &middot; {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={disputeMessagesEndRef} />
                    </>
                  )}
                </div>
                {disputeChatInitiated && (
                  <div style={{
                    padding: '16px 20px', borderTop: '1px solid var(--landing-line)',
                    display: 'flex', gap: 12, background: 'var(--landing-mist)'
                  }}>
                    <input
                      ref={disputeInputRef}
                      className="form-input"
                      placeholder="Type a message..."
                      value={disputeChatInput}
                      onChange={e => setDisputeChatInput(e.target.value)}
                      onKeyDown={handleDisputeChatKeyDown}
                      style={{ flex: 1, fontSize: 14, background: 'var(--landing-white)' }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={sendDisputeMessage}
                      disabled={disputeChatSending || !disputeChatInput.trim()}
                      style={{padding: '0 24px'}}
                    >
                      {disputeChatSending ? '...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 24, borderTop: '1px solid var(--landing-line)', marginTop: 24 }}>
              {(detail.status === 'active' || detail.status === 'pending_signatures' || detail.status === 'pending_funding' || detail.status === 'disputed') && (
                <button className="btn btn-outline" style={{ flex: 1, borderColor: '#fecaca', color: '#dc2626' }}
                        onClick={() => setDisputeModal(detail.id)}
                        disabled={actionLoading}>
                  ⚠ Raise Dispute
                </button>
              )}
              {modalDisputeId && (
                <button className="btn btn-primary" style={{ flex: 1, background: '#8b5cf6', borderColor: '#8b5cf6' }}
                        onClick={openDisputeChat}>
                  💬 Chat with Admin
                </button>
              )}
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setDetailId(null); setExpandedIdx(null); setShowDisputeChat(false); setModalDisputeId(null); }}>Close</button>
              {detail.status === 'pending_signatures' && !detail.freelancer_signed ? (
                <button className="btn btn-primary" disabled={submitting} onClick={() => signContract(detail.id)}>Sign Contract</button>
              ) : null}
            </div>
          </div>
        </div>
      , document.body)}

      {disputeModal && createPortal(
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setDisputeModal(null); }}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setDisputeModal(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h3 style={{ marginBottom: 12, fontSize: 24, fontWeight: 800, color: 'var(--landing-navy)', fontFamily: 'var(--landing-display)' }}>Raise a Dispute</h3>
            <p style={{ fontSize: 14, color: 'var(--landing-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              This will flag the contract for admin review and pause all milestone activity.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const reason = e.target.reason.value;
              if (!reason.trim()) return;
              await raiseDispute(disputeModal, reason);
            }}>
              <textarea name="reason" className="form-input" style={{ width: '100%', minHeight: 120, marginBottom: 16 }}
                        placeholder="Describe the issue in detail..." required />
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444', height: 48 }}
                        disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : 'Submit Dispute'}
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1, height: 48 }} onClick={() => setDisputeModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {toast && (
        <div className="toast show" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#101828', color: '#fff', padding: '12px 24px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 12px 32px rgba(16,24,40,0.2)',
          fontFamily: "var(--landing-body)", fontSize: 14, fontWeight: 700, zIndex: 9999
        }}>
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
