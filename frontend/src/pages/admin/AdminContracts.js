import React, { useState, useCallback } from 'react';

const DEFAULT = { contracts: [] };
function loadData() { try { const r = localStorage.getItem('fl_admin_data'); return r ? JSON.parse(r) : DEFAULT; } catch { return DEFAULT; } }
function saveData(d) { localStorage.setItem('fl_admin_data', JSON.stringify(d)); }
const LIMIT = 5;

export default function AdminContracts() {
  const [data, setData] = useState(loadData);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ client: '', freelancer: '', job: '', amount: '', deadline: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmFn, setConfirmFn] = useState(null);

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const items = data.contracts.filter(c => {
    if (search && !c.job?.toLowerCase().includes(search.toLowerCase()) && !c.freelancer?.toLowerCase().includes(search.toLowerCase()) && !c.client?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });
  const totalP = Math.max(1, Math.ceil(items.length / LIMIT));
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);

  const withConfirm = (msg, fn) => { setConfirmMsg(msg); setConfirmFn(() => fn); setConfirmOpen(true); };

  const updateContract = (id, status) => {
    const d = { ...data, contracts: data.contracts.map(c => c.id === id ? { ...c, status } : c) };
    setData(d); saveData(d); show(`Contract ${status === 'completed' ? 'completed' : 'cancelled'}`, 'success');
  };

  const openCreate = () => setCreateOpen(true);
  const handleCreate = () => {
    const d = { ...data, contracts: [...data.contracts] };
    const id = (d.contracts[d.contracts.length - 1]?.id || 0) + 1;
    d.contracts.push({ id, ...createForm, amount: parseFloat(createForm.amount) || 0, status: 'draft', started: '' });
    setData(d); saveData(d); setCreateOpen(false);
    setCreateForm({ client: '', freelancer: '', job: '', amount: '', deadline: '' });
    show('Contract created', 'success');
  };

  const openEdit = (c) => { setEditItem(c); setEditForm({ job: c.job, amount: c.amount, status: c.status, deadline: c.deadline || '' }); setEditOpen(true); };
  const handleEditSave = () => {
    const d = { ...data, contracts: data.contracts.map(c => c.id === editItem.id ? { ...c, ...editForm, amount: parseFloat(editForm.amount) || c.amount } : c) };
    setData(d); saveData(d); setEditOpen(false); setEditItem(null); show('Contract updated', 'success');
  };

  const openDelete = (id) => { setDeleteTarget(id); setDeleteOpen(true); };
  const handleDelete = () => {
    const d = { ...data, contracts: data.contracts.filter(c => c.id !== deleteTarget) };
    setData(d); saveData(d); setDeleteOpen(false); setDeleteTarget(null); show('Contract deleted', 'success');
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Contracts <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({items.length})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={openCreate}>+ Add Contract</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by job, freelancer, client..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="pending_review">Pending Review</option>
          <option value="pending_funding">Pending Funding</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {paged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📄</div><h3>No contracts found</h3></div>
          ) : paged.map(c => (
            <div key={c.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.job}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.client} → {c.freelancer} · {c.amount} ETH · <span className={`role-badge ${c.status}`}>{c.status}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {c.status !== 'completed' && c.status !== 'cancelled' && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => withConfirm(`Mark contract "${c.job}" as completed?`, () => updateContract(c.id, 'completed'))}>Complete</button>
                    <button className="btn btn-sm btn-danger" onClick={() => withConfirm(`Cancel contract "${c.job}"? This cannot be undone.`, () => updateContract(c.id, 'cancelled'))}>Cancel</button>
                  </>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => openDelete(c.id)}>Del</button>
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
            <div className="modal-header"><h3>New Contract</h3><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Client</label>
                <select className="form-input" value={createForm.client} onChange={e => setCreateForm({ ...createForm, client: e.target.value })}>
                  <option value="">Select client...</option>
                  {data.users?.filter(u => u.role === 'client').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Freelancer (optional)</label>
                <select className="form-input" value={createForm.freelancer} onChange={e => setCreateForm({ ...createForm, freelancer: e.target.value })}>
                  <option value="">Select freelancer...</option>
                  {data.users?.filter(u => u.role === 'freelancer').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={createForm.job} onChange={e => setCreateForm({ ...createForm, job: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Total Amount (ETH)</label><input className="form-input" type="number" step="0.01" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Deadline</label><input className="form-input" type="date" value={createForm.deadline} onChange={e => setCreateForm({ ...createForm, deadline: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay open" onClick={() => setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Edit Contract</h3><button className="modal-close" onClick={() => setEditOpen(false)}>×</button></div>
            <div className="modal-body">
              {Object.keys(editForm).map(key => {
                const isEnum = ['status'].includes(key);
                const isNumber = ['amount'].includes(key);
                return (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                    {isEnum ? (
                      <select className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                        <option value="draft">Draft</option><option value="pending_review">Pending Review</option><option value="pending_funding">Pending Funding</option>
                        <option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                      </select>
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
            <div className="modal-body"><p>Are you sure you want to delete this contract? This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
