import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';
import '../../css/freelancer/dashboard.css';

function fmtCurrency(n) {
  const v = Number(n || 0);
  if (!v) return '0 ETH';
  return v.toLocaleString() + ' ETH';
}

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: '—' });
  const [stats, setStats] = useState({ activeContracts: 0, proposals: 0, earned: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get('/contracts', { params: { status: 'active' } }),
      api.get('/proposals'),
      api.get('/contracts', { params: { status: 'completed' } }),
    ])
      .then(([contractsRes, proposalsRes, completedRes]) => {
        if (cancelled) return;
        const contracts = ((contractsRes.data && contractsRes.data.contracts) || []);
        const proposals = ((proposalsRes.data && proposalsRes.data.proposals) || []);
        const completed = ((completedRes.data && completedRes.data.contracts) || []);
        const earned = completed.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);
        setStats({
          activeContracts: contracts.length,
          proposals: proposals.length,
          earned,
        });
        const mapped = proposals.slice(0, 5).map(p => ({
          id: p.id,
          title: p.job?.title || ('Proposal #' + p.id),
          company: p.job?.client?.username || 'Client',
          amount: fmtCurrency(p.bid_amount),
          status: p.status || 'pending',
        }));
        setRecent(mapped);
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.detail?.message || err.message || 'Failed to load dashboard');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Navbar activePage="dashboard" />

      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 4 }}>
              Welcome back, {user.username || user.name || 'Freelancer'} 👋
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
              Here's your freelancing activity and latest opportunities.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/freelancer/jobs')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            Browse Jobs
          </button>
        </div>

        {error ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⚠️</div>
            <h3>Failed to load dashboard</h3>
            <p>{error}</p>
            <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card accent-card">
              <div className="s-top">
                <span className="s-label">Status</span>
                <div className="s-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
              </div>
              <div className="s-val" style={{ fontSize: 20 }}>Available</div>
              <div className="s-sub" style={{ cursor: 'pointer' }} onClick={() => navigate('/freelancer/my-profile')}>Update in profile →</div>
            </div>
            <div className="stat-card">
              <div className="s-top">
                <span className="s-label">Active Contracts</span>
                <div className="s-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
              </div>
              <div className="s-val">{loading ? '…' : stats.activeContracts}</div>
              <div className="s-badge">In progress</div>
            </div>
            <div className="stat-card">
              <div className="s-top">
                <span className="s-label">Jobs Applied</span>
                <div className="s-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                </div>
              </div>
              <div className="s-val">{loading ? '…' : stats.proposals}</div>
              <div className="s-sub">Total applications</div>
            </div>
            <div className="stat-card">
              <div className="s-top">
                <span className="s-label">Total Earned</span>
                <div className="s-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                </div>
              </div>
              <div className="s-val">{loading ? '…' : fmtCurrency(stats.earned)}</div>
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>Via Escrow</div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="two-col">
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <h3>Active Contracts</h3>
                  <a className="view-all" href="/freelancer/my-contracts" onClick={(e) => { e.preventDefault(); navigate('/freelancer/my-contracts'); }}>View All</a>
                </div>
                <div className="card-body">
                  {stats.activeContracts ? (
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>You have {stats.activeContracts} active contract{stats.activeContracts === 1 ? '' : 's'}.</p>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                      No active contracts yet. <a href="/freelancer/jobs" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); navigate('/freelancer/jobs'); }}>Browse jobs →</a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-header">
                  <h3>Recent Applications</h3>
                  <a className="view-all" href="/freelancer/jobs" onClick={(e) => { e.preventDefault(); navigate('/freelancer/jobs'); }}>Browse Jobs</a>
                </div>
                <div className="card-body">
                  {recent.length ? (
                    <div>
                      {recent.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.company}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{item.amount}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                      No applications yet. Start applying to jobs.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
