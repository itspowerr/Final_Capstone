import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

export default function UserSearchSelect({ role, value, onChange, placeholder = 'Search users...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value || null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); return; }
    setLoading(true);
    const params = { search: query, limit: 10 };
    if (role) params.role = role;
    api.get('/admin/users', { params })
      .then(res => setResults(res.data.users || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query, role]);

  const handleSelect = (user) => {
    setSelected(user);
    setQuery('');
    setResults([]);
    setOpen(false);
    if (onChange) onChange(user);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }} onClick={() => { setSelected(null); setQuery(''); if (onChange) onChange(null); }}>
          <div className="user-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{(selected.username?.[0] || selected.email?.[0] || '?').toUpperCase()}</div>
          <span style={{ fontSize: 13, flex: 1 }}>{selected.username || selected.email}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>×</span>
        </div>
      ) : (
        <input
          className="form-input"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{ width: '100%' }}
        />
      )}
      {open && query && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
          {loading ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-3)' }}>Searching...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-3)' }}>No users found</div>
          ) : results.map(u => (
            <div key={u.id} onClick={() => handleSelect(u)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 13 }} className="project-row">
              <div className="user-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
              <div>
                <div>{u.username || 'Unnamed'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email} <span className={`role-badge ${u.role}`}>{u.role}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
