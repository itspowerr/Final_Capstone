import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import UserSearchSelect from '../../components/admin/UserSearchSelect';

const LIMIT = 10;

export default function AdminContracts() {
  const [data, setData] = useState({ contracts: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ job_id: '', client_id: '', freelancer_id: '', title: '', description: '', total_amount: '', status: 'draft' });

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);
  const showError = useCallback((msg) => show(msg, 'error'), [show]);

  const fetchContracts = useCallback(async (p, q, s) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (q) params.search = q;
      if (s) params.status = s;
      const { data: res } = await api.get('/admin/contracts', { params });
      setData(res);
    } catch { showError('Failed to load contracts'); }
    finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { fetchContracts(page, search, filterStatus); }, [page, fetchContracts]);

  const handleSearch = () => { setPage(1); fetchContracts(1, search, filterStatus); };

  const updateContract = async (id, status) => {
    try {
      await api.put(`/admin/contracts/${id}`, { status });
      show(`Contract ${status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'updated'}`, 'success');
      fetchContracts(page, search, filterStatus);
    } catch { showError('Failed to update contract'); }
  };

  const deleteContract = async (id) => {
    try {
      await api.delete(`/admin/contracts/${id}`);
      show('Contract deleted', 'success');
      fetchContracts(page, search, filterStatus);
    } catch { showError('Failed to delete contract'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/contracts', { ...form, total_amount: parseFloat(form.total_amount) });
      show('Contract created', 'success');
      setShowModal(false);
      setForm({ job_id: '', client_id: '', freelancer_id: '', title: '', description: '', total_amount: '', status: 'draft' });
      fetchContracts(page, search, filterStatus);
    } catch (err) { showError(err.response?.data?.detail || 'Failed to create contract'); }
  };

  const items = data.contracts || [];

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Contracts <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({data.total})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); fetchContracts(1, search, e.target.value); }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="pending_review">Pending Review</option>
          <option value="pending_signatures">Pending Signatures</option>
          <option value="pending_funding">Pending Funding</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={handleSearch}>Search</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📄</div><h3>No contracts found</h3></div>
          ) : items.map(c => (
            <div key={c.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.client_id?.slice(0, 8)} → {c.freelancer_id?.slice(0, 8)} · {c.total_amount} ETH · <span className={`role-badge ${c.status}`}>{c.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {c.status !== 'completed' && c.status !== 'cancelled' && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => { if (window.confirm('Complete this contract?')) updateContract(c.id, 'completed'); }}>Complete</button>
                    <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Cancel this contract?')) updateContract(c.id, 'cancelled'); }}>Cancel</button>
                  </>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Cancel this contract?')) deleteContract(c.id); }}>Del</button>
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 16 }}>Add Contract</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Client</label>
                <UserSearchSelect role="client" value={form.client_id ? { id: form.client_id } : null} onChange={u => setForm({ ...form, client_id: u?.id || '' })} placeholder="Search client..." />
                <label style={{ fontSize: 12, fontWeight: 600 }}>Freelancer</label>
                <UserSearchSelect role="freelancer" value={form.freelancer_id ? { id: form.freelancer_id } : null} onChange={u => setForm({ ...form, freelancer_id: u?.id || '' })} placeholder="Search freelancer..." />
                <label style={{ fontSize: 12, fontWeight: 600 }}>Job ID</label>
                <input className="form-input" placeholder="Job ID" required value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} />
                <input className="form-input" placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <textarea className="form-input" placeholder="Description" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                <input className="form-input" type="number" step="0.01" placeholder="Total Amount (ETH)" required value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} />
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="pending_signatures">Pending Signatures</option>
                  <option value="pending_funding">Pending Funding</option>
                  <option value="active">Active</option>
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
