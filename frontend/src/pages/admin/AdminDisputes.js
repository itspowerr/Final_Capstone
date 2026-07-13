import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const LIMIT = 10;

const STATUS_COLORS = {
  pending: '#f59e0b',
  funded: '#3b82f6',
  submitted: '#8b5cf6',
  approved: '#10b981',
  rejected: '#ef4444',
};

const MILESTONE_STATUS_LABEL = {
  pending: 'Pending',
  funded: 'Funded',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

function MilestoneRow({ m }) {
  const color = STATUS_COLORS[m.status] || '#6b7280';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 6,
      background: 'var(--bg-secondary, #f9fafb)', marginBottom: 4, fontSize: 13,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, marginRight: 8 }}>#{m.index + 1}</span>
        <span>{m.description}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600 }}>${Number(m.amount).toFixed(2)}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
          background: color + '18', color, textTransform: 'capitalize',
        }}>
          {MILESTONE_STATUS_LABEL[m.status] || m.status}
        </span>
      </div>
    </div>
  );
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [resolving, setResolving] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [expanded, setExpanded] = useState(null);

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

  const formatAmount = (amt) => Number(amt || 0).toFixed(4);

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
          <option value="under_review">Under Review</option>
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
      ) : disputes.map(d => {
        const isExpanded = expanded === d.id;
        const cd = d.contract_detail;
        const milestones = d.milestones || [];
        const approved = milestones.filter(m => m.status === 'approved').length;
        const completed = milestones.filter(m => ['approved', 'submitted'].includes(m.status)).length;
        const totalMs = milestones.length;

        return (
          <div className="dispute-card" key={d.id} style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div
              className="dispute-header"
              style={{ cursor: 'pointer', padding: '16px 20px' }}
              onClick={() => setExpanded(isExpanded ? null : d.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <span style={{
                  fontWeight: 700, fontSize: 15,
                  color: 'var(--text-1, #111827)',
                }}>
                  {cd?.title || 'Unknown Contract'}
                </span>
                <span className={`status-badge status-${d.status === 'open' ? 'pending' : 'completed'}`}>
                  {d.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-2, #6b7280)' }}>
                {cd && <span>{formatAmount(cd.total_amount)} ETH</span>}
                {totalMs > 0 && (
                  <span>{approved}/{totalMs} approved</span>
                )}
                <span style={{ fontSize: 18 }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Dispute Details
                    </h4>
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <div><strong>Raised by:</strong> {d.raised_by}</div>
                      <div><strong>Reason:</strong> {d.reason}</div>
                      {cd && (
                        <>
                          <div><strong>Client:</strong> {d.contract_detail?.client_id || d.contract_id}</div>
                          <div><strong>Freelancer:</strong> {d.contract_detail?.freelancer_id || 'Not assigned'}</div>
                          <div><strong>Contract status:</strong> <span style={{ textTransform: 'capitalize' }}>{cd.status}</span></div>
                          {cd.on_chain_id && <div><strong>On-chain ID:</strong> {cd.on_chain_id}</div>}
                          <div><strong>Created:</strong> {new Date(cd.created_at || d.created_at).toLocaleDateString()}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Milestones ({completed}/{totalMs} completed)
                    </h4>
                    {milestones.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-3, #9ca3af)' }}>No milestones found.</p>
                    ) : (
                      <div>
                        {milestones.map(m => <MilestoneRow key={m.index} m={m} />)}
                        <div style={{
                          marginTop: 8, padding: '6px 12px', borderRadius: 6,
                          background: 'var(--bg-secondary, #f9fafb)', fontSize: 12,
                          display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span>Total escrow</span>
                          <strong>{formatAmount(cd?.total_amount)} ETH</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {d.status === 'open' && (
                  <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'var(--bg-secondary, #f3f4f6)' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                      Resolution Notes
                    </label>
                    <textarea
                      className="form-input"
                      placeholder="Explain your decision (optional)"
                      value={resolving === d.id ? resolveNotes : ''}
                      onChange={e => setResolveNotes(e.target.value)}
                      rows={2}
                      style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 10 }}>
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
                  </div>
                )}

                {d.status === 'resolved' && (
                  <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: '#ecfdf5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
                        Resolved: {d.decision === 'release' ? 'Released to Freelancer' : 'Refunded to Client'}
                      </span>
                    </div>
                    {d.resolution_notes && (
                      <p style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
                        {d.resolution_notes}
                      </p>
                    )}
                    <button className="btn btn-sm btn-danger" style={{ marginTop: 8 }} onClick={async () => {
                      if (window.confirm('Permanently delete this dispute?')) {
                        try {
                          await api.delete(`/admin/disputes/${d.id}`);
                          show('Dispute deleted', 'success');
                          fetchDisputes();
                        } catch (err) { show(err.response?.data?.detail?.message || 'Failed to delete', 'error'); }
                      }
                    }}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

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
