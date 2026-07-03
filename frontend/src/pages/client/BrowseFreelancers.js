import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/client/Navbar';
import api from '../../services/api';
import '../../css/client/browse-freelancers.css';

const experienceLevels = ['junior', 'mid', 'senior', 'lead'];

export default function BrowseFreelancers() {
  const navigate = useNavigate();
  const [freelancers, setFreelancers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [availFilter, setAvailFilter] = useState(false);
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');

  const [inviteModal, setInviteModal] = useState(null);
  const [myJobs, setMyJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

  const loadFreelancers = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = { role: 'freelancer', page: p, limit: 12 };
      if (search) params.search = search;
      if (skillsFilter) params.skills = skillsFilter;
      if (expFilter) params.experience_level = expFilter;
      if (availFilter) params.is_available = 'true';
      if (minRate) params.min_rate = minRate;
      if (maxRate) params.max_rate = maxRate;
      const { data } = await api.get('/users', { params });
      setFreelancers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      console.warn('Failed to load freelancers');
    }
    setLoading(false);
  }, [search, skillsFilter, expFilter, availFilter, minRate, maxRate]);

  useEffect(() => { loadFreelancers(page); }, [page, loadFreelancers]);

  const openInvite = async (freelancer) => {
    setInviteModal(freelancer);
    setSelectedJob('');
    setInviteMsg('');
    setInviteError('');
    setInviteSuccess('');
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const { data } = await api.get('/jobs', { params: { client_id: user.id } });
      const jobs = (data.jobs || data || []);
      setMyJobs(jobs);
    } catch {
      console.warn('Failed to load jobs for invite');
    }
  };

  const sendInvite = async () => {
    if (!selectedJob) { setInviteError('Please select a job'); return; }
    setSending(true);
    setInviteError('');
    try {
      const job = myJobs.find(j => j.id === selectedJob);
      await api.post('/messages/send', {
        receiver_id: inviteModal.id,
        content: inviteMsg
          ? `You've been invited to apply for "${job?.title}": ${inviteMsg}`
          : `You've been invited to apply for "${job?.title}"`,
      });
      setInviteSuccess('Invitation sent!');
      setTimeout(() => setInviteModal(null), 1500);
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Failed to send invitation');
    }
    setSending(false);
  };

  const clearFilters = () => {
    setSearch('');
    setSkillsFilter('');
    setExpFilter('');
    setAvailFilter(false);
    setMinRate('');
    setMaxRate('');
    setPage(1);
  };

  const avatarColor = (id) => colors[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length];

  return (
    <>
      <Navbar activePage="browse-freelancers" />
      <div className="dash-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">Browse Freelancers</h1>
            <p className="page-sub">Find top talent for your projects — <span>{total}</span> available</p>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-wrap" style={{ flex: 1.5 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" className="search-input" placeholder="Search by name, headline, bio..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <input className="filter-select" style={{ minWidth: 130, padding: '8px 12px' }} placeholder="Skills (comma-separated)" value={skillsFilter} onChange={(e) => { setSkillsFilter(e.target.value); setPage(1); }} />
          <select className="filter-select" value={expFilter} onChange={(e) => { setExpFilter(e.target.value); setPage(1); }}>
            <option value="">Any Level</option>
            {experienceLevels.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
          </select>
          <input className="filter-select" style={{ minWidth: 90, padding: '8px 12px' }} type="number" placeholder="Min rate" value={minRate} onChange={(e) => { setMinRate(e.target.value); setPage(1); }} />
          <input className="filter-select" style={{ minWidth: 90, padding: '8px 12px' }} type="number" placeholder="Max rate" value={maxRate} onChange={(e) => { setMaxRate(e.target.value); setPage(1); }} />
          <label className="fl-avail-check">
            <input type="checkbox" checked={availFilter} onChange={(e) => { setAvailFilter(e.target.checked); setPage(1); }} />
            Available
          </label>
          <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⏳</div>
            <h3>Loading freelancers…</h3>
          </div>
        ) : freelancers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No freelancers found</h3>
            <p>Try adjusting your filters or search terms.</p>
            <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : (
          <>
            <div className="fl-grid">
              {freelancers.map(f => (
                <div key={f.id} className="fl-card">
                  <div className="fl-card-top">
                    <div className="fl-avatar" style={{ background: avatarColor(f.id) }}>
                      {(f.username?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="fl-info">
                      <div className="fl-name">{f.username || 'Anonymous'}</div>
                      {f.headline && <div className="fl-headline">{f.headline}</div>}
                    </div>
                    <div className="fl-rate-wrap">
                      <div className="fl-rate">{f.hourly_rate > 0 ? `$${f.hourly_rate}/hr` : '—'}</div>
                      <div className="fl-level">{f.experience_level.charAt(0).toUpperCase() + f.experience_level.slice(1)}</div>
                    </div>
                  </div>

                  {f.skills?.length > 0 && (
                    <div className="fl-skills">
                      {f.skills.slice(0, 4).map(s => <span key={s} className="skill-tag">{s}</span>)}
                      {f.skills.length > 4 && <span className="skill-tag">+{f.skills.length - 4}</span>}
                    </div>
                  )}

                  {f.bio && <div className="fl-bio">{f.bio.slice(0, 120)}{f.bio.length > 120 ? '...' : ''}</div>}

                  <div className="fl-meta">
                    <div className="fl-rating">
                      {'★'.repeat(Math.round(f.rating))}{'☆'.repeat(5 - Math.round(f.rating))}
                      {f.rating > 0 && <span>{f.rating.toFixed(1)}</span>}
                    </div>
                    {f.is_available ? (
                      <span className="fl-avail-yes">● Available</span>
                    ) : (
                      <span className="fl-avail-no">○ Unavailable</span>
                    )}
                  </div>

                  <div className="fl-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/client/messages?user=${f.id}`)}>Message</button>
                    <button className="btn btn-primary btn-sm" onClick={() => openInvite(f)}>Invite to Job</button>
                  </div>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span className="page-info">Page {page} of {pages}</span>
                <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}

        {inviteModal && (
          <div className="modal-overlay open" onClick={() => setInviteModal(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <button className="modal-close" onClick={() => setInviteModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
              <div className="modal-title">Invite {inviteModal.username || 'Freelancer'}</div>
              {myJobs.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 24px' }}>
                  <p style={{ color: 'var(--text-2)', fontSize: 13 }}>You have no open jobs to invite to. Post a job first.</p>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Select Job</label>
                    <select className="form-input" value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
                      <option value="">Choose a job...</option>
                      {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message <span className="form-label-muted">(optional)</span></label>
                    <textarea className="form-input" rows={3} value={inviteMsg}
                      onChange={e => setInviteMsg(e.target.value)} placeholder="I think you'd be a great fit for this project..." />
                  </div>
                  {inviteError && <div className="form-error-msg" style={{ marginBottom: 8 }}>{inviteError}</div>}
                  {inviteSuccess && <div style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{inviteSuccess}</div>}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn btn-outline" onClick={() => setInviteModal(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={sendInvite} disabled={sending || !selectedJob}>
                      {sending ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
