import React, { useState, useCallback } from 'react';

const DEFAULT = { disputes: [] };
function loadData() { try { const r = localStorage.getItem('fl_admin_data'); return r ? JSON.parse(r) : DEFAULT; } catch { return DEFAULT; } }
function saveData(d) { localStorage.setItem('fl_admin_data', JSON.stringify(d)); }
const LIMIT = 10;

export default function AdminDisputes() {
  const [data, setData] = useState(loadData);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ contract: '', raisedBy: '', reason: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const items = data.disputes.filter(d => {
    if (search && !d.reason?.toLowerCase().includes(search.toLowerCase()) && !d.raisedBy?.toLowerCase().includes(search.toLowerCase()) && !d.contract?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });
  const totalP = Math.max(1, Math.ceil(items.length / LIMIT));
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);

  const resolveDispute = (id, decision) => {
    const d = { ...data, disputes: data.disputes.map(ds => ds.id === id ? { ...ds, status: 'resolved', decision } : ds) };
    setData(d); saveData(d); show('Dispute resolved', 'success');
  };

  const openCreate = () => setCreateOpen(true);
  const handleCreate = () => {
    const d = { ...data, disputes: [...data.disputes] };
    const id = (d.disputes[d.disputes.length - 1]?.id || 0) + 1;
    d.disputes.push({ id, ...createForm, status: 'open', date: new Date().toISOString().slice(0, 10), decision: '' });
    setData(d); saveData(d); setCreateOpen(false);
    setCreateForm({ contract: '', raisedBy: '', reason: '' });
    show('Dispute created', 'success');
  };

  const openEdit = (d) => { setEditItem(d); setEditForm({ reason: d.reason, status: d.status, decision: d.decision || '' }); setEditOpen(true); };
  const handleEditSave = () => {
    const d = { ...data, disputes: data.disputes.map(ds => ds.id === editItem.id ? { ...ds, ...editForm } : ds) };
    setData(d); saveData(d); setEditOpen(false); setEditItem(null); show('Dispute updated', 'success');
  };

  const openDelete = (id) => { setDeleteTarget(id); setDeleteOpen(true); };
  const handleDelete = () => {
    const d = { ...data, disputes: data.disputes.filter(d => d.id !== deleteTarget) };
    setData(d); saveData(d); setDeleteOpen(false); setDeleteTarget(null); show('Dispute deleted', 'success');
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Disputes <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({items.length})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={openCreate}>+ Add Dispute</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by contract, raised by, reason..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {paged.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⚖️</div><h3>No disputes found</h3><p>All clear.</p></div>
      ) : paged.map(d => (
        <div className="dispute-card" key={d.id}>
          <div className="dispute-header">
            <span style={{ fontWeight: 600 }}>Contract: {d.contract}</span>
            <span className={`status-badge status-${d.status === 'open' ? 'pending' : 'completed'}`}>{d.status}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}><strong>Raised by:</strong> {d.raisedBy} — <strong>Reason:</strong> {d.reason}</p>
          {d.status === 'open' && (
            <div className="dispute-actions">
              <button onClick={() => resolveDispute(d.id, 'release')} className="btn btn-sm btn-success">Release to Freelancer</button>
              <button onClick={() => resolveDispute(d.id, 'refund')} className="btn btn-sm btn-danger">Refund Client</button>
            </div>
          )}
          {d.status === 'resolved' && <span className="s-badge" style={{ background: '#ecfdf5', color: '#059669' }}>Decision: {d.decision}</span>}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => openEdit(d)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => openDelete(d.id)}>Del</button>
          </div>
        </div>
      ))}

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
            <div className="modal-header"><h3>New Dispute</h3><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Contract</label><input className="form-input" value={createForm.contract} onChange={e => setCreateForm({ ...createForm, contract: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Raised By</label><input className="form-input" value={createForm.raisedBy} onChange={e => setCreateForm({ ...createForm, raisedBy: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Reason</label><textarea className="form-input" rows={3} value={createForm.reason} onChange={e => setCreateForm({ ...createForm, reason: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay open" onClick={() => setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Edit Dispute</h3><button className="modal-close" onClick={() => setEditOpen(false)}>×</button></div>
            <div className="modal-body">
              {Object.keys(editForm).map(key => {
                const isEnum = ['status', 'decision'].includes(key);
                const isLongText = ['reason'].includes(key);
                return (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                    {isEnum ? (
                      <select className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                        {key === 'status' && <><option value="open">Open</option><option value="resolved">Resolved</option></>}
                        {key === 'decision' && <><option value="">None</option><option value="release">Release</option><option value="refund">Refund</option></>}
                      </select>
                    ) : isLongText ? (
                      <textarea className="form-input" rows={3} value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
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
            <div className="modal-body"><p>Are you sure you want to delete this dispute? This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
