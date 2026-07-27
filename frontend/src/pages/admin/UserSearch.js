import React, { useState, useCallback } from 'react';
import api from '../../services/api';

const LIMIT = 10;

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  const show = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }, []);

  const doSearch = useCallback(async (q, p) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/users', { params: { search: q.trim(), page: p, limit: LIMIT } });
      setResults(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      show('Failed to search users', 'error');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [show]);

  const handleSearch = () => {
    setPage(1);
    doSearch(query, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    doSearch(query, newPage);
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Search</h1>
          <p className="page-sub">Lookup users by ID, name, email or wallet address.</p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
        Search by User ID, username, email, or bio. Paste a userId from the Disputes page to look up a user.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          className="form-input"
          style={{ maxWidth: 420 }}
          placeholder="Paste User ID or search by name / email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          autoFocus
        />
        <button className="btn btn-sm btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Searching...</div>
      ) : !searched ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h3 style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>Search for a user</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Enter a User ID (e.g. usr_abc123) or a name / email above</p>
        </div>
      ) : results.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <h3 style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>No users found</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No results for "{query}"</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
            Found {total} user{total !== 1 ? 's' : ''}
          </div>

          {results.map(u => (
            <div key={u.id} style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 20px',
              marginBottom: 12,
              background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: u.role === 'admin' ? '#ef4444' : u.role === 'client' ? '#3b82f6' : '#8b5cf6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 18,
                  }}>
                    {(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{u.username || 'Unnamed'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{u.id}</div>
                  </div>
                </div>
                <span className={`role-badge ${u.role}`} style={{ fontSize: 11, fontWeight: 600 }}>{u.role}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 20px', marginTop: 14, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Email</span>
                  <div style={{ fontWeight: 500 }}>{u.email || '---'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Wallet</span>
                  <div style={{ fontWeight: 500, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    {u.wallet_address ? u.wallet_address.slice(0, 10) + '...' + u.wallet_address.slice(-6) : 'Not connected'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Location</span>
                  <div style={{ fontWeight: 500 }}>{u.location || '---'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Auth Method</span>
                  <div style={{ fontWeight: 500 }}>{u.auth_method}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Joined</span>
                  <div style={{ fontWeight: 500 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '---'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Status</span>
                  <div style={{ fontWeight: 500, color: u.is_active !== false ? '#10b981' : '#ef4444' }}>
                    {u.is_active !== false ? 'Active' : 'Suspended'}
                  </div>
                </div>
              </div>

              {u.headline && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic' }}>
                  "{u.headline}"
                </div>
              )}

              {u.skills && u.skills.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {u.skills.slice(0, 6).map(s => (
                    <span key={s} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 12,
                      background: 'var(--accent-pale)', color: 'var(--accent)', fontWeight: 500,
                    }}>{s}</span>
                  ))}
                  {u.skills.length > 6 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{u.skills.length - 6} more</span>}
                </div>
              )}

              {(u.github_url || u.linkedin_url || u.portfolio_url) && (
                <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 12 }}>
                  {u.github_url && <a href={u.github_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>GitHub</a>}
                  {u.linkedin_url && <a href={u.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>LinkedIn</a>}
                  {u.portfolio_url && <a href={u.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Portfolio</a>}
                </div>
              )}
            </div>
          ))}

          {pages > 1 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>← Prev</button>
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map(n => (
                <button key={n} className={page === n ? 'active' : ''} onClick={() => handlePageChange(n)}>{n}</button>
              ))}
              <button disabled={page >= pages} onClick={() => handlePageChange(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
