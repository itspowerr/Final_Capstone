import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';
import '../../css/freelancer/dashboard.css';

/* ── helpers ── */
function fmtCurrency(n) {
  const v = Number(n || 0);
  if (!v) return '0 ETH';
  return v.toLocaleString() + ' ETH';
}

function getBadgeClass(status) {
  if (status === 'accepted') return 'badge badge-accepted';
  if (status === 'rejected') return 'badge badge-rejected';
  if (status === 'active')   return 'badge badge-active';
  return 'badge badge-pending';
}

export default function FreelancerDashboard() {
  const navigate = useNavigate();

  /* ── state ── */
  const [user,    setUser]    = useState({ name: '—' });
  const [stats,   setStats]   = useState({ activeContracts: 0, proposals: 0, earned: 0 });
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ── derived state ── */
  const [activeContracts, setActiveContracts] = useState([]);
  const [pendingCount,    setPendingCount]    = useState(0);

  /* ── data fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, proposalsRes, completedRes, userRes] = await Promise.all([
        api.get('/contracts', { params: { status: 'active' } }),
        api.get('/proposals'),
        api.get('/contracts', { params: { status: 'completed' } }),
        api.get('/users/me').catch(() => null)
      ]);

      const contracts  = (contractsRes.data?.contracts  || []);
      const proposals  = (proposalsRes.data?.proposals  || []);
      const completed  = (completedRes.data?.contracts  || []);
      const earned     = completed.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);

      setStats({ activeContracts: contracts.length, proposals: proposals.length, earned });
      setActiveContracts(contracts.slice(0, 4));
      setPendingCount(proposals.filter(p => p.status === 'pending').length);

      setRecent(
        proposals.slice(0, 5).map(p => ({
          id:      p.id,
          title:   p.job?.title || ('Proposal #' + p.id),
          company: p.job?.client?.username || 'Client',
          amount:  fmtCurrency(p.bid_amount),
          status:  p.status || 'pending',
        }))
      );

      if (userRes && userRes.data) {
        setUser(userRes.data);
        localStorage.setItem('user', JSON.stringify(userRes.data));
      } else {
        try {
          const raw = localStorage.getItem('user');
          if (raw) setUser(JSON.parse(raw));
        } catch { /* ignore */ }
      }
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const pollId = setInterval(fetchData, 30000);
    return () => clearInterval(pollId);
  }, [fetchData]);

  const isAvailable = user.is_available !== false;

  /* Profile completion logic */
  const checks = [
    { label: 'Add profile photo',    done: !!user.avatar_cid },
    { label: 'Write your bio',      done: !!user.bio },
    { label: 'List your skills',    done: !!(user.skills && user.skills.length) },
    { label: 'Set hourly rate',  done: !!(user.hourly_rate && user.hourly_rate > 0) },
    { label: 'Add a headline',   done: !!user.headline },
  ];
  const doneCount  = checks.filter(c => c.done).length;
  const completionPct = Math.round((doneCount / checks.length) * 100);

  return (
    <>
      <Navbar activePage="dashboard" />

      <div className="page-body">

        {/* Header Section */}
        <div className="page-header">
          <div>
            <h1>
              Welcome back, {user.username || user.name || 'Freelancer'}
            </h1>
            <p>Here's what's happening with your freelance business today.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/freelancer/jobs')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Find Work
          </button>
        </div>

        {error && (
          <div className="dash-card" style={{ marginBottom: 40 }}>
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h3 className="empty-title">Failed to load dashboard</h3>
              <p className="empty-desc">{error}</p>
              <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {!error && (
          <>
            {/* Metrics Grid */}
            <div className="metrics-grid">
              
              <div className="metric-card">
                <div className="metric-top">
                  <span className="metric-title">Available for work</span>
                  <div className="metric-icon green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                </div>
                <div className="metric-val">{isAvailable ? 'Yes' : 'No'}</div>
                <div>
                  <span className={`status-badge-inline ${isAvailable ? '' : 'busy'}`}>
                    {isAvailable ? 'Open to offers' : 'Busy right now'}
                  </span>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-top">
                  <span className="metric-title">Active Contracts</span>
                  <div className="metric-icon blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                </div>
                {loading ? <div className="skel" style={{height: 36, width: 60, marginBottom: 6}} /> : <div className="metric-val">{stats.activeContracts}</div>}
                <div className="metric-sub">Currently in progress</div>
              </div>

              <div className="metric-card">
                <div className="metric-top">
                  <span className="metric-title">Proposals Submitted</span>
                  <div className="metric-icon amber">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13"></path>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </div>
                </div>
                {loading ? <div className="skel" style={{height: 36, width: 60, marginBottom: 6}} /> : <div className="metric-val">{stats.proposals}</div>}
                <div className="metric-sub">
                  {loading ? '...' : `${pendingCount} awaiting response`}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-top">
                  <span className="metric-title">Total Earnings</span>
                  <div className="metric-icon navy">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                </div>
                {loading ? <div className="skel" style={{height: 36, width: 100, marginBottom: 6}} /> : <div className="metric-val">{fmtCurrency(stats.earned)}</div>}
                <div className="metric-sub">All time via escrow</div>
              </div>

            </div>

            {/* Main Content Grid */}
            {!loading && (
              <div className="content-grid">
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {/* Active Contracts */}
                  <div className="dash-card">
                    <div className="dash-card-header">
                      <h3 className="dash-card-title">Active Contracts</h3>
                      <a className="view-all-link" href="/freelancer/contracts" onClick={(e) => { e.preventDefault(); navigate('/freelancer/contracts'); }}>
                        View all
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div>
                      {activeContracts.length > 0 ? (
                        <div className="list-container">
                          {activeContracts.map((c, i) => {
                            const milestones = c.milestones || [];
                            const total = milestones.length || 1;
                            const done = milestones.filter(m => m.status === 'approved' || m.status === 'paid').length;
                            const pct = Math.round((done / total) * 100);
                            
                            return (
                              <div key={c.id} className="list-item">
                                <div className="item-left">
                                  <div className="item-title">{c.title || `Contract #${c.id}`}</div>
                                  <div className="item-subtitle">Client: {c.client?.username || `User ${c.client_id?.slice(0,6) || ''}`}</div>
                                  <div className="progress-wrap">
                                    <div className="progress-bar">
                                      <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                                    </div>
                                    <span className="progress-text">{pct}%</span>
                                  </div>
                                </div>
                                <div className="item-right">
                                  <div className="item-amount">{fmtCurrency(c.total_amount)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                          </div>
                          <h4 className="empty-title">No active contracts</h4>
                          <p className="empty-desc">You don't have any ongoing work at the moment. Browse available jobs to get started.</p>
                          <button className="btn btn-outline" onClick={() => navigate('/freelancer/jobs')}>
                            Browse Jobs
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Proposals */}
                  <div className="dash-card">
                    <div className="dash-card-header">
                      <h3 className="dash-card-title">Recent Proposals</h3>
                      <a className="view-all-link" href="/freelancer/jobs" onClick={(e) => { e.preventDefault(); navigate('/freelancer/jobs'); }}>
                        Find more
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div>
                      {recent.length > 0 ? (
                        <div className="list-container">
                          {recent.map(item => (
                            <div key={item.id} className="list-item">
                              <div className="item-left">
                                <div className="item-title">{item.title}</div>
                                <div className="item-subtitle">{item.company}</div>
                              </div>
                              <div className="item-right">
                                <div className="item-amount">{item.amount}</div>
                                <div className={getBadgeClass(item.status)}>{item.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"></line>
                              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                          </div>
                          <h4 className="empty-title">No proposals yet</h4>
                          <p className="empty-desc">Submit proposals to jobs that match your skills.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {/* Profile Completion */}
                  <div className="dash-card">
                    <div className="dash-card-header" style={{marginBottom: 16}}>
                      <h3 className="dash-card-title">Profile Setup</h3>
                      <a className="view-all-link" href="/freelancer/my-profile" onClick={(e) => { e.preventDefault(); navigate('/freelancer/my-profile'); }}>
                        Edit
                      </a>
                    </div>
                    <div className="profile-setup">
                      <div className="setup-header">
                        <span className="setup-title">Completeness</span>
                        <span className="setup-pct">{completionPct}%</span>
                      </div>
                      <div className="setup-track">
                        <div className="setup-fill" style={{ width: `${completionPct}%` }}></div>
                      </div>
                      <div className="setup-steps">
                        {checks.map(c => (
                          <div key={c.label} className={`setup-step ${c.done ? 'done' : ''}`}>
                            <div className={`step-icon ${c.done ? 'done' : 'pending'}`}>
                              {c.done ? '✓' : ''}
                            </div>
                            {c.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Shortcuts */}
                  <div className="dash-card">
                    <div className="dash-card-header">
                      <h3 className="dash-card-title">Shortcuts</h3>
                    </div>
                    <div className="shortcut-grid">
                      <a className="shortcut-card" href="/freelancer/messages" onClick={(e) => { e.preventDefault(); navigate('/freelancer/messages'); }}>
                        <div className="shortcut-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                        <div className="shortcut-title">Messages</div>
                      </a>
                      <a className="shortcut-card" href="/freelancer/my-profile" onClick={(e) => { e.preventDefault(); navigate('/freelancer/my-profile'); }}>
                        <div className="shortcut-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                        </div>
                        <div className="shortcut-title">My Profile</div>
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
