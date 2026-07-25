import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

function StatIcon({ type }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (type === 'users') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (type === 'jobs') return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" /><path d="M3 12h18" /></svg>;
  if (type === 'contracts') return <svg {...common}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></svg>;
  if (type === 'disputes') return <svg {...common}><path d="M12 3v18" /><path d="m5 8 7-5 7 5" /><path d="M5 8l-3 7h6L5 8Z" /><path d="M19 8l-3 7h6l-3-7Z" /><path d="M7 21h10" /></svg>;
  return null;
}

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

  if (loading) return <div className="admin-dashboard-state">Loading dashboard...</div>;
  if (!stats) return <div className="admin-dashboard-state admin-dashboard-error">Failed to load dashboard data.</div>;

  const roleRows = ['admin', 'client', 'freelancer'];
  const recentUsers = stats.recent_users || [];

  return (
    <div className="admin-dashboard-shell">
      <section className="admin-hero-card">
        <div className="admin-hero-copy">
          <span className="dash-eyebrow">Admin Overview</span>
          <h1>Platform control center</h1>
          <p>Monitor FreeLedger activity, manage accounts, review marketplace records, and keep disputes under control from one workspace.</p>
        </div>
        <div className="admin-hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/users')}>Manage Users</button>
          <button className="btn btn-outline" onClick={() => navigate('/audit-logs')}>View Audit Logs</button>
        </div>
      </section>

      <div className="stats-grid admin-stats-grid">
        <button className="stat-card accent-card admin-stat-card" type="button" onClick={() => navigate('/users')}>
          <div className="s-top"><span className="s-label">Users</span><div className="s-icon"><StatIcon type="users" /></div></div>
          <div className="s-val">{stats.total_users}</div>
          <div className="s-sub">{stats.active_users} active accounts</div>
        </button>
        <button className="stat-card admin-stat-card" type="button" onClick={() => navigate('/jobs')}>
          <div className="s-top"><span className="s-label">Jobs</span><div className="s-icon"><StatIcon type="jobs" /></div></div>
          <div className="s-val">{stats.total_jobs}</div>
          <div className="s-sub">{stats.open_jobs} open jobs</div>
        </button>
        <button className="stat-card admin-stat-card" type="button" onClick={() => navigate('/contracts')}>
          <div className="s-top"><span className="s-label">Contracts</span><div className="s-icon"><StatIcon type="contracts" /></div></div>
          <div className="s-val">{stats.total_contracts}</div>
          <div className="s-sub">{stats.active_contracts} active · {stats.total_volume_eth} ETH volume</div>
        </button>
        <button className="stat-card admin-stat-card" type="button" onClick={() => navigate('/disputes')}>
          <div className="s-top"><span className="s-label">Disputes</span><div className="s-icon"><StatIcon type="disputes" /></div></div>
          <div className="s-val">{stats.active_disputes}</div>
          <span className={stats.active_disputes > 0 ? 's-badge danger' : 's-badge'}>
            {stats.active_disputes > 0 ? `${stats.active_disputes} open` : 'All clear'}
          </span>
        </button>
      </div>

      <div className="admin-dashboard-grid">
        <section className="dash-card admin-dashboard-card">
          <div className="dash-card-header">
            <div>
              <h3>Platform Fees</h3>
              <p>Accumulated 2.5% escrow service fee</p>
            </div>
          </div>
          <div className="dash-card-body">
            <div className="admin-fee-display">
              <strong>{stats.platform_fees_accumulated} ETH</strong>
              <span>Current fee balance recorded by the platform dashboard.</span>
            </div>
          </div>
        </section>

        <section className="dash-card admin-dashboard-card">
          <div className="dash-card-header">
            <div>
              <h3>Role Distribution</h3>
              <p>Registered account types</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/users')}>View All</button>
          </div>
          <div className="dash-card-body">
            {roleRows.map((role) => (
              <div key={role} className="admin-role-row">
                <span className={`role-dot ${role}`} />
                <span className="admin-role-name">{role}s</span>
                <strong>{stats.role_counts?.[role] ?? 0}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="dash-card admin-dashboard-card admin-recent-users-card">
        <div className="dash-card-header">
          <div>
            <h3>Recent Users</h3>
            <p>Latest accounts created in FreeLedger</p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/users')}>View All</button>
        </div>
        <div className="dash-card-body">
          {recentUsers.length === 0 ? (
            <div className="empty-state">No recent users found.</div>
          ) : recentUsers.map((u) => (
            <div className="admin-user-row" key={u.id}>
              <div className="user-avatar">{(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
              <div className="admin-user-main">
                <strong>{u.username || u.email}</strong>
                <span>{u.email || 'No email'} <em className={`role-badge ${u.role}`}>{u.role}</em></span>
              </div>
              <time>{u.joined?.slice(0, 10) || 'Recently'}</time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}