import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';

function statusGroup(status) {
  const s = (status || '').toLowerCase();
  if (['completed', 'delivered', 'cancelled', 'disputed'].includes(s)) return 'archived';
  if (s === 'active') return 'active';
  return 'pending';
}

function milestoneLabel(status) {
  const map = {
    pending: 'Pending',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
  };
  return map[status] || status || 'Pending';
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildStubCid(file, notes) {
  const ts = Date.now().toString(36).slice(-6);
  const name = file ? file.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) : '';
  const note = notes ? notes.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) : '';
  const parts = ['Qm', 'local', ts];
  if (name) parts.push(name);
  if (name && note) parts.push('-');
  if (note) parts.push(note);
  parts.push(Date.now().toString(36).slice(-4));
  return parts.join('-');
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get('/contracts')
      .then(res => {
        if (cancelled) return;
        const list = (res.data && res.data.contracts) || [];
        setContracts(list);
        const ids = [...new Set(list.flatMap(c => [c.client_id, c.freelancer_id].filter(Boolean)))];
        if (!ids.length) return;
        return api.get('/users', { params: { ids: ids.join(',') } }).then(uRes => {
          if (cancelled) return;
          const map = {};
          (uRes.data || []).forEach(u => { map[u.id] = u; });
          setUsers(map);
        }).catch(() => {});
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail?.message || err.message || 'Failed to load contracts');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { key: 'all', label: 'All' },
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
    setSubmitting(true);
    const cid = buildStubCid(submitFile, submitNotes);
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
    } finally {
      setSubmitting(false);
    }
  }

  async function signContract(contractId) {
    setSubmitting(true);
    try {
      await api.post(`/contracts/${contractId}/sign`);
      showToast('Contract signed ✅');
      fetchContracts();
      setDetailId(null);
      setExpandedIdx(null);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.message || 'Failed to sign', '⚠️');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Navbar activePage="my-contracts" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Contracts</h1>
            <p className="page-sub">Track your active work and submit deliverables</p>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
            </div>
            <div className="s-val">{stats.total}</div><div className="s-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Active</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div>
            </div>
            <div className="s-val">{stats.active}</div><div className="s-badge">In progress</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Earned</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></div>
            </div>
            <div className="s-val">{stats.earned > 0 ? '$' + stats.earned.toLocaleString() : '$0'}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>Via Escrow</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Completed</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg></div>
            </div>
            <div className="s-val">{stats.completed}</div>
            <div className="s-sub">{stats.completed > 0 ? '$' + stats.earned.toLocaleString() + ' paid' : '–'}</div>
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
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⏳</div>
            <h3>Loading contracts…</h3>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⚠️</div>
            <h3>Failed to load contracts</h3>
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No contracts here</h3>
            <p>Apply to jobs to start getting contracts.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/freelancer/jobs')}>Browse Jobs →</button>
          </div>
        ) : (
          displayed.map(c => {
            const user = users[c.client_id];
            const clientName = user?.username || c.client_id?.slice(0, 12) || 'Client';
            const done = c.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length;
            const p = c.milestones.length ? Math.round(done / c.milestones.length * 100) : 0;
            const deliverableCount = c.milestones.filter(m => m.deliverable_cid).length;
            return (
              <div key={c.id}
                style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 22, boxShadow: 'var(--shadow)', marginBottom: 14, cursor: 'pointer', transition: 'all .2s', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}
                onClick={() => setDetailId(c.id)}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{c.title}</span>
                    <span className={'badge badge-' + c.status}>{c.status}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-3)', marginBottom: 12, flexWrap: 'wrap' }}>
                    <span>👤 {clientName}</span>
                    {c.deadline ? <span>📅 Due {fmtDate(c.deadline)}</span> : null}
                    <span>✓ {done}/{c.milestones.length} milestones</span>
                    {deliverableCount > 0 ? <span>📦 {deliverableCount} deliverable{deliverableCount > 1 ? 's' : ''}</span> : null}
                  </div>
                  {c.status === 'active' ? (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>Progress: {p}%</div>
                      <div className="prog-bar"><div className="prog-fill" style={{ width: p + '%' }}></div></div>
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>${Number(c.total_amount || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Contract value</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {c.status === 'active' ? (
                      <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); const firstPending = c.milestones.findIndex(m => (m.status || '').toLowerCase() === 'pending'); setDetailId(c.id); setExpandedIdx(firstPending >= 0 ? firstPending : 0); }}>Submit Work</button>
                    ) : null}
                    {c.status === 'pending_signatures' ? (
                      <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); signContract(c.id); }}>Sign Contract</button>
                    ) : null}
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setDetailId(c.id); }}>Details</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {detail && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) { setDetailId(null); setExpandedIdx(null); } }}>
          <div className="modal-box" style={{ maxWidth: 720 }}>
            <button className="modal-close" onClick={() => { setDetailId(null); setExpandedIdx(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className={'badge badge-' + detail.status}>{detail.status}</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{detail.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {(users[detail.client_id]?.username || 'C').split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{users[detail.client_id]?.username || detail.client_id?.slice(0, 12)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Client</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,#064e3b,#065f46)', borderRadius: 12, padding: 20, color: '#fff', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Escrow Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#6ee7b7' }}>${Number(detail.total_amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Released per milestone</div>
            </div>
            {detail.status === 'active' ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}><span>Overall Progress</span><span>{detail.milestones.length ? Math.round(detail.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length / detail.milestones.length * 100) : 0}%</span></div>
                <div className="prog-bar"><div className="prog-fill" style={{ width: detail.milestones.length ? Math.round(detail.milestones.filter(m => ['approved', 'paid'].includes((m.status || '').toLowerCase())).length / detail.milestones.length * 100) : 0 + '%' }}></div></div>
              </div>
            ) : null}
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 10 }}>Milestones</h4>
            {detail.milestones.map((m, i) => {
              const isOpen = expandedIdx === i;
              const canSubmit = detail.status === 'active' && (m.status || '').toLowerCase() === 'pending';
              const isPaid = (m.status || '').toLowerCase() === 'approved' || (m.status || '').toLowerCase() === 'paid';
              return (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                  <div onClick={() => toggleExpand(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, cursor: 'pointer' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: isPaid ? '#ecfdf5' : (m.status === 'submitted' ? 'var(--accent-pale)' : 'var(--surface)'), border: '2px solid ' + (isPaid ? 'var(--accent)' : (m.status === 'submitted' ? 'var(--accent)' : 'var(--border)')), color: isPaid ? 'var(--accent)' : (m.status === 'submitted' ? 'var(--accent)' : 'var(--text-3)') }}>
                      {isPaid ? '✓' : (m.status === 'submitted' ? '▶' : '○')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.description}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {m.status === 'submitted' ? 'Awaiting client review' : m.status === 'approved' || m.status === 'paid' ? 'Completed & paid' : m.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>${Number(m.amount || 0).toLocaleString()}</div>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); toggleExpand(i); }} style={{ padding: '4px 10px', minHeight: 'auto' }}>
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 10 }}>Deliverables</div>
                      {m.deliverable_cid || m.submission_notes || m.submitted_at ? (
                        <div style={{ marginBottom: 14 }}>
                          {m.deliverable_cid ? <div style={{ fontSize: 12, marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>CID: {m.deliverable_cid}</div> : null}
                          {m.submission_notes ? <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-2)' }}>{m.submission_notes}</div> : null}
                          {m.submitted_at ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Submitted: {fmtDate(m.submitted_at)}</div> : null}
                          {m.approved_at ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Approved: {fmtDate(m.approved_at)}</div> : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: isOpen && canSubmit ? 14 : 0 }}>No deliverables submitted yet.</div>
                      )}
                      {canSubmit && (
                        <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); submitMilestone(detail.id, m.index); }}>
                          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 8 }}>Submit Deliverable</div>
                          <div style={{ border: '2px dashed var(--accent-border)', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer', background: 'var(--accent-pale)', marginBottom: 10 }} onClick={() => document.getElementById(`file-${detail.id}-${m.index}`).click()}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>📦</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>Click to upload file</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Any file type — stored as local stub (no IPFS yet)</div>
                            <input id={`file-${detail.id}-${m.index}`} type="file" style={{ display: 'none' }} onChange={e => setSubmitFile(e.target.files[0] || null)} />
                          </div>
                          {submitFile ? (
                            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>Selected: {submitFile.name} ({(submitFile.size / 1024).toFixed(1)} KB)</div>
                          ) : null}
                          <textarea className="form-input" rows="3" placeholder="Describe what you've delivered…" style={{ resize: 'vertical', marginBottom: 10 }} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)}></textarea>
                          <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
                            {submitting ? 'Submitting…' : 'Submit Deliverable'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setDetailId(null); setExpandedIdx(null); }}>Close</button>
              {detail.status === 'pending_signatures' ? (
                <button className="btn btn-primary" onClick={() => signContract(detail.id)}>Sign Contract</button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
