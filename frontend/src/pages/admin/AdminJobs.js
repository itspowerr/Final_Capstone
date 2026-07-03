import React, { useState, useCallback } from 'react';

const DEFAULT = { jobs: [] };
function loadData() { try { const r = localStorage.getItem('fl_admin_data'); return r ? JSON.parse(r) : DEFAULT; } catch { return DEFAULT; } }
function saveData(d) { localStorage.setItem('fl_admin_data', JSON.stringify(d)); }
const LIMIT = 5;

export default function AdminJobs() {
  const [data, setData] = useState(loadData);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ client: '', title: '', budget: '', category: '', description: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmFn, setConfirmFn] = useState(null);

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const items = data.jobs.filter(j => {
    if (search && !j.title?.toLowerCase().includes(search.toLowerCase()) && !j.client?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && j.status !== filterStatus) return false;
    return true;
  });
  const totalP = Math.max(1, Math.ceil(items.length / LIMIT));
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);

  const withConfirm = (msg, fn) => { setConfirmMsg(msg); setConfirmFn(() => fn); setConfirmOpen(true); };

  const updateJob = (id, updates) => {
    const d = { ...data, jobs: data.jobs.map(j => j.id === id ? { ...j, ...updates } : j) };
    setData(d); saveData(d); show('Job updated', 'success');
  };

  const openCreate = () => setCreateOpen(true);
  const handleCreate = () => {
    const d = { ...data, jobs: [...data.jobs] };
    const id = (d.jobs[d.jobs.length - 1]?.id || 0) + 1;
    d.jobs.push({ id, ...createForm, budget: parseFloat(createForm.budget) || 0, status: 'open', proposals: 0 });
    setData(d); saveData(d); setCreateOpen(false);
    setCreateForm({ client: '', title: '', budget: '', category: '', description: '' });
    show('Job created', 'success');
  };

  const openEdit = (j) => { setEditItem(j); setEditForm({ title: j.title, description: j.description || '', budget: j.budget, category: j.category, status: j.status }); setEditOpen(true); };
  const handleEditSave = () => {
    const d = { ...data, jobs: data.jobs.map(j => j.id === editItem.id ? { ...j, ...editForm, budget: parseFloat(editForm.budget) || j.budget } : j) };
    setData(d); saveData(d); setEditOpen(false); setEditItem(null); show('Job updated', 'success');
  };

  const openDelete = (id) => { setDeleteTarget(id); setDeleteOpen(true); };
  const handleDelete = () => {
    const d = { ...data, jobs: data.jobs.filter(j => j.id !== deleteTarget) };
    setData(d); saveData(d); setDeleteOpen(false); setDeleteTarget(null); show('Job deleted', 'success');
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Jobs <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({items.length})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={openCreate}>+ Add Job</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by title or client..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="filled">Filled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {paged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><h3>No jobs found</h3></div>
          ) : paged.map(j => (
            <div key={j.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{j.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{j.client} · {j.budget} ETH · {j.category || 'uncategorized'} · <span className={`role-badge ${j.status}`}>{j.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {j.status === 'open' && <button className="btn btn-sm btn-outline" onClick={() => withConfirm(`Close job "${j.title}"?`, () => updateJob(j.id, { status: 'closed' }))}>Close</button>}
                {j.status === 'closed' && <button className="btn btn-sm btn-outline" onClick={() => withConfirm(`Reopen job "${j.title}"?`, () => updateJob(j.id, { status: 'open' }))}>Reopen</button>}
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(j)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => openDelete(j.id)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalP > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          {Array.from({ length: totalP }, (_, i) => i + 1).slice(0, 10).map(n => (
            <button key={n} className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={page >= totalP} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay open" onClick={() => setCreateOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New Job</h3><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Client</label>
                <select className="form-input" value={createForm.client} onChange={e => setCreateForm({ ...createForm, client: e.target.value })}>
                  <option value="">Select client...</option>
                  {data.users?.filter(u => u.role === 'client').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Budget (ETH)</label><input className="form-input" type="number" step="0.01" value={createForm.budget} onChange={e => setCreateForm({ ...createForm, budget: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={3} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay open" onClick={() => setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Edit Job</h3><button className="modal-close" onClick={() => setEditOpen(false)}>×</button></div>
            <div className="modal-body">
              {Object.keys(editForm).map(key => {
                const isEnum = ['status'].includes(key);
                const isLongText = ['description'].includes(key);
                const isNumber = ['budget'].includes(key);
                return (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                    {isEnum ? (
                      <select className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                        <option value="open">Open</option><option value="closed">Closed</option><option value="filled">Filled</option><option value="cancelled">Cancelled</option>
                      </select>
                    ) : isLongText ? (
                      <textarea className="form-input" rows={3} value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                    ) : isNumber ? (
                      <input className="form-input" type="number" step="0.01" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                    ) : (
                      <input className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setEditOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleEditSave}>Save</button></div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-overlay open" onClick={() => setConfirmOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Action</h3><button className="modal-close" onClick={() => setConfirmOpen(false)}>×</button></div>
            <div className="modal-body"><p>{confirmMsg}</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={() => { confirmFn(); setConfirmOpen(false); }}>Confirm</button></div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-overlay open" onClick={() => setDeleteOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Delete</h3><button className="modal-close" onClick={() => setDeleteOpen(false)}>×</button></div>
            <div className="modal-body"><p>Are you sure you want to delete this job? This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
