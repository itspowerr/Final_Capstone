import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import UserSearchSelect from '../../components/admin/UserSearchSelect';
import { SkeletonTable } from '../../components/shared/Skeleton';

const LIMIT = 10;

export default function AdminProposals() {
  const [data, setData] = useState({ proposals: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ job_id: '', freelancer_id: '', bid_amount: '', cover_letter: '', status: 'pending' });

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);
  const showError = useCallback((msg) => show(msg, 'error'), [show]);

  const fetchProposals = useCallback(async (p, q, s) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (q) params.search = q;
      if (s) params.status = s;
      const { data: res } = await api.get('/admin/proposals', { params });
      setData(res);
    } catch { showError('Failed to load proposals'); }
    finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { fetchProposals(page, search, filterStatus); }, [page, fetchProposals]);

  const handleSearch = () => { setPage(1); fetchProposals(1, search, filterStatus); };

  const updateProposal = async (id, updates) => {
    try {
      await api.put(`/admin/proposals/${id}`, updates);
      show('Proposal updated', 'success');
      fetchProposals(page, search, filterStatus);
    } catch { showError('Failed to update proposal'); }
  };

  const deleteProposal = async (id) => {
    try {
      await api.delete(`/admin/proposals/${id}`);
      show('Proposal deleted', 'success');
      fetchProposals(page, search, filterStatus);
    } catch { showError('Failed to delete proposal'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/proposals', { ...form, bid_amount: parseFloat(form.bid_amount) });
      show('Proposal created', 'success');
      setShowModal(false);
      setForm({ job_id: '', freelancer_id: '', bid_amount: '', cover_letter: '', status: 'pending' });
      fetchProposals(page, search, filterStatus);
    } catch (err) { showError(err.response?.data?.detail || 'Failed to create proposal'); }
  };

  const items = data.proposals || [];

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proposals</h1>
          <p className="page-sub">Manage platform proposals ({data.total} total)</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>+ Add Proposal</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); fetchProposals(1, search, e.target.value); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={handleSearch}>Search</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : items.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📩</div><h3>No proposals found</h3></div>
          ) : items.map(p => (
            <div key={p.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.job_title || 'Unknown Job'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.freelancer_name || 'Unknown'} · {p.bid_amount} ETH · <span className={`role-badge ${p.status}`}>{p.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {p.status === 'pending' && <button className="btn btn-sm btn-outline" onClick={() => updateProposal(p.id, { status: 'rejected' })}>Reject</button>}
                <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Withdraw this proposal?')) deleteProposal(p.id); }}>Withdraw</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.pages > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => i + 1).map(n => (
            <button key={n} className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 16 }}>Add Proposal</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Freelancer</label>
                <UserSearchSelect role="freelancer" value={form.freelancer_id ? { id: form.freelancer_id } : null} onChange={u => setForm({ ...form, freelancer_id: u?.id || '' })} placeholder="Search freelancer..." />
                <label style={{ fontSize: 12, fontWeight: 600 }}>Job ID</label>
                <input className="form-input" placeholder="Job ID" required value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} />
                <input className="form-input" type="number" step="0.01" placeholder="Bid Amount (ETH)" required value={form.bid_amount} onChange={e => setForm({ ...form, bid_amount: e.target.value })} />
                <textarea className="form-input" placeholder="Cover Letter" rows={3} value={form.cover_letter} onChange={e => setForm({ ...form, cover_letter: e.target.value })} />
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-sm btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
