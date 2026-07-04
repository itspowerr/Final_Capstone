import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const LIMIT = 10;

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [resolving, setResolving] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const show = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }, []);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/admin/disputes', { params });
      setDisputes(res.data.disputes || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      show(err.response?.data?.detail?.message || 'Failed to load disputes', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, show]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const handleResolve = async (disputeId, releaseToFreelancer) => {
    setResolving(disputeId);
    try {
      await api.post(`/disputes/${disputeId}/resolve`, {
        release_to_freelancer: releaseToFreelancer,
        resolution_notes: resolveNotes,
      });
      show(`Dispute resolved: ${releaseToFreelancer ? 'released to freelancer' : 'refunded to client'}`, 'success');
      setResolveNotes('');
      fetchDisputes();
    } catch (err) {
      show(err.response?.data?.detail?.message || 'Failed to resolve dispute', 'error');
    } finally {
      setResolving(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>
          Disputes <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>({total})</span>
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select
          className="form-input"
          style={{ maxWidth: 160 }}
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading disputes...</p></div>
      ) : disputes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#x2696;&#xFE0F;</div>
          <h3>No disputes found</h3>
          <p>All clear.</p>
        </div>
      ) : disputes.map(d => (
        <div className="dispute-card" key={d.id}>
          <div className="dispute-header">
            <span style={{ fontWeight: 600 }}>Contract: {d.contract_id}</span>
            <span className={`status-badge status-${d.status === 'open' ? 'pending' : 'completed'}`}>{d.status}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            <strong>Raised by:</strong> {d.raised_by} &mdash; <strong>Reason:</strong> {d.reason}
          </p>
          {d.status === 'open' && (
            <div className="dispute-actions">
              <div style={{ marginBottom: 8, width: '100%' }}>
                <input
                  className="form-input"
                  placeholder="Resolution notes (optional)"
                  value={resolving === d.id ? resolveNotes : ''}
                  onChange={e => setResolveNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                onClick={() => handleResolve(d.id, true)}
                disabled={resolving === d.id}
                className="btn btn-sm btn-success"
              >
                {resolving === d.id ? 'Processing...' : 'Release to Freelancer'}
              </button>
              <button
                onClick={() => handleResolve(d.id, false)}
                disabled={resolving === d.id}
                className="btn btn-sm btn-danger"
              >
                {resolving === d.id ? 'Processing...' : 'Refund Client'}
              </button>
            </div>
          )}
          {d.status === 'resolved' && (
            <div>
              <span className="s-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
                Decision: {d.decision}
              </span>
              {d.resolution_notes && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                  Notes: {d.resolution_notes}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map(n => (
            <button key={n} className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}

      {toast.msg && <div className={`Toast Toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
