import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonStatCard, SkeletonCard } from '../../components/shared/Skeleton';
import api from '../../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/dashboard');
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">Loading platform statistics...</p>
        </div>
      </div>
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <SkeletonCard rows={4} />
        <SkeletonCard rows={4} />
      </div>
    </div>
  );
  if (!stats) return <div className="page-body" style={{ padding: 40, color: 'var(--text-3)' }}>Failed to load dashboard data.</div>;

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">Welcome back! Here's an overview of the platform.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card accent-card">
          <div className="s-top"><span className="s-label">Users</span><div className="s-icon">👥</div></div>
          <div className="s-val">{stats.total_users}</div>
          <div className="s-sub">{stats.active_users} active</div>
        </div>
        <div className="stat-card">
          <div className="s-top"><span className="s-label">Jobs</span><div className="s-icon">📋</div></div>
          <div className="s-val">{stats.total_jobs}</div>
          <div className="s-sub">{stats.open_jobs} open</div>
        </div>
        <div className="stat-card">
          <div className="s-top"><span className="s-label">Contracts</span><div className="s-icon">📄</div></div>
          <div className="s-val">{stats.total_contracts}</div>
          <div className="s-sub">{stats.active_contracts} active · {stats.total_volume_eth} ETH vol.</div>
        </div>
        <div className="stat-card">
          <div className="s-top"><span className="s-label">Disputes</span><div className="s-icon">⚖️</div></div>
          <div className="s-val">{stats.active_disputes}</div>
          <span className="s-badge" style={stats.active_disputes > 0 ? { background: '#fef2f2', color: '#dc2626' } : {}}>
            {stats.active_disputes > 0 ? `${stats.active_disputes} open` : 'All clear'}
          </span>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header"><h3>Platform Fees</h3></div>
          <div className="card-body">
            <div className="cs-val" style={{ fontSize: 32 }}>{stats.platform_fees_accumulated} ETH</div>
            <div className="cs-lbl">Accumulated (2.5% fee)</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Role Distribution</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/users')}>View All</button>
          </div>
          <div className="card-body">
            {['admin', 'client', 'freelancer'].map(r => (
              <div key={r} className="project-row" style={{ border: 'none' }}>
                <div className="project-row-top">
                  <span style={{ textTransform: 'capitalize', fontSize: 14 }}>{r}s</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{stats.role_counts[r]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h3>Recent Users</h3>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/users')}>View All</button>
        </div>
        <div className="card-body">
          {(stats.recent_users || []).map(u => (
            <div className="project-row" key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span style={{ fontWeight: 600 }}>{u.username || u.email}</span> <span className={`role-badge ${u.role}`}>{u.role}</span></div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.joined?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
