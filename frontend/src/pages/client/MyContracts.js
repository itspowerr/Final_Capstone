import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../../components/client/Navbar';
import { SkeletonTable } from '../../components/shared/Skeleton';
import api from '../../services/api.js';
import { getContract, getSigner, ensureCorrectNetwork } from '../../services/web3.js';
import { GIG_ESCROW_ABI } from '../../services/contractAbi.js';
import config from '../../config';
import '../../css/client/my-contracts.css';

const STATUS_LABELS = {
  draft: 'Draft', pending_review: 'Pending Review', pending_signatures: 'Pending Signature',
  pending_funding: 'Pending Funding', active: 'Active', revision_requested: 'Revision Requested',
  delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed',
};

const STATUS_CLASS = {
  draft: 'draft', pending_review: 'draft', pending_signatures: 'pending', pending_funding: 'pending',
  active: 'active', revision_requested: 'active', delivered: 'completed', completed: 'completed',
  cancelled: 'completed', disputed: 'disputed',
};

const FILTER_STATUSES = {
  all: null,
  active: ['active', 'revision_requested'],
  pending: ['pending_signatures', 'pending_funding'],
  disputed: ['disputed'],
  completed: ['completed', 'delivered', 'cancelled'],
};

const MILESTONE_STATUS_MAP = {
  pending: 'pending', in_progress: 'active', submitted: 'submitted', approved: 'done', rejected: 'pending', paid: 'done',
};

function formatContract(raw) {
  const ms = (raw.milestones || []).map(m => ({
    label: m.description,
    amount: m.amount,
    status: MILESTONE_STATUS_MAP[m.status] || 'pending',
    index: m.index,
    id: m.id,
    backend_status: m.status,
    deliverable_cid: m.deliverable_cid,
    submission_notes: m.submission_notes,
    submitted_at: m.submitted_at,
    approved_at: m.approved_at,
  }));
  const doneMs = ms.filter(m => m.status === 'done').length;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    freelancer: raw.freelancer_id,
    freelancer_id: raw.freelancer_id,
    value: raw.total_amount,
    status: raw.status,
    createdAt: raw.created_at,
    deadline: raw.deadline,
    milestones: ms,
    progress: ms.length ? Math.round((doneMs / ms.length) * 100) : 0,
    doneMs,
    totalMs: ms.length,
    client_signed: raw.client_signed,
    freelancer_signed: raw.freelancer_signed,
    on_chain_id: raw.on_chain_id,
    contract_address: raw.contract_address,
    editable: false,
  };
}


function ActionButtons({ contract, onSelect, onSign, onFund, loading }) {
  if (contract.status === 'active') {
    return (
      <>
        <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(contract.id); }}>View Details</button>
      </>
    );
  }
  if (contract.status === 'pending_funding') {
    return (
      <button className="btn btn-primary btn-sm" title="Requires MetaMask" disabled={loading} onClick={(e) => { e.stopPropagation(); onFund(contract.id); }}>⚡ Fund Contract</button>
    );
  }
  if (contract.status === 'pending_signatures') {
    if (contract.client_signed) {
      return <span className="btn btn-outline btn-sm" style={{ opacity: 0.7, cursor: 'default' }}>Signed</span>;
    }
    if (contract.freelancer_id) {
      return <button className="btn btn-primary btn-sm" disabled={loading} onClick={(e) => { e.stopPropagation(); onSign(contract.id); }}>Sign Contract</button>;
    }
    return <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(contract.id); }}>View Applicants</button>;
  }
  return <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(contract.id); }}>View Details</button>;
}


export default function MyContracts() {
  const [allContracts, setAllContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [modalContract, setModalContract] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [disputeModal, setDisputeModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState({});
  const [modalProposals, setModalProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
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

  const showToast = (msg, icon) => {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get('/contracts');
      const list = (res.data?.contracts || []).map(formatContract);
      setAllContracts(list);
      const ids = [...new Set(list.map(c => c.freelancer_id).filter(Boolean))];
      if (ids.length) {
        api.get('/users', { params: { ids: ids.join(',') } }).then(uRes => {
          const map = {};
          (uRes.data || []).forEach(u => { map[u.id] = u; });
          setUsers(map);
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.message || 'Failed to load contracts';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  useEffect(() => {
    const pollId = setInterval(() => { fetchContracts(); }, 10000);
    return () => clearInterval(pollId);
  }, [fetchContracts]);

  const filtered = useMemo(() => {
    const statuses = FILTER_STATUSES[currentFilter];
    return statuses
      ? allContracts.filter(c => statuses.includes(c.status))
      : allContracts;
  }, [allContracts, currentFilter]);

  const stats = useMemo(() => {
    const active = allContracts.filter(c => c.status === 'active');
    const completed = allContracts.filter(c => c.status === 'completed');
    const locked = active.reduce((s, c) => s + c.value, 0);
    return {
      total: allContracts.length,
      active: active.length,
      locked,
      completedCount: completed.length,
      completedValue: completed.reduce((s, c) => s + c.value, 0),
    };
  }, [allContracts]);

  const doAction = async (action, msg) => {
    setActionLoading(true);
    try {
      await action();
      showToast(msg);
      setModalContract(null);
    } catch (err) {
      const m = err.response?.data?.detail?.message || err.message || 'Action failed';
      showToast(m, '❌');
      await fetchContracts();
    } finally {
      setActionLoading(false);
    }
  };

  const approveMilestone = async (contractId, index) => {
    const c = allContracts.find(x => x.id === contractId);
    if (c && c.on_chain_id) {
      try {
        await ensureCorrectNetwork();
        const signer = await getSigner();
        const contract = await getContract(config.contractAddress, GIG_ESCROW_ABI);
        const tx = await contract.approveMilestone(c.on_chain_id, index);
        await tx.wait();
      } catch (chainErr) {
        showToast('Blockchain approval failed: ' + (chainErr.message || chainErr), '❌');
        return;
      }
    }
    setAllContracts(prev => prev.map(c => {
      if (c.id !== contractId) return c;
      const ms = c.milestones.map(m => m.index === index ? { ...m, backend_status: 'approved', status: 'done' } : m);
      const doneMs = ms.filter(m => m.status === 'done').length;
      return { ...c, milestones: ms, doneMs, progress: ms.length ? Math.round((doneMs / ms.length) * 100) : 0 };
    }));
    await doAction(
      () => api.post(`/contracts/${contractId}/milestones/${index}/approve`),
      'Milestone approved ✅',
    );
  };

  const rejectMilestone = async (contractId, index, reason) => {
    setAllContracts(prev => prev.map(c => {
      if (c.id !== contractId) return c;
      const ms = c.milestones.map(m => m.index === index ? { ...m, backend_status: 'rejected', status: 'pending' } : m);
      return { ...c, milestones: ms };
    }));
    await doAction(
      () => api.post(`/contracts/${contractId}/milestones/${index}/reject`, { reason }),
      'Milestone rejected. Freelancer notified.',
    );
  };

  const signContract = async (contractId) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/contracts/${contractId}/sign`);
      setAllContracts(prev => prev.map(c =>
        c.id === contractId ? formatContract(res.data.contract) : c
      ));
      showToast('Contract signature recorded ✅');
    } catch (err) {
      const m = err.response?.data?.detail?.message || err.message || 'Failed to sign';
      showToast(m, '❌');
      await fetchContracts();
    } finally {
      setActionLoading(false);
    }
  };

  const fundContract = async (contractId) => {
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;

    setActionLoading(true);
    try {
      if (c.on_chain_id) {
        await ensureCorrectNetwork();
        const signer = await getSigner();
        const contract = await getContract(config.contractAddress, GIG_ESCROW_ABI);
        const { ethers } = await import('ethers');
        const tx = await contract.fundContract(c.on_chain_id, {
          value: ethers.parseEther(String(c.value)),
        });
        showToast('Waiting for confirmation…', '⏳');
        await tx.wait();
      }
      const res = await api.post(`/contracts/${contractId}/fund`);
      setAllContracts(prev => prev.map(c2 =>
        c2.id === contractId ? formatContract(res.data.contract) : c2
      ));
      showToast('Contract funded ✅');
    } catch (chainErr) {
      showToast('Funding failed: ' + (chainErr.message || chainErr), '❌');
      await fetchContracts();
    } finally {
      setActionLoading(false);
    }
  };

  const hireProposal = async (proposalId) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/proposals/${proposalId}/accept`);
      setAllContracts(prev => prev.map(c =>
        c.id === res.data.contract_id ? { ...c, freelancer_id: res.data.freelancer_id } : c
      ));
      setModalContract(null);
      showToast('Freelancer hired ✅');
    } catch (err) {
      const m = err.response?.data?.detail?.message || err.message || 'Failed to hire';
      showToast(m, '❌');
      await fetchContracts();
    } finally {
      setActionLoading(false);
    }
  };

  const raiseDispute = async (contractId, reason) => {
    setAllContracts(prev => prev.map(c =>
      c.id === contractId ? { ...c, status: 'disputed' } : c
    ));
    await doAction(
      () => api.post(`/contracts/${contractId}/disputes`, { reason }),
      'Dispute raised. Admin will review.',
    );
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

  const openContractModal = async (id) => {
    const c = allContracts.find(x => x.id === id);
    if (!c) return;
    setSelectedProposal(null);
    setModalContract(c);
    setShowDisputeChat(false);
    setDisputeChatMessages([]);
    setDisputeChatInitiated(false);
    if (!c.freelancer_id) {
      try {
        const res = await api.get(`/contracts/${id}`);
        setModalProposals((res.data?.proposals || []));
      } catch (e) {
        setModalProposals([]);
      }
    } else {
      setModalProposals([]);
    }
    if (c.status === 'disputed') {
      try {
        const res = await api.get('/disputes', { params: { page: 1, limit: 50 } });
        const dispute = (res.data?.disputes || []).find(d => d.contract_id === id);
        setModalDisputeId(dispute ? dispute.id : null);
      } catch { setModalDisputeId(null); }
    } else {
      setModalDisputeId(null);
    }
    api.get(`/contracts/${id}/history`).then(res => {
      setContractHistory(res.data?.history || []);
    }).catch(() => setContractHistory([]));
  };
  const statusLabel = (s) => STATUS_LABELS[s] || s;
  const statusClass = (s) => STATUS_CLASS[s] || 'draft';

  return (
    <>
      <Navbar activePage="my-contracts" />
      <div className="dash-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Contracts</h1>
            <p className="page-sub">Track all your active, pending, and completed agreements</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline btn-sm" onClick={() => fetchContracts()}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Contracts</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
            </div>
            <div className="s-val">{stats.total}</div>
            <div className="s-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Active</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            </div>
            <div className="s-val">{stats.active}</div>
            <div className="s-badge">{stats.active > 0 ? 'In progress' : 'None active'}</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Value Locked</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
            </div>
            <div className="s-val">{stats.locked.toLocaleString()} ETH</div>
            <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4, fontWeight: 600 }}>Escrow Active</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Completed</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></div>
            </div>
            <div className="s-val">{stats.completedCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{stats.completedCount > 0 ? stats.completedValue.toLocaleString() + ' ETH paid out' : '—'}</div>
          </div>
        </div>

        <div className="contract-tabs">
          {['all', 'active', 'pending', 'disputed', 'completed'].map(s => (
            <button key={s} className={`ctab${currentFilter === s ? ' active' : ''}`} onClick={() => setCurrentFilter(s)}>
              {s === 'all' ? 'All' : s === 'pending' ? 'Pending Signature' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : fetchError ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⚠️</div>
            <h3>Failed to load contracts</h3>
            <p>{fetchError}</p>
            <button className="btn btn-outline btn-sm" onClick={fetchContracts}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No contracts here yet</h3>
            <p>Create a new project to get started.</p>
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="contract-card" onClick={() => openContractModal(c.id)}>
              <div className="contract-main">
                <div className="contract-header">
                  <span className="contract-title">{c.title}</span>
                  <span className={`status-badge status-${statusClass(c.status)}`}>{statusLabel(c.status)}</span>
                </div>
                <div className="contract-meta">
                  <span className="contract-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
                    {users[c.freelancer_id]?.username || c.freelancer_id ? (users[c.freelancer_id]?.username || c.freelancer_id?.slice(0, 12)) + (users[c.freelancer_id] ? '' : '...') : c.status === 'pending_signatures' || c.status === 'pending_funding' ? 'Pending applicants' : 'Unassigned'}
                  </span>
                  {c.deadline ? <span className="contract-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Due {new Date(c.deadline).toLocaleDateString()}
                  </span> : null}
                  <span className="contract-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    {c.doneMs}/{c.totalMs} milestones
                  </span>
                </div>
                <div className="milestones">
                  {c.milestones.slice(0, 3).map((m, i) => (
                    <div key={i} className="milestone-row">
                      <div className={`ms-dot ms-${m.status}`}></div>
                      <span className="ms-label">{m.label}</span>
                      <span className="ms-amount">{m.amount.toLocaleString()} ETH</span>
                    </div>
                  ))}
                  {c.milestones.length > 3 ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 18 }}>+{c.milestones.length - 3} more</div> : null}
                </div>
                {c.status === 'active' ? (
                  <div className="contract-progress">
                    <div className="cp-label"><span>Overall Progress</span><span>{c.progress}%</span></div>
                    <div className="cp-bar"><div className="cp-fill" style={{ width: c.progress + '%' }}></div></div>
                  </div>
                ) : null}
              </div>
              <div className="contract-right">
                <div className="contract-value">{c.value.toLocaleString()} ETH</div>
                <div className="contract-value-sub">Contract value</div>
                <div className="contract-actions">
                  <ActionButtons contract={c} onSelect={openContractModal} onSign={signContract} onFund={fundContract} loading={actionLoading} />
                </div>
              </div>
            </div>
          )))
        }
      </div>

      {modalContract && createPortal(
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) { setModalContract(null); setSelectedProposal(null); setContractHistory([]); } }}>
          <div className="modal-box modal-box-wide">
            <button className="modal-close" onClick={() => { setModalContract(null); setSelectedProposal(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className={`status-badge status-${statusClass(modalContract.status)}`}>{statusLabel(modalContract.status)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>ID: {modalContract.id}</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 8 }}>{modalContract.title}</h2>
            {modalContract.description && (
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{modalContract.description}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div className="cf-avatar" style={{ background: modalContract.freelancer_id ? '#6366f1' : '#94a3b8' }}>{modalContract.freelancer_id ? (users[modalContract.freelancer_id]?.username || 'F').charAt(0).toUpperCase() : '?'}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{users[modalContract.freelancer_id]?.username || modalContract.freelancer_id ? 'Freelancer' : 'Freelancer'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{users[modalContract.freelancer_id]?.username || modalContract.freelancer_id || 'Not yet assigned'}</div>
              </div>
            </div>
            {!modalContract.freelancer_id && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 10 }}>Applicants</h4>
                {modalProposals.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No applicants yet.</p>
                ) : selectedProposal ? (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="cf-avatar" style={{ background: '#6366f1' }}>{(users[selectedProposal.freelancer_id]?.username || 'F').charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{users[selectedProposal.freelancer_id]?.username || selectedProposal.freelancer_id?.slice(0, 12) || 'Freelancer'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Bid · {selectedProposal.estimated_days ? selectedProposal.estimated_days + ' days' : 'Duration not specified'}</div>
                        </div>
                      </div>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedProposal(null)}>← Back</button>
                    </div>
                    <div style={{ padding: '14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selectedProposal.cover_letter || 'No cover letter provided.'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)', background: '#fafafa' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{selectedProposal.bid_amount.toLocaleString()} ETH</div>
                      <button className="btn btn-primary btn-sm" onClick={() => hireProposal(selectedProposal.id)} disabled={actionLoading}>
                        {actionLoading ? 'Hiring…' : 'Hire Freelancer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="timeline">
                    {modalProposals.map((p, i) => (
                      <div key={p.id || i} className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => setSelectedProposal(p)}>
                        <div className={`tl-icon tl-active`}>{i + 1}</div>
                        <div className="tl-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div className="tl-title">{users[p.freelancer_id]?.username || p.freelancer_id?.slice(0, 12) || 'Freelancer'}</div>
                              <div className="tl-amount">{p.bid_amount.toLocaleString()} ETH</div>
                              <div className="tl-status">Bid · {p.estimated_days ? p.estimated_days + ' days' : ''}</div>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>View profile →</span>
                          </div>
                          {p.cover_letter && (
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {p.cover_letter}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="escrow-box">
              <h4>Total Escrow Amount</h4>
              <div className="escrow-amount">{modalContract.value.toLocaleString()} ETH</div>
              <div className="escrow-sub">Released per milestone · MetaMask required to fund</div>
            </div>
            {modalContract.status === 'active' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                  <span>Overall Progress</span><span>{modalContract.progress}%</span>
                </div>
                <div className="cp-bar"><div className="cp-fill" style={{ width: modalContract.progress + '%' }}></div></div>
              </div>
            )}
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 12 }}>Milestones</h4>
            <div className="timeline">
              {modalContract.milestones.map((m, i) => (
                <div key={i} className="timeline-item">
                  <div className={`tl-icon tl-${m.status}`}>{m.status === 'done' ? '✓' : m.status === 'active' || m.backend_status === 'submitted' ? '▶' : '○'}</div>
                  <div className="tl-body">
                    <div className="tl-title">{m.label}</div>
                    <div className="tl-amount">{m.amount.toLocaleString()} ETH</div>
                    <div className="tl-status">
                      {m.backend_status === 'approved' ? 'Completed & paid' :
                       m.backend_status === 'submitted' ? 'Submitted for review' :
                       m.backend_status === 'pending' ? 'Pending' : m.backend_status}
                    </div>
                    {m.backend_status === 'submitted' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        {m.deliverable_cid && (
                          <a href={`${config.ipfsGateway}/ipfs/${m.deliverable_cid}`} target="_blank" rel="noopener noreferrer"
                             className="btn btn-outline btn-sm" style={{ fontSize: 11 }}
                             onClick={e => e.stopPropagation()}>
                            View Deliverable
                          </a>
                        )}
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                                onClick={(e) => { e.stopPropagation(); approveMilestone(modalContract.id, m.index); }}
                                disabled={actionLoading}>
                          Approve
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: 11, color: '#ef4444', borderColor: '#ef4444' }}
                                onClick={(e) => { e.stopPropagation(); setRejecting({ contractId: modalContract.id, index: m.index }); }}>
                          Reject
                        </button>
                      </div>
                    )}
                    {m.submission_notes && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        Note: {m.submission_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {contractHistory.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 12 }}>Activity Timeline</h4>
                <div style={{ borderLeft: '2px solid var(--border)', marginLeft: 8, paddingLeft: 20 }}>
                  {contractHistory.slice(-10).reverse().map((entry) => {
                    const date = entry.created_at ? new Date(entry.created_at) : null;
                    const timeStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const label = entry.entity_type === 'milestone'
                      ? `Milestone ${entry.action}`
                      : entry.action.charAt(0).toUpperCase() + entry.action.slice(1);
                    return (
                      <div key={entry.id} style={{ marginBottom: 16, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -27, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)' }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          {entry.from_status && entry.to_status ? `${entry.from_status} → ${entry.to_status}` : ''}
                          {entry.details ? ` — ${entry.details}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{timeStr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showDisputeChat && modalDisputeId && (
              <div style={{
                marginTop: 16, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
                overflow: 'hidden', background: '#fff',
              }}>
                <div style={{
                  padding: '10px 16px', borderBottom: '1px solid var(--border, #e5e7eb)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg-secondary, #f9fafb)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Chat with Admin</span>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: disputeChatConnected ? '#10b981' : '#ef4444', display: 'inline-block',
                    }} />
                  </div>
                  <button className="btn btn-sm" onClick={() => setShowDisputeChat(false)} style={{ fontSize: 12 }}>Close</button>
                </div>
                <div style={{ padding: '12px 16px', minHeight: 80, maxHeight: 300, overflowY: 'auto' }}>
                  {!disputeChatInitiated ? (
                    <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', padding: '16px 0' }}>
                      Waiting for admin to initiate a chat…
                    </p>
                  ) : (
                    <>
                      {disputeChatMessages.map(msg => {
                        const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                          <div key={msg.id} style={{
                            display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
                            marginBottom: 8,
                          }}>
                            <div style={{
                              maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                              background: isMe ? '#2563eb' : '#f3f4f6',
                              color: isMe ? '#fff' : '#111827',
                              fontSize: 13, lineHeight: 1.5,
                            }}>
                              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                                {isMe ? 'You' : modalContract?.freelancer_id === msg.sender_id ? 'Freelancer' : 'Admin'} &middot; {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                    padding: '10px 16px', borderTop: '1px solid var(--border, #e5e7eb)',
                    display: 'flex', gap: 8,
                  }}>
                    <input
                      ref={disputeInputRef}
                      className="form-input"
                      placeholder="Type a message..."
                      value={disputeChatInput}
                      onChange={e => setDisputeChatInput(e.target.value)}
                      onKeyDown={handleDisputeChatKeyDown}
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={sendDisputeMessage}
                      disabled={disputeChatSending || !disputeChatInput.trim()}
                    >
                      {disputeChatSending ? '...' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              {(modalContract.status === 'active' || modalContract.status === 'pending_signatures' || modalContract.status === 'pending_funding' || modalContract.status === 'disputed') && (
                <button className="btn btn-outline" style={{ flex: 1 }}
                        onClick={() => setDisputeModal(modalContract.id)}
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
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setModalContract(null); setShowDisputeChat(false); setModalDisputeId(null); setContractHistory([]); }}>Close</button>
            </div>
          </div>
        </div>
      , document.body)}

      {rejecting && createPortal(
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setRejecting(null); }}>
          <div className="modal-box" style={{ maxWidth: 450 }}>
            <button className="modal-close" onClick={() => setRejecting(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h3 style={{ marginBottom: 12 }}>Reject Milestone</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const reason = e.target.reason.value;
              if (!reason.trim()) return;
              await rejectMilestone(rejecting.contractId, rejecting.index, reason);
              setRejecting(null);
            }}>
              <textarea name="reason" className="search-input" style={{ width: '100%', minHeight: 80, marginBottom: 12 }}
                        placeholder="Explain why this milestone needs changes…" required />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? 'Rejecting…' : 'Reject & Request Changes'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setRejecting(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {disputeModal && createPortal(
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setDisputeModal(null); }}>
          <div className="modal-box" style={{ maxWidth: 450 }}>
            <button className="modal-close" onClick={() => setDisputeModal(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h3 style={{ marginBottom: 12 }}>Raise a Dispute</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
              This will flag the contract for admin review and pause all milestone activity.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const reason = e.target.reason.value;
              if (!reason.trim()) return;
              await raiseDispute(disputeModal, reason);
              setDisputeModal(null);
            }}>
              <textarea name="reason" className="search-input" style={{ width: '100%', minHeight: 100, marginBottom: 12 }}
                        placeholder="Describe the issue in detail…" required />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }}
                        disabled={actionLoading}>
                  {actionLoading ? 'Submitting…' : 'Submit Dispute'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setDisputeModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {toast && (
        <div className={`toast${toast ? ' show' : ''}`}>
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
