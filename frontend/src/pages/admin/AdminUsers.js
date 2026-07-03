import React, { useState, useCallback } from 'react';

const DEFAULT = { users: [] };
function loadData() { try { const r = localStorage.getItem('fl_admin_data'); return r ? JSON.parse(r) : DEFAULT; } catch { return DEFAULT; } }
function saveData(d) { localStorage.setItem('fl_admin_data', JSON.stringify(d)); }
const LIMIT = 5;

export default function AdminUsers() {
  const [data, setData] = useState(loadData);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', role: 'freelancer', hourly_rate: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const items = data.users.filter(u => {
    if (search && !u.username?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && u.role !== filterRole) return false;
    return true;
  });
  const totalP = Math.max(1, Math.ceil(items.length / LIMIT));
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);

  const toggleActive = (id, is_active) => {
    const d = { ...data, users: data.users.map(u => u.id === id ? { ...u, is_active } : u) };
    setData(d); saveData(d);
    show(`User ${is_active ? 'activated' : 'suspended'}`, 'success');
  };

  const openCreate = () => setCreateOpen(true);
  const handleCreate = () => {
    const d = { ...data, users: [...data.users] };
    const id = (d.users[d.users.length - 1]?.id || 0) + 1;
    d.users.push({ id, ...createForm, joined: new Date().toISOString().slice(0, 10), is_active: true });
    setData(d); saveData(d); setCreateOpen(false);
    setCreateForm({ username: '', email: '', password: '', role: 'freelancer', hourly_rate: 0 });
    show('User created', 'success');
  };

  const openEdit = (u) => { setEditItem(u); setEditForm({ username: u.username, email: u.email, role: u.role, is_active: u.is_active, headline: u.headline || '', hourly_rate: u.hourly_rate || 0 }); setEditOpen(true); };
  const handleEditSave = () => {
    const d = { ...data, users: data.users.map(u => u.id === editItem.id ? { ...u, ...editForm } : u) };
    setData(d); saveData(d); setEditOpen(false); setEditItem(null);
    show('User updated', 'success');
  };

  const openDelete = (id) => { setDeleteTarget(id); setDeleteOpen(true); };
  const handleDelete = () => {
    const d = { ...data, users: data.users.filter(u => u.id !== deleteTarget) };
    setData(d); saveData(d); setDeleteOpen(false); setDeleteTarget(null);
    show('User deleted', 'success');
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Users <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({items.length})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={openCreate}>+ Add User</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="client">Client</option>
          <option value="freelancer">Freelancer</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {paged.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><h3>No users found</h3></div>
          ) : paged.map(u => (
            <div key={u.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="user-avatar">{(u.username?.[0] || '?').toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username || 'Unnamed'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email} <span className={`role-badge ${u.role}`} style={{ marginLeft: 6 }}>{u.role}</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: u.is_active ? 'var(--green)' : 'var(--text-3)' }}>{u.is_active ? 'Active' : 'Suspended'}</span>
                <button className="btn btn-sm btn-outline" onClick={() => toggleActive(u.id, !u.is_active)}>{u.is_active ? 'Suspend' : 'Activate'}</button>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(u)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => openDelete(u.id)}>Del</button>
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
            <div className="modal-header"><h3>New User</h3><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Role</label>
                <select className="form-input" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="freelancer">Freelancer</option>
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Hourly Rate (ETH)</label><input className="form-input" type="number" step="0.01" value={createForm.hourly_rate} onChange={e => setCreateForm({ ...createForm, hourly_rate: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay open" onClick={() => setEditOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Edit User</h3><button className="modal-close" onClick={() => setEditOpen(false)}>×</button></div>
            <div className="modal-body">
              {Object.keys(editForm).map(key => {
                const isEnum = ['role'].includes(key);
                const isBool = typeof editForm[key] === 'boolean';
                const isNumber = ['hourly_rate'].includes(key);
                const isLongText = ['headline', 'bio'].includes(key);
                return (
                  <div key={key} className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                    {isBool ? (
                      <select className="form-input" value={editForm[key] ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, [key]: e.target.value === 'true' })}>
                        <option value="true">True</option><option value="false">False</option>
                      </select>
                    ) : isEnum ? (
                      <select className="form-input" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}>
                        <option value="admin">Admin</option><option value="client">Client</option><option value="freelancer">Freelancer</option>
                      </select>
                    ) : isLongText ? (
                      <textarea className="form-input" rows={3} value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} />
                    ) : isNumber ? (
                      <input className="form-input" type="number" step="0.01" value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: parseFloat(e.target.value) || 0 })} />
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
            <div className="modal-body"><p>Are you sure you want to delete this user? This action cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
