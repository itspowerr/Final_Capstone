import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import UserSearchSelect from '../../components/admin/UserSearchSelect';

const LIMIT = 10;

export default function AdminJobs() {
  const [data, setData] = useState({ jobs: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client_id: '', title: '', description: '', budget: '', category: '', status: 'open' });

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);
  const showError = useCallback((msg) => show(msg, 'error'), [show]);

  const fetchJobs = useCallback(async (p, q, s) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (q) params.search = q;
      if (s) params.status = s;
      const { data: res } = await api.get('/admin/jobs', { params });
      setData(res);
    } catch { showError('Failed to load jobs'); }
    finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { fetchJobs(page, search, filterStatus); }, [page, fetchJobs]);

  const handleSearch = () => { setPage(1); fetchJobs(1, search, filterStatus); };

  const updateJob = async (id, updates) => {
    try {
      await api.put(`/admin/jobs/${id}`, updates);
      show('Job updated', 'success');
      fetchJobs(page, search, filterStatus);
    } catch { showError('Failed to update job'); }
  };

  const deleteJob = async (id) => {
    try {
      await api.delete(`/admin/jobs/${id}`);
      show('Job deleted', 'success');
      fetchJobs(page, search, filterStatus);
    } catch { showError('Failed to delete job'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/jobs', { ...form, budget: parseFloat(form.budget) });
      show('Job created', 'success');
      setShowModal(false);
      setForm({ client_id: '', title: '', description: '', budget: '', category: '', status: 'open' });
      fetchJobs(page, search, filterStatus);
    } catch (err) { showError(err.response?.data?.detail || 'Failed to create job'); }
  };

  const items = data.jobs || [];

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Jobs <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({data.total})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); fetchJobs(1, search, e.target.value); }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="filled">Filled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={handleSearch}>Search</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><h3>No jobs found</h3></div>
          ) : items.map(j => (
            <div key={j.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{j.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{j.client_name || 'Unknown'} · {j.budget} ETH · {j.category || 'uncategorized'} · <span className={`role-badge ${j.status}`}>{j.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {j.status === 'open' && <button className="btn btn-sm btn-outline" onClick={() => updateJob(j.id, { status: 'closed' })}>Close</button>}
                {j.status === 'closed' && <button className="btn btn-sm btn-outline" onClick={() => updateJob(j.id, { status: 'open' })}>Reopen</button>}
                <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Cancel this job?')) deleteJob(j.id); }}>Cancel</button>
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
            <h3 style={{ marginBottom: 16 }}>Add Job</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Client</label>
                <UserSearchSelect role="client" value={form.client_id ? { id: form.client_id } : null} onChange={u => setForm({ ...form, client_id: u?.id || '' })} placeholder="Search client..." />
                <input className="form-input" placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <textarea className="form-input" placeholder="Description" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                <input className="form-input" type="number" step="0.01" placeholder="Budget (ETH)" required value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                <input className="form-input" placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="filled">Filled</option>
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
