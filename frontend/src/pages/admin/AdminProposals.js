import React, { useState, useCallback } from 'react';

const DEFAULT = { proposals: [] };
function loadData() { try { const r = localStorage.getItem('fl_admin_data'); return r ? JSON.parse(r) : DEFAULT; } catch { return DEFAULT; } }
function saveData(d) { localStorage.setItem('fl_admin_data', JSON.stringify(d)); }
const LIMIT = 5;

export default function AdminProposals() {
  const [data, setData] = useState(loadData);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ job: '', freelancer: '', amount: '', coverLetter: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const items = data.proposals.filter(p => {
    if (search && !p.job?.toLowerCase().includes(search.toLowerCase()) && !p.freelancer?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });
  const totalP = Math.max(1, Math.ceil(items.length / LIMIT));
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);

  const openCreate = () => setCreateOpen(true);
  const handleCreate = () => {
    const d = { ...data, proposals: [...data.proposals] };
    const id = (d.proposals[d.proposals.length - 1]?.id || 0) + 1;
    d.proposals.push({ id, ...createForm, amount: parseFloat(createForm.amount) || 0, status: 'pending' });
    setData(d); saveData(d); setCreateOpen(false);
    setCreateForm({ job: '', freelancer: '', amount: '', coverLetter: '' });
    show('Proposal created', 'success');
  };

  const openEdit = (p) => { setEditItem(p); setEditForm({ status: p.status, amount: p.amount, coverLetter: p.coverLetter || '' }); setEditOpen(true); };
  const handleEditSave = () => {
    const d = { ...data, proposals: data.proposals.map(p => p.id === editItem.id ? { ...p, ...editForm, amount: parseFloat(editForm.amount) || p.amount } : p) };
    setData(d); saveData(d); setEditOpen(false); setEditItem(null); show('Proposal updated', 'success');
  };

  const openDelete = (id) => { setDeleteTarget(id); setDeleteOpen(true); };
  const handleDelete = () => {
    const d = { ...data, proposals: data.proposals.filter(p => p.id !== deleteTarget) };
    setData(d); saveData(d); setDeleteOpen(false); setDeleteTarget(null); show('Proposal deleted', 'success');
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Proposals <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({items.length})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={openCreate}>+ Add Proposal</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by job or freelancer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {paged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📩</div><h3>No proposals found</h3></div>
          ) : paged.map(p => (
            <div key={p.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.job}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.freelancer} · {p.amount} ETH · <span className={`role-badge ${p.status}`}>{p.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => openDelete(p.id)}>Del</button>
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
            <div className="modal-header"><h3>New Proposal</h3><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Job</label>
                <select className="form-input" value={createForm.job} onChange={e => setCreateForm({ ...createForm, job: e.target.value })}>
                  <option value="">Select job...</option>
                  {data.jobs?.map(j => <option key={j.id} value={j.title}>{j.title}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Freelancer</label>
                <select className="form-input" value={createForm.freelancer} onChange={e => setCreateForm({ ...createForm, freelancer: e.target.value })}>
                  <option value="">Select freelancer...</option>
                  {data.users?.filter(u => u.role === 'freelancer').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Amount (ETH)</label><input className="form-input" type="number" step="0.01" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Cover Letter</label><textarea className="form-input" rows={3} value={createForm.coverLetter} onChange={e => setCreateForm({ ...createForm, coverLetter: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay open" onClick={() => setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Edit Proposal</h3><button className="modal-close" onClick={() => setEditOpen(false)}>×</button></div>
            <div className="modal-body">
              {Object.keys(editForm).map(key => {
                const isEnum = ['status'].includes(key);
                const isNumber = ['amount'].includes(key);
                const isLongText = ['coverLetter'].includes(key);
                return (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                    {isEnum ? (
                      <select className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                        <option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option>
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

      {deleteOpen && (
        <div className="modal-overlay open" onClick={() => setDeleteOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Delete</h3><button className="modal-close" onClick={() => setDeleteOpen(false)}>×</button></div>
            <div className="modal-body"><p>Are you sure you want to delete this proposal? This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
