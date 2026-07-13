import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ width: 110, fontSize: 12, color: 'var(--text-2)', textAlign: 'right', textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, height: 20, background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ width: 40, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color || 'var(--accent)'}` }}>
      <div className="s-top">
        <span className="s-label">{label}</span>
        <div className="s-icon" style={{ fontSize: 18 }}>{icon}</div>
      </div>
      <div className="s-val" style={{ color: color || 'inherit' }}>{value}</div>
      {sub && <div className="s-sub">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS = {
  draft: '#94a3b8', pending_signatures: '#f59e0b', pending_funding: '#f59e0b',
  active: '#3b82f6', completed: '#10b981', cancelled: '#6b7280', disputed: '#ef4444',
  pending: '#f59e0b', submitted: '#8b5cf6', approved: '#10b981', rejected: '#ef4444',
  open: '#ef4444', under_review: '#f59e0b', resolved: '#10b981',
};

export default function Report() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/reports');
        setData(data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 40, color: 'var(--text-3)' }}>Loading report...</div>;
  if (!data) return <div style={{ padding: 40, color: 'var(--text-3)' }}>Failed to load report.</div>;

  const u = data.users || {};
  const c = data.contracts || {};
  const m = data.milestones || {};
  const f = data.financial || {};
  const d = data.disputes || {};

  const maxContractStatus = Math.max(...Object.values(c.by_status || {}), 1);
  const maxMilestoneStatus = Math.max(...Object.values(m.by_status || {}), 1);
  const maxDisputeStatus = Math.max(...Object.values(d.by_status || {}), 1);
  const maxUserRole = Math.max(...Object.values(u.by_role || {}), 1);

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="admin-section-header">
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>System Report</h2>
      </div>

      {/* Top stat cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <StatCard label="Total Users" value={u.total} sub={`${u.active} active · ${u.suspended} suspended`} icon="👥" color="#6366f1" />
        <StatCard label="Total Contracts" value={c.total} sub={`${c.total_volume_eth} ETH volume`} icon="📄" color="#3b82f6" />
        <StatCard label="Total Milestones" value={m.total} sub={`${m.approval_rate}% approval rate`} icon="🎯" color="#8b5cf6" />
        <StatCard label="Disputes" value={d.total} sub={`${d.resolution_rate}% resolved`} icon="⚖️" color="#ef4444" />
      </div>

      {/* Financial summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3>Financial Summary</h3></div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Total Volume</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{f.total_volume_eth} ETH</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Platform Fees (2.5%)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{f.platform_fees_eth} ETH</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Avg Contract Value</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{f.avg_contract_value_eth} ETH</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Avg Milestone Value</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{f.avg_milestone_value_eth} ETH</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="two-col" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Contract Status</h3></div>
          <div className="card-body">
            {Object.entries(c.by_status || {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <Bar key={k} label={k.replace(/_/g, ' ')} value={v} max={maxContractStatus} color={STATUS_COLORS[k] || '#6b7280'} />
            ))}
            {Object.values(c.by_status || {}).every(v => v === 0) && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No contracts yet</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Milestone Status</h3></div>
          <div className="card-body">
            {Object.entries(m.by_status || {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxMilestoneStatus} color={STATUS_COLORS[k] || '#6b7280'} />
            ))}
            <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-3)' }}>Approval: </span><strong style={{ color: '#10b981' }}>{m.approval_rate}%</strong></div>
              <div><span style={{ color: 'var(--text-3)' }}>Rejection: </span><strong style={{ color: '#ef4444' }}>{m.rejection_rate}%</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Users + Disputes row */}
      <div className="two-col" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>User Distribution</h3></div>
          <div className="card-body">
            {Object.entries(u.by_role || {}).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxUserRole} color={k === 'admin' ? '#ef4444' : k === 'client' ? '#3b82f6' : '#8b5cf6'} />
            ))}
            <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-3)' }}>New (7d): </span><strong>{u.new_last_7d}</strong></div>
              <div><span style={{ color: 'var(--text-3)' }}>New (30d): </span><strong>{u.new_last_30d}</strong></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Dispute Breakdown</h3></div>
          <div className="card-body">
            {Object.entries(d.by_status || {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <Bar key={k} label={k.replace(/_/g, ' ')} value={v} max={maxDisputeStatus} color={STATUS_COLORS[k] || '#6b7280'} />
            ))}
            {d.total > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text-3)' }}>Refunds: </span><strong style={{ color: '#ef4444' }}>{d.refund_count}</strong></div>
                <div><span style={{ color: 'var(--text-3)' }}>Releases: </span><strong style={{ color: '#10b981' }}>{d.release_count}</strong></div>
                <div><span style={{ color: 'var(--text-3)' }}>Resolution: </span><strong>{d.resolution_rate}%</strong></div>
              </div>
            )}
            {d.total === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No disputes</p>}
          </div>
        </div>
      </div>

      {/* Proposals */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3>Proposals</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 40, fontSize: 14 }}>
            <div>
              <span style={{ color: 'var(--text-3)' }}>Total Proposals Submitted: </span>
              <strong style={{ fontSize: 20 }}>{data.proposals?.total || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-header"><h3>Recent Activity</h3></div>
        <div className="card-body">
          {(data.recent_activity || []).length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No recent activity</p>}
          {(data.recent_activity || []).map(log => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
            }}>
              <span style={{ fontWeight: 600, minWidth: 80 }}>{log.action}</span>
              <span style={{ color: 'var(--text-3)' }}>{log.entity_type}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{log.entity_id?.slice(0, 16)}...</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>
                {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
