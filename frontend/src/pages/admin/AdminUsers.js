import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const LIMIT = 10;

export default function AdminUsers() {
  const [data, setData] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'freelancer' });

  const show = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3000); }, []);

  const fetchUsers = useCallback(async (p, q, r) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (q) params.search = q;
      if (r) params.role = r;
      const { data: res } = await api.get('/admin/users', { params });
      setData(res);
    } catch { show('Failed to load users', 'error'); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { fetchUsers(page, search, filterRole); }, [page, search, filterRole, fetchUsers]);

  const handleSearch = () => { setPage(1); fetchUsers(1, search, filterRole); };

  const toggleActive = async (id, is_active) => {
    try {
      await api.put(`/admin/users/${id}`, { is_active });
      show(`User ${is_active ? 'activated' : 'suspended'}`, 'success');
      fetchUsers(page, search, filterRole);
    } catch { show('Failed to update user', 'error'); }
  };

  const deleteUser = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      show('User deleted', 'success');
      fetchUsers(page, search, filterRole);
    } catch { show('Failed to delete user', 'error'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      show('User created', 'success');
      setShowModal(false);
      setForm({ username: '', email: '', password: '', role: 'freelancer' });
      fetchUsers(page, search, filterRole);
    } catch (err) { show(err.response?.data?.detail || 'Failed to create user', 'error'); }
  };

  const items = data.users || [];

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Users <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({data.total})</span></h2>
        <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
        <select className="form-input" style={{ maxWidth: 160 }} value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); fetchUsers(1, search, e.target.value); }}>
          <option value="">All Roles</option>
          <option value="client">Client</option>
          <option value="freelancer">Freelancer</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={handleSearch}>Search</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingTop: 20 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><h3>No users found</h3></div>
          ) : items.map(u => (
            <div key={u.id} className="project-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="user-avatar">{(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username || 'Unnamed'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email} <span className={`role-badge ${u.role}`} style={{ marginLeft: 6 }}>{u.role}</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: u.is_active ? '#10b981' : 'var(--text-3)' }}>{u.is_active ? 'Active' : 'Suspended'}</span>
                <button className="btn btn-sm btn-outline" onClick={() => toggleActive(u.id, !u.is_active)}>{u.is_active ? 'Suspend' : 'Activate'}</button>
                <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Deactivate this user?')) deleteUser(u.id); }}>Deactivate</button>
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 16 }}>Add User</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="form-input" placeholder="Username" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                <input className="form-input" type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className="form-input" type="password" placeholder="Password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="freelancer">Freelancer</option>
                  <option value="client">Client</option>
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
