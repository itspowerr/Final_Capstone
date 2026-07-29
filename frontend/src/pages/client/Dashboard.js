import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/client/Navbar';
import PostProjectModal from '../../components/shared/PostProjectModal';
import { SkeletonStatCard, SkeletonCard } from '../../components/shared/Skeleton';
import api from '../../services/api';
import '../../css/client/dashboard.css';

const MILESTONE_STATUS_MAP = {
  pending: 'pending', in_progress: 'active', submitted: 'submitted', approved: 'done', rejected: 'pending', paid: 'done',
};

function formatContract(raw) {
  const ms = (raw.milestones || []).map(m => ({
    status: MILESTONE_STATUS_MAP[m.status] || 'pending',
  }));
  const doneMs = ms.filter(m => m.status === 'done').length;
  return {
    ...raw,
    progress: ms.length ? Math.round((doneMs / ms.length) * 100) : 0,
    doneMs,
    totalMs: ms.length,
  };
}

export default function ClientDashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [stats, setStats] = useState({ active: 0, applied: 0, budget: 0 });
  const [contracts, setContracts] = useState([]);
  const [appliedFl, setAppliedFl] = useState({ freelancers: [], total: 0, page: 1 });
  const [contractSummary, setContractSummary] = useState({ signed: 0, pending: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id;

  useEffect(() => {
    if (!guideOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setGuideOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [guideOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, proposalsRes] = await Promise.all([
        api.get('/contracts'),
        api.get(`/proposals?client_id=${userId}`).catch(() => null),
      ]);

      const allContracts = (contractsRes.data?.contracts || []).map(formatContract);
      const proposals = proposalsRes?.data?.proposals || [];

      setContracts(allContracts);

      setStats({
        active: allContracts.filter(c => c.status === 'active' || c.status === 'in_progress').length,
        applied: proposals.length,
        budget: allContracts.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0),
      });

      const signedC = allContracts.filter(c => c.status === 'active' || c.status === 'completed').length;
      const pendingC = allContracts.filter(c => c.status === 'pending_signatures').length;
      const archivedC = allContracts.filter(c => c.status === 'cancelled' || c.status === 'completed').length;
      setContractSummary({ signed: signedC, pending: pendingC, archived: archivedC });

      const freelancerIds = [...new Set(proposals.map(p => p.freelancer_id))];
      const freelancerData = freelancerIds.length > 0
        ? await api.get(`/users?ids=${freelancerIds.join(',')}&role=freelancer`).catch(() => null)
        : null;
      const freelancerMap = {};
      if (freelancerData?.data?.users) {
        for (const f of freelancerData.data.users) {
          freelancerMap[f.id] = f;
        }
      }
      const applied = proposals.map(p => {
        const f = freelancerMap[p.freelancer_id] || {};
        return {
          id: p.freelancer_id,
          proposalId: p.id,
          name: f.username || f.email || p.freelancer_id.slice(0, 8),
          role: (f.skills && f.skills.length > 0 ? f.skills[0] : 'Freelancer'),
          rating: f.rating || '—',
          proposal: p,
        };
      });
      setAppliedFl({ freelancers: applied, total: applied.length, page: 1 });
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.message || 'Failed to load dashboard';
      setError(typeof msg === 'string' ? msg : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchData();
    const pollId = setInterval(fetchData, 30000);
    return () => clearInterval(pollId);
  }, [userId, fetchData]);

  const exportReport = () => {
    const rows = [
      ['Report', 'Value'],
      ['Active Projects', stats.active],
      ['Freelancers Applied', stats.applied],
      ['Total Budget Locked (ETH)', stats.budget.toFixed(4)],
      ['Signed Contracts', contractSummary.signed],
      ['Pending Signatures', contractSummary.pending],
      ['Archived', contractSummary.archived],
      [],
      ['Contracts', 'Status', 'Progress'],
      ...contracts.map(c => [
        c.title || c.job_title || 'Untitled',
        c.status?.replace(/_/g, ' ') || '',
        `${c.doneMs || 0}/${c.totalMs || 0} (${c.progress || 0}%)`,
      ]),
      [],
      ['Freelancer', 'Role', 'Bid (ETH)', 'Status'],
      ...appliedFl.freelancers.map(f => [
        f.name,
        f.role,
        f.proposal?.bid_amount?.toLocaleString() || '',
        f.proposal?.status || '',
      ]),
    ];

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [acceptingId, setAcceptingId] = useState(null);

  const acceptProposal = async (proposalId) => {
    if (!window.confirm('Accept this freelancer? This will assign them to your contract and reject other pending applications.')) return;
    setAcceptingId(proposalId);
    try {
      await api.post(`/proposals/${proposalId}/accept`);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.message || 'Failed to accept proposal';
      setError(typeof msg === 'string' ? msg : 'Failed to accept proposal');
    } finally {
      setAcceptingId(null);
    }
  };

  const activeProjects = contracts.filter(c => c.status === 'active' || c.status === 'in_progress' || c.status === 'pending_signatures');

  if (loading) {
    return (
      <>
        <Navbar activePage="dashboard" />
        <div className="dash-body">
          <div className="stats-grid">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
            <SkeletonCard rows={4} />
            <SkeletonCard rows={4} />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar activePage="dashboard" />
        <div className="dash-body"><p style={{ textAlign: 'center', padding: 48, color: '#f04438' }}>{error}</p></div>
      </>
    );
  }

  return (
    <>
      <Navbar activePage="dashboard" />
      <div className="dash-body">
        <div className="dash-header">
          <div className="dash-greeting">
            <h1>Welcome back, {user.username || user.email || 'User'}</h1>
            <p>Manage your active projects and talent pool.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="session-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              Session Active
            </div>
            <button className="btn btn-outline btn-sm" onClick={exportReport}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Export Report
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card accent-card" onClick={() => setModalOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="s-top">
              <span className="s-label">New</span>
              <div className="s-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
              </div>
            </div>
            <div className="s-val">New</div>
            <div className="s-sub">Post a project</div>
          </div>
          <div className="stat-card">
            <div className="s-top">
              <span className="s-label">Active Projects</span>
              <div className="s-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--landing-blue)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
            </div>
            <div className="s-val">{stats.active}</div>
            <div className="s-badge">{stats.active > 0 ? `${stats.active} Active` : 'No active'}</div>
          </div>
          <div className="stat-card">
            <div className="s-top">
              <span className="s-label">Freelancers Applied</span>
              <div className="s-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--landing-blue)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              </div>
            </div>
            <div className="s-val">{stats.applied}</div>
            <div style={{ fontSize: 12, color: 'var(--landing-muted)', marginTop: 4 }}>{stats.applied > 0 ? `${stats.applied} applicant${stats.applied > 1 ? 's' : ''}` : 'No applicants yet'}</div>
          </div>
          <div className="stat-card">
            <div className="s-top">
              <span className="s-label">Total Budget Locked</span>
              <div className="s-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--landing-blue)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              </div>
            </div>
            <div className="s-val">{stats.budget.toLocaleString()} ETH</div>
            <div style={{ fontSize: 12, color: 'var(--landing-green)', marginTop: 4, fontWeight: 600 }}>Escrow Active</div>
          </div>
        </div>

        <div className="dash-grid">
          <div>
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <div className="dash-card-header">
                <h3>Active Project Progress</h3>
                <a className="view-all" href="/client/my-contracts">View All</a>
              </div>
              <div className="dash-card-body">
                {activeProjects.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: 24, color: 'var(--landing-muted)' }}>No active projects yet. Post your first project to get started!</p>
                ) : (
                  activeProjects.slice(0, 5).map((c, i) => (
                    <div className="project-row" key={i}>
                      <div className="project-row-top">
                        <span className="project-name">{c.title || c.job_title || 'Untitled'}</span>
                        <span className="project-pct">{c.doneMs || 0}/{c.totalMs || 0}</span>
                      </div>
                      <div className="milestone-label">Status: {c.status?.replace(/_/g, ' ')}</div>
                      <div className="prog-bar"><div className="prog-fill" style={{ width: `${c.progress || 0}%` }}></div></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-header" style={{ marginBottom: 0 }}>
                <h3>Contract Status Summary</h3>
              </div>
              <div className="contract-summary">
                <div className="cs-box green"><div className="cs-val">{contractSummary.signed}</div><div className="cs-label">Signed</div></div>
                <div className="cs-box amber"><div className="cs-val">{contractSummary.pending}</div><div className="cs-label">Pending Signature</div></div>
                <div className="cs-box gray"><div className="cs-val">{contractSummary.archived}</div><div className="cs-label">Archived</div></div>
              </div>
            </div>
          </div>

          <div>
            <div className="dash-card">
              <div className="dash-card-header">
                <h3>Applied Freelancers <span style={{ fontSize: 12, color: 'var(--landing-muted)', fontWeight: 400 }}>({appliedFl.total})</span></h3>
              </div>
              <div className="dash-card-body">
                {appliedFl.freelancers.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: 24, color: 'var(--landing-muted)' }}>Waiting for freelancers to apply to your projects.</p>
                ) : (
                  <>
                    {appliedFl.freelancers.slice(0, 5).map((f, i) => (
                      <div className="freelancer-item" key={i}>
                        <div className="fl-left">
                          <div className="fl-avatar" style={{ background: 'linear-gradient(135deg,var(--landing-blue),var(--landing-blue-dark))' }}>{f.name.charAt(0).toUpperCase()}</div>
                          <div className="fl-info"><div className="fl-name">{f.name}</div><div className="fl-role">{f.role}</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div className="fl-rating">{f.proposal?.bid_amount ? f.proposal.bid_amount.toLocaleString() + ' ETH' : '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--landing-muted)' }}>{f.proposal?.status === 'accepted' ? 'Accepted' : f.proposal?.status === 'rejected' ? 'Rejected' : 'Pending'}</div>
                          </div>
                          {f.proposal?.status === 'pending' ? (
                            <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} disabled={acceptingId === f.proposalId} onClick={async (e) => { e.stopPropagation(); await acceptProposal(f.proposalId); }}>
                              {acceptingId === f.proposalId ? '…' : 'Hire'}
                            </button>
                          ) : (
                            <div className="fl-arrow">›</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {appliedFl.total > 5 && (
                      <button className="btn btn-outline btn-full btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/client/my-contracts'}>
                        View All ({appliedFl.total})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="hire-card">
              <div className="hc-icon">💡</div>
              <h4>Hire Smarter</h4>
              <p>Clients who use our Escrow feature report 40% higher satisfaction on first-time hires.</p>
              <button className="btn-hire" onClick={() => setGuideOpen(true)}>Read Guide →</button>
            </div>
          </div>
        </div>
      </div>

      <PostProjectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {guideOpen && (
        <div className="guide-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setGuideOpen(false); }}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="hire-guide-title">
            <div className="guide-modal-accent" />
            <button type="button" className="guide-close" aria-label="Close hiring guide" onClick={() => setGuideOpen(false)}>×</button>
            <div className="guide-heading">
              <span className="guide-kicker">FreeLedger playbook</span>
              <h2 id="hire-guide-title">Hire smarter with protected milestones</h2>
              <p>Turn a good brief into a secure contract without slowing down your project.</p>
            </div>

            <div className="guide-steps">
              <article className="guide-step">
                <span>01</span>
                <div><h3>Write a focused brief</h3><p>Define the outcome, required skills, budget, and a realistic delivery window.</p></div>
              </article>
              <article className="guide-step">
                <span>02</span>
                <div><h3>Compare more than price</h3><p>Review relevant work, on-chain reputation, communication, and proposal clarity.</p></div>
              </article>
              <article className="guide-step">
                <span>03</span>
                <div><h3>Fund clear milestones</h3><p>Break delivery into measurable stages and place funds in escrow before work begins.</p></div>
              </article>
              <article className="guide-step">
                <span>04</span>
                <div><h3>Review and release</h3><p>Approve completed work promptly, request specific revisions, and release each payment securely.</p></div>
              </article>
            </div>

            <div className="guide-tip">
              <span>💡</span>
              <p><strong>Pro tip:</strong> Smaller, outcome-based milestones reduce risk for both sides and make progress easier to verify.</p>
            </div>
            <div className="guide-actions">
              <button type="button" className="btn btn-outline" onClick={() => setGuideOpen(false)}>Close guide</button>
              <button type="button" className="btn btn-primary" onClick={() => { setGuideOpen(false); setModalOpen(true); }}>Post a project</button>
            </div>
          </section>
        </div>
      )}

      <div className="toast" id="toast">
        <span className="toast-icon">✅</span>
        <span id="toast-msg">Done!</span>
      </div>
    </>
  );
}
