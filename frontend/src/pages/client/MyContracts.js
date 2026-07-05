import { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '../../components/client/Navbar';
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
  pending: 'pending', submitted: 'submitted', approved: 'done', rejected: 'pending', paid: 'done',
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


function ActionButtons({ contract, onSelect, onSign, onFund }) {
  if (contract.status === 'active') {
    return (
      <>
        <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(contract.id); }}>View Details</button>
      </>
    );
  }
  if (contract.status === 'pending_funding') {
    return (
      <button className="btn btn-primary btn-sm" title="Requires MetaMask" onClick={(e) => { e.stopPropagation(); onFund(contract.id); }}>⚡ Fund Contract</button>
    );
  }
  if (contract.status === 'pending_signatures') {
    if (contract.client_signed) {
      return <span className="btn btn-outline btn-sm" style={{ opacity: 0.7, cursor: 'default' }}>Signed</span>;
    }
    if (contract.freelancer_id) {
      return <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onSign(contract.id); }}>Sign Contract</button>;
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
      await fetchContracts();
      setModalContract(null);
    } catch (err) {
      const m = err.response?.data?.detail?.message || err.message || 'Action failed';
      showToast(m, '❌');
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
    await doAction(
      () => api.post(`/contracts/${contractId}/milestones/${index}/approve`),
      'Milestone approved ✅',
    );
  };

  const rejectMilestone = async (contractId, index, reason) => {
    await doAction(
      () => api.post(`/contracts/${contractId}/milestones/${index}/reject`, { reason }),
      'Milestone rejected. Freelancer notified.',
    );
  };

  const signContract = async (contractId) => {
    await doAction(
      () => api.post(`/contracts/${contractId}/sign`),
      'Contract signature recorded ✅',
    );
  };

  const fundContract = async (contractId) => {
    const c = allContracts.find(x => x.id === contractId);
    if (!c) return;

    try {
      if (c.on_chain_id) {
        setActionLoading(true);
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
      await doAction(
        () => api.post(`/contracts/${contractId}/fund`),
        'Contract funded ✅',
      );
    } catch (chainErr) {
      showToast('Funding failed: ' + (chainErr.message || chainErr), '❌');
      setActionLoading(false);
    }
  };

  const hireProposal = async (proposalId) => {
    await doAction(
      () => api.post(`/proposals/${proposalId}/accept`),
      'Freelancer hired ✅',
    );
  };

  const raiseDispute = async (contractId, reason) => {
    await doAction(
      () => api.post(`/contracts/${contractId}/disputes`, { reason }),
      'Dispute raised. Admin will review.',
    );
  };

  const openContractModal = async (id) => {
    const c = allContracts.find(x => x.id === id);
    if (!c) return;
    setSelectedProposal(null);
    setModalContract(c);
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
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⏳</div>
            <h3>Loading contracts…</h3>
          </div>
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
                  <ActionButtons contract={c} onSelect={openContractModal} onSign={signContract} onFund={fundContract} />
                </div>
              </div>
            </div>
          )))
        }
      </div>

      {modalContract && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) { setModalContract(null); setSelectedProposal(null); } }}>
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
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              {(modalContract.status === 'active' || modalContract.status === 'pending_signatures' || modalContract.status === 'pending_funding') && (
                <button className="btn btn-outline" style={{ flex: 1 }}
                        onClick={() => setDisputeModal(modalContract.id)}
                        disabled={actionLoading}>
                  ⚠ Raise Dispute
                </button>
              )}
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setModalContract(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
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
      )}

      {disputeModal && (
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
      )}

      {toast && (
        <div className={`toast${toast ? ' show' : ''}`}>
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
