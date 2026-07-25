import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/client/Navbar';
import PostProjectModal from '../../components/shared/PostProjectModal';
import api from '../../services/api';
import '../../css/client/dashboard.css';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [stats, setStats] = useState({ active: 0, applied: 0, budget: 0 });
  const [contracts, setContracts] = useState([]);
  const [appliedFl, setAppliedFl] = useState({ freelancers: [], total: 0, page: 1 });
  const [contractSummary, setContractSummary] = useState({ signed: 0, pending: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, proposalsRes] = await Promise.all([
        api.get('/contracts'),
        api.get(`/proposals?client_id=${userId}`).catch(() => null),
      ]);

      const allContracts = contractsRes.data?.contracts || [];
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
        for (const f of freelancerData.data.users) freelancerMap[f.id] = f;
      }
      const applied = proposals.map(p => {
        const f = freelancerMap[p.freelancer_id] || {};
        return {
          id: p.freelancer_id,
          proposalId: p.id,
          name: f.username || f.email || p.freelancer_id.slice(0, 8),
          role: (f.skills && f.skills.length > 0 ? f.skills[0] : 'Freelancer'),
          rating: f.rating || '-',
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
  }, [userId, fetchData]);

  const showToast = (message) => {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2400);
  };

  const exportReport = () => {
    const safe = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['FreeLedger Client Dashboard Report'],
      ['Generated', new Date().toLocaleString()],
      ['Client', user.username || user.email || 'Client'],
      [],
      ['Summary'],
      ['Active Projects', stats.active],
      ['Freelancers Applied', stats.applied],
      ['Total Budget Locked', `${stats.budget.toLocaleString()} ETH`],
      ['Signed Contracts', contractSummary.signed],
      ['Pending Signatures', contractSummary.pending],
      ['Archived Contracts', contractSummary.archived],
      [],
      ['Contracts'],
      ['Title', 'Status', 'Amount ETH', 'Milestones Completed', 'Milestones Total'],
      ...contracts.map((contract) => [
        contract.title || contract.job_title || 'Untitled',
        contract.status || 'unknown',
        contract.total_amount || 0,
        contract.milestones_completed || 0,
        contract.milestones_total || 0,
      ]),
      [],
      ['Applied Freelancers'],
      ['Name', 'Role', 'Bid ETH', 'Proposal Status'],
      ...appliedFl.freelancers.map((freelancer) => [
        freelancer.name,
        freelancer.role,
        freelancer.proposal?.bid_amount || '',
        freelancer.proposal?.status || 'pending',
      ]),
    ];
    const csv = rows.map((row) => row.map(safe).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `freeledger-client-report-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported');
  };

  const acceptProposal = async (proposalId) => {
    if (!window.confirm('Accept this freelancer? This will assign them to your contract and reject other pending applications.')) return;
    setAcceptingId(proposalId);
    try {
      await api.post(`/proposals/${proposalId}/accept`);
      await fetchData();
      showToast('Freelancer hired');
    } catch (err) {
      const msg = err.response?.data?.detail?.message || err.message || 'Failed to accept proposal';
      setError(typeof msg === 'string' ? msg : 'Failed to accept proposal');
    } finally {
      setAcceptingId(null);
    }
  };

  const activeProjects = contracts.filter(c => c.status === 'active' || c.status === 'in_progress' || c.status === 'pending_signatures');

  const scrollToAppliedFreelancers = () => {
    document.getElementById('applied-freelancers-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <>
        <Navbar activePage="dashboard" />
        <div className="dash-body"><p className="dash-state">Loading dashboard...</p></div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar activePage="dashboard" />
        <div className="dash-body"><p className="dash-state dash-state-error">{error}</p></div>
      </>
    );
  }

  return (
    <>
      <Navbar activePage="dashboard" />
      <div className="dash-body">
        <div className="dash-header">
          <div className="dash-greeting">
            <span className="dash-eyebrow">Client workspace</span>
            <h1>Welcome back, {user.username || user.email || 'User'}</h1>
            <p>Track projects, proposals, contracts, and escrow activity from one calmer place.</p>
          </div>
          <div className="dash-header-actions">
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
              <span className="s-label">Create</span>
              <div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2"><path d="M12 5v14M5 12l7-7 7 7" /></svg></div>
            </div>
            <div className="s-val">New</div>
            <div className="s-sub">Post a project</div>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Active Projects</span><div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div></div>
            <div className="s-val">{stats.active}</div>
            <div className="s-badge">{stats.active > 0 ? `${stats.active} Active` : 'No active'}</div>
            <button type="button" className="stat-link" onClick={() => navigate('/client/my-contracts')}>View all projects -&gt;</button>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Freelancers Applied</span><div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg></div></div>
            <div className="s-val">{stats.applied}</div>
            <div className="s-sub muted">{stats.applied > 0 ? `${stats.applied} applicant${stats.applied > 1 ? 's' : ''}` : 'No applicants yet'}</div>
            <button type="button" className="stat-link" onClick={scrollToAppliedFreelancers}>View all proposals -&gt;</button>
          </div>
          <div className="stat-card">
            <div className="s-top"><span className="s-label">Total Budget Locked</span><div className="s-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
            <div className="s-val">{stats.budget.toLocaleString()} ETH</div>
            <div className="s-sub green-text">Escrow Active</div>
            <button type="button" className="stat-link" onClick={() => navigate('/client/my-contracts')}>View escrow -&gt;</button>
          </div>
        </div>

        <div className="dash-grid">
          <div className="dash-column">
            <div className="dash-card">
              <div className="dash-card-header">
                <h3>Active Project Progress</h3>
                <a className="view-all" href="/client/my-contracts">View All</a>
              </div>
              <div className="dash-card-body">
                {activeProjects.length === 0 ? (
                  <div className="empty-state rich-empty"><div className="empty-icon svg-empty-icon folder-svg" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.4l2 2h6.6a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" /></svg></div><h4>No active projects yet</h4><p>Post your first project to get started.</p><button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>+ Post New Project</button></div>
                ) : (
                  activeProjects.slice(0, 5).map((c, i) => (
                    <div className="project-row" key={i}>
                      <div className="project-row-top">
                        <span className="project-name">{c.title || c.job_title || 'Untitled'}</span>
                        <span className="project-pct">{c.milestones_completed || 0}/{c.milestones_total || 0}</span>
                      </div>
                      <div className="milestone-label">Status: {c.status?.replace(/_/g, ' ')}</div>
                      <div className="prog-bar"><div className="prog-fill" style={{ width: `${c.milestones_total ? ((c.milestones_completed || 0) / c.milestones_total) * 100 : 0}%` }} /></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-header"><h3>Contract Status Summary</h3></div>
              <div className="contract-summary">
                <div className="cs-box green"><div className="cs-val">{contractSummary.signed}</div><div className="cs-label">Signed</div><small>Contracts fully signed</small></div>
                <div className="cs-box amber"><div className="cs-val">{contractSummary.pending}</div><div className="cs-label">Pending Signature</div><small>Waiting for signature</small></div>
                <div className="cs-box gray"><div className="cs-val">{contractSummary.archived}</div><div className="cs-label">Archived</div><small>Completed/closed</small></div>
              </div>
            </div>
          </div>

          <div className="dash-column">
            <div className="dash-card" id="applied-freelancers-panel">
              <div className="dash-card-header">
                <h3>Applied Freelancers <span>({appliedFl.total})</span></h3>
              </div>
              <div className="dash-card-body">
                {appliedFl.freelancers.length === 0 ? (
                  <div className="empty-state rich-empty applied-empty"><div className="empty-icon svg-empty-icon single-user-svg" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg></div><h4>No applications yet</h4><p>Once freelancers apply to your projects, they will appear here.</p><button className="btn btn-outline btn-sm empty-action" onClick={() => window.location.href = '/client/browse-freelancers'}>Browse Freelancers <span aria-hidden="true">-></span></button></div>
                ) : (
                  <>
                    {appliedFl.freelancers.slice(0, 5).map((f, i) => (
                      <div className="freelancer-item" key={i}>
                        <div className="fl-left">
                          <div className="fl-avatar">{f.name.charAt(0).toUpperCase()}</div>
                          <div className="fl-info"><div className="fl-name">{f.name}</div><div className="fl-role">{f.role}</div></div>
                        </div>
                        <div className="fl-actions">
                          <div className="fl-bid"><div className="fl-rating">{f.proposal?.bid_amount ? f.proposal.bid_amount.toLocaleString() + ' ETH' : '-'}</div><div>{f.proposal?.status === 'accepted' ? 'Accepted' : f.proposal?.status === 'rejected' ? 'Rejected' : 'Pending'}</div></div>
                          {f.proposal?.status === 'pending' ? (
                            <button className="btn btn-primary btn-sm" disabled={acceptingId === f.proposalId} onClick={async (e) => { e.stopPropagation(); await acceptProposal(f.proposalId); }}>
                              {acceptingId === f.proposalId ? '...' : 'Hire'}
                            </button>
                          ) : (
                            <div className="fl-arrow">></div>
                          )}
                        </div>
                      </div>
                    ))}
                    {appliedFl.total > 5 && <button className="btn btn-outline btn-full btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/client/my-contracts'}>View All ({appliedFl.total})</button>}
                  </>
                )}
              </div>
            </div>

            <div className="hire-card">
              <div className="hc-icon">+</div>
              <div className="hire-copy">
                <h4>Hire Smarter</h4>
                <p>Use scoped milestones, clear review points, and protected escrow to make first-time hires easier.</p>
                <button className="btn-hire" onClick={() => setGuideOpen(true)}>Read Guide <span aria-hidden="true">-&gt;</span></button>
              </div>
              <div className="hire-illustration" aria-hidden="true">
                <div className="shield-orbit orbit-one"></div>
                <div className="shield-orbit orbit-two"></div>
                <span className="orbit-dot dot-a"></span>
                <span className="orbit-dot dot-b"></span>
                <span className="orbit-dot dot-c"></span>
                <div className="shield-badge"><strong>{'\u2713'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PostProjectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {guideOpen && (
        <div className="guide-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className="guide-modal">
            <div className="guide-modal-head">
              <div><span className="guide-kicker">Client Guide</span><h2 id="guide-title">Hire smarter with FreeLedger</h2></div>
              <button className="guide-close" onClick={() => setGuideOpen(false)} aria-label="Close guide">x</button>
            </div>
            <div className="guide-steps">
              <article><span>01</span><h3>Write a clear scope</h3><p>List deliverables, timeline, review points, and what success looks like before inviting freelancers.</p></article>
              <article><span>02</span><h3>Compare proposals calmly</h3><p>Review bid amount, skills, response quality, and whether the freelancer understood your project.</p></article>
              <article><span>03</span><h3>Use protected milestones</h3><p>Break bigger work into approvals so funds stay protected and progress remains easy to track.</p></article>
            </div>
            <div className="guide-actions"><button className="btn btn-outline" onClick={() => setGuideOpen(false)}>Close</button><button className="btn btn-primary" onClick={() => { setGuideOpen(false); setModalOpen(true); }}>Post a Project</button></div>
          </div>
        </div>
      )}

      <div className="toast" id="toast"><span className="toast-icon">OK</span><span id="toast-msg">Done!</span></div>
    </>
  );
}