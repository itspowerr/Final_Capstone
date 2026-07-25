import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';
import '../../css/freelancer/dashboard.css';

function fmtCurrency(n) {
  const v = Number(n || 0);
  if (!v) return '0 ETH';
  return v.toLocaleString() + ' ETH';
}

function getSavedProfile() {
  try { return JSON.parse(localStorage.getItem('fl_freelancer_profile') || '{}'); } catch { return {}; }
}

function calculateProfileCompletion(profile, walletAddress) {
  const checks = [
    Boolean(profile.fullName || profile.username),
    Boolean(profile.title || profile.headline),
    Boolean(profile.bio),
    Array.isArray(profile.skills) && profile.skills.length > 0,
    Boolean(profile.hourlyRate || profile.hourly_rate),
    Boolean(profile.location),
    Boolean(profile.github || profile.portfolio || profile.linkedin),
    Boolean(walletAddress || profile.wallet || profile.wallet_address),
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}


function DashboardIcon({ type, className = '' }) {
  const icons = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    briefcase: <><path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" /><path d="M4.5 8.5h15v9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" /><path d="M4.5 12h15" /></>,
    send: <><path d="M20 4 9.5 14.5" /><path d="m20 4-6.5 17-4-6.5L3 10.5 20 4Z" /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Z" /><path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" /><path d="M7 8h10" /></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
    message: <><path d="M5 6.5h14v9H9l-4 3v-12Z" /><path d="M8 10h8" /><path d="M8 13h5" /></>,
    doc: <><path d="M7 4h7l4 4v12H7V4Z" /><path d="M14 4v5h5" /><path d="M9 13h6" /><path d="M9 16h4" /></>,
  };
  return <span className={`real-dashboard-icon ${type} ${className}`} aria-hidden="true"><svg viewBox="0 0 24 24">{icons[type] || icons.user}</svg></span>;
}
function availabilityLabel(value) {
  if (value === 'busy') return 'Busy';
  if (value === 'part') return 'Part-time';
  return 'Available';
}

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: '-' });
  const [profile, setProfile] = useState(getSavedProfile());
  const [stats, setStats] = useState({ activeContracts: 0, proposals: 0, earned: 0 });
  const [activeContracts, setActiveContracts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      api.get('/contracts'),
      api.get('/proposals'),
      api.get('/users/me'),
    ])
      .then((results) => {
        if (cancelled) return;
        const contractsRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const proposalsRes = results[1].status === 'fulfilled' ? results[1].value : null;
        const profileRes = results[2].status === 'fulfilled' ? results[2].value : null;

        const contracts = contractsRes?.data?.contracts || [];
        const proposals = proposalsRes?.data?.proposals || [];
        const active = contracts.filter(c => c.status === 'active' || c.status === 'in_progress');
        const completed = contracts.filter(c => c.status === 'completed' || c.status === 'delivered');
        const earned = completed.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);

        setActiveContracts(active.slice(0, 3));
        setStats({ activeContracts: active.length, proposals: proposals.length, earned });

        const savedProfile = getSavedProfile();
        if (profileRes?.data) {
          const apiProfile = {
            ...savedProfile,
            fullName: profileRes.data.username || savedProfile.fullName || '',
            username: profileRes.data.username || savedProfile.username || '',
            title: profileRes.data.headline || savedProfile.title || '',
            headline: profileRes.data.headline || savedProfile.headline || '',
            bio: profileRes.data.bio || savedProfile.bio || '',
            location: profileRes.data.location || savedProfile.location || '',
            github: profileRes.data.github || savedProfile.github || '',
            portfolio: profileRes.data.portfolio || savedProfile.portfolio || '',
            linkedin: profileRes.data.linkedin || savedProfile.linkedin || '',
            skills: profileRes.data.skills || savedProfile.skills || [],
            hourlyRate: profileRes.data.hourly_rate || savedProfile.hourlyRate || '',
            hourly_rate: profileRes.data.hourly_rate || savedProfile.hourly_rate || '',
            experience: profileRes.data.experience_level || savedProfile.experience || 'mid',
            availability: profileRes.data.is_available === false ? 'busy' : (savedProfile.availability || 'available'),
            wallet: profileRes.data.wallet_address || savedProfile.wallet || '',
            wallet_address: profileRes.data.wallet_address || savedProfile.wallet_address || '',
          };
          setProfile(apiProfile);
          localStorage.setItem('fl_freelancer_profile', JSON.stringify(apiProfile));
        } else {
          setProfile(savedProfile);
        }

        const proposalActivity = proposals.slice(0, 3).map(p => ({
          id: `proposal-${p.id}`,
          title: p.status === 'accepted' ? 'Proposal accepted' : 'Application sent',
          description: p.job?.title || p.job_title || 'You applied to a project',
          time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recently',
          active: p.status === 'pending',
        }));
        const contractActivity = active.slice(0, 2).map(c => ({
          id: `contract-${c.id}`,
          title: 'Contract active',
          description: c.title || c.job_title || 'A client contract is in progress',
          time: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : 'Recently',
          active: true,
        }));
        setRecent([
          ...contractActivity,
          ...proposalActivity,
          { id: 'profile', title: 'Profile setup', description: 'Complete your profile to stand out', time: 'Now', active: false },
          { id: 'joined', title: 'Joined as freelancer', description: 'Your freelancer account is ready', time: 'Ready', active: false },
        ].slice(0, 5));

        if (contractsRes === null && proposalsRes === null) {
          setError('Failed to load dashboard');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore malformed local session data
    }
    return () => { cancelled = true; };
  }, []);

  const completion = useMemo(() => calculateProfileCompletion(profile, profile.wallet || profile.wallet_address), [profile]);
  const displayName = user.username || user.name || profile.fullName || profile.username || 'Freelancer';
  const availability = availabilityLabel(profile.availability);
  const needsProfile = completion < 100;

  const quickActions = [
    { label: 'Browse Jobs', hint: 'Find open projects', path: '/freelancer/jobs', icon: 'search' },
    { label: 'Update Profile', hint: 'Improve visibility', path: '/freelancer/my-profile', icon: 'user' },
    { label: 'My Contracts', hint: 'Submit work', path: '/freelancer/contracts', icon: 'briefcase' },
    { label: 'Messages', hint: 'Client conversations', path: '/freelancer/messages', icon: 'message' },
  ];

  return (
    <>
      <Navbar activePage="dashboard" />
      <div className="freelancer-dashboard">
        <div className="freelancer-main-grid">
          <div className="freelancer-left-column">
            <section className="freelancer-hero-card">
              <div className="hero-copy">
                <span className="hero-kicker">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'},</span>
                <h1>Welcome back, {displayName}</h1>
                <p>Here's what's happening with your freelance journey.</p>
                <div className="availability-pill">
                  <span className={`availability-dot ${profile.availability === 'busy' ? 'busy' : profile.availability === 'part' ? 'part' : ''}`} />
                  <strong>{availability}</strong>
                  <button onClick={() => navigate('/freelancer/my-profile')}>Update status</button>
                </div>
              </div>
              <div className="hero-illustration" aria-hidden="true">
                <div className="hero-window">
                  <span /><span /><span />
                  <div className="hero-search" />
                  <div className="hero-bars"><i /><i /><i /><i /></div>
                </div>
                <div className="hero-wallet" />
              </div>
            </section>

            {error ? (
              <div className="dashboard-alert">
                <strong>Could not refresh all dashboard data.</strong>
                <span>{error}</span>
                <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>Retry</button>
              </div>
            ) : null}

            <section className="freelancer-stats-row">
              <button className="freelancer-stat-card status" onClick={() => navigate('/freelancer/my-profile')}>
                <DashboardIcon type="user" className="stat-icon" />
                <div><span>Status</span><strong>{availability}</strong><small>Ready for opportunities</small><em>{profile.availability === 'busy' ? 'Busy' : 'Online'}</em></div>
              </button>
              <button className="freelancer-stat-card" onClick={() => navigate('/freelancer/contracts')}>
                <DashboardIcon type="briefcase" className="stat-icon" />
                <div><span>Active Contracts</span><strong>{loading ? '...' : stats.activeContracts}</strong><small>{stats.activeContracts ? 'In progress' : 'No active projects'}</small><em>View all -&gt;</em></div>
              </button>
              <button className="freelancer-stat-card" onClick={() => navigate('/freelancer/jobs')}>
                <DashboardIcon type="send" className="stat-icon" />
                <div><span>Applications</span><strong>{loading ? '...' : stats.proposals}</strong><small>{stats.proposals ? 'Submitted proposals' : 'No applications yet'}</small><em>Browse jobs -&gt;</em></div>
              </button>
              <button className="freelancer-stat-card" onClick={() => navigate('/freelancer/contracts')}>
                <DashboardIcon type="wallet" className="stat-icon" />
                <div><span>Total Earned</span><strong>{loading ? '...' : fmtCurrency(stats.earned)}</strong><small>Via Escrow</small><em>View earnings -&gt;</em></div>
              </button>
            </section>

            <section className="dashboard-panel active-contracts-panel">
              <div className="panel-head"><h3>Active Contracts</h3><button onClick={() => navigate('/freelancer/contracts')}>View All</button></div>
              {activeContracts.length ? (
                <div className="contract-list-mini">
                  {activeContracts.map(contract => (
                    <button key={contract.id} onClick={() => navigate('/freelancer/contracts')}>
                      <span>{contract.title || contract.job_title || 'Untitled contract'}</span>
                      <strong>{fmtCurrency(contract.total_amount)}</strong>
                      <small>{contract.status?.replace(/_/g, ' ') || 'active'}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty"><DashboardIcon type="briefcase" className="empty-graphic" /><h4>No active contracts yet</h4><p>Once you start working on projects, your active contracts will appear here.</p><button className="btn btn-outline btn-sm" onClick={() => navigate('/freelancer/jobs')}>Browse Jobs</button></div>
              )}
            </section>

            <section className="dashboard-panel applications-panel">
              <div className="panel-head"><h3>Recent Applications</h3><button onClick={() => navigate('/freelancer/jobs')}>Browse Jobs</button></div>
              {recent.filter(item => item.id.startsWith('proposal')).length ? (
                <div className="application-list-mini">
                  {recent.filter(item => item.id.startsWith('proposal')).map(item => (
                    <div key={item.id}><span>{item.title}</span><p>{item.description}</p><small>{item.time}</small></div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty"><DashboardIcon type="doc" className="empty-graphic" /><h4>No applications yet</h4><p>You haven't applied to any jobs yet. Find exciting opportunities and start applying.</p><button className="btn btn-outline btn-sm" onClick={() => navigate('/freelancer/jobs')}>Browse Jobs</button></div>
              )}
            </section>

            <section className="tip-card">
              <div className="tip-icon">{'\u2605'}</div>
              <div><h4>Tip of the day</h4><p>Complete your profile and add skills to increase your chances of getting hired.</p></div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/freelancer/my-profile')}>Complete Profile</button>
            </section>
          </div>

          <div className="freelancer-side-column">
            <aside className="profile-completion-card">
              <h3>Profile Completion</h3>
              <div className="completion-row">
                <div className="completion-ring" style={{ '--pct': completion }}>
                  <span>{completion}%</span>
                </div>
                <div>
                  <h4>{needsProfile ? 'Almost there!' : 'Profile complete'}</h4>
                  <p>{needsProfile ? 'Complete your profile to get more job invitations.' : 'Your profile is fully complete and visible to clients.'}</p>
                </div>
              </div>
              {!needsProfile && (
                <div className="profile-complete-message">
                  <span>{'\u2713'}</span>
                  <div>
                    <strong>Profile is complete</strong>
                    <small>You are ready to receive better job matches and invitations.</small>
                  </div>
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={() => navigate('/freelancer/my-profile')}>
                {needsProfile ? 'Complete Profile -&gt;' : 'View Profile -&gt;'}
              </button>
            </aside>

            <aside className="quick-actions-card">
              <h3>Quick Actions</h3>
              <div className="quick-action-list">
                {quickActions.map(action => (
                  <button key={action.label} onClick={() => navigate(action.path)}>
                    <DashboardIcon type={action.icon} className="qa-icon" />
                    <div><strong>{action.label}</strong><small>{action.hint}</small></div>
                    <em>{'\u203A'}</em>
                  </button>
                ))}
              </div>
            </aside>

            <aside className="recent-activity-card">
              <div className="panel-head"><h3>Recent Activity</h3><button onClick={() => navigate('/freelancer/contracts')}>View All</button></div>
              <div className="activity-timeline">
                {recent.map((item, index) => (
                  <div key={item.id} className="activity-item">
                    <span className={index === 0 || item.active ? 'active' : ''} />
                    <div><strong>{item.title}</strong><p>{item.description}</p></div>
                    <small>{item.time}</small>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
