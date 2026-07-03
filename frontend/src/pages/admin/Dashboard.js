import React from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT = {
  users: [{ id: 1, username: 'Alice Johnson', email: 'alice@example.com', role: 'client', joined: '2025-01-15', is_active: true }],
  jobs: [{ id: 1, title: 'Build a React Dashboard', budget: 3, status: 'open' }],
  contracts: [{ id: 1, amount: 1.1, status: 'active' }],
  disputes: [{ id: 1, status: 'open' }],
};

function loadData() {
  try {
    const raw = localStorage.getItem('fl_admin_data');
    return raw ? JSON.parse(raw) : DEFAULT;
  } catch { return DEFAULT; }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const data = loadData();

  const stats = {
    total_users: data.users.length,
    active_users: data.users.filter(u => u.is_active).length,
    total_jobs: data.jobs.length,
    open_jobs: data.jobs.filter(j => j.status === 'open').length,
    total_contracts: data.contracts.length,
    active_contracts: data.contracts.filter(c => c.status === 'active').length,
    total_volume_eth: data.contracts.reduce((s, c) => s + (c.amount || 0), 0),
    active_disputes: data.disputes.filter(d => d.status === 'open').length,
    platform_fees_accumulated: data.contracts.reduce((s, c) => s + (c.amount || 0) * 0.025, 0),
    role_counts: {
      admin: data.users.filter(u => u.role === 'admin').length,
      client: data.users.filter(u => u.role === 'client').length,
      freelancer: data.users.filter(u => u.role === 'freelancer').length,
    },
  };

  const recentUsers = [...data.users].sort((a, b) => new Date(b.joined || 0) - new Date(a.joined || 0)).slice(0, 5);

  return (
    <div style={{ padding: '28px 32px' }}>
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
          <div className="s-sub">{stats.active_contracts} active · {stats.total_volume_eth.toFixed(2)} ETH vol.</div>
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
            <div className="cs-val" style={{ fontSize: 32 }}>{stats.platform_fees_accumulated.toFixed(4)} ETH</div>
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
          {recentUsers.map(u => (
            <div className="project-row" key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span style={{ fontWeight: 600 }}>{u.username}</span> <span className={`role-badge ${u.role}`}>{u.role}</span></div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.joined}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
