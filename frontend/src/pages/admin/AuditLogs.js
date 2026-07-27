import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { SkeletonTable } from '../../components/shared/Skeleton';

const LIMIT = 30;

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (entityType) params.entity_type = entityType;
      if (action) params.action = action;
      if (actorSearch.trim()) params.actor_id = actorSearch.trim();
      const res = await api.get('/admin/audit-logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, actorSearch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-sub">Track system events and user actions ({total} total)</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search by Actor ID..."
          value={actorSearch}
          onChange={e => { setActorSearch(e.target.value); setPage(1); }}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); } }}
        />
        <select className="form-input" style={{ maxWidth: 160 }} value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="contract">Contract</option>
          <option value="milestone">Milestone</option>
          <option value="dispute">Dispute</option>
        </select>
        <select className="form-input" style={{ maxWidth: 160 }} value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="sign">Sign</option>
          <option value="fund">Fund</option>
          <option value="submit">Submit</option>
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="dispute">Dispute</option>
          <option value="resolve_dispute">Resolve Dispute</option>
          <option value="complete">Complete</option>
          <option value="cancel">Cancel</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state"><SkeletonTable rows={5} cols={4} /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#x1F4DD;</div>
          <h3>No logs found</h3>
          <p>No audit log entries match your filters.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>From</th>
                <th>To</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td><span className="s-badge">{log.entity_type}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.entity_id}</td>
                  <td><strong>{log.action}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.actor_id || '-'}</td>
                  <td>{log.actor_role || '-'}</td>
                  <td>{log.from_status || '-'}</td>
                  <td>{log.to_status || '-'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map(n => (
            <button key={n} className={page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  );
}
