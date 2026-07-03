import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/freelancer/Navbar';
import api from '../../services/api';

function loadArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}
function formatCurrency(n) {
  try { return '$' + Number(n || 0).toLocaleString(); } catch (e) { return '$0'; }
}
function relativeDate(dt) {
  const diff = Date.now() - new Date(dt).getTime();
  const days = Math.max(1, Math.floor(diff / 86400000));
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
function initials(name, fallback) {
  if (!name) return fallback || '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function colorFor(str, fallback) {
  if (!str) return fallback || '#999';
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 37 + str.charCodeAt(i)) >>> 0;
  const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#d97706','#14b8a6'];
  return palette[h % palette.length];
}

export default function FindJobs() {
  const [jobs, setJobs] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [appliedJobs, setAppliedJobs] = useState(loadArray('fl_applied_jobs'));
  const [savedJobs, setSavedJobs] = useState(loadArray('fl_saved_jobs_fl'));
  const [mySkills, setMySkills] = useState([]);
  const [currentView, setCurrentView] = useState('grid');
  const [search, setSearch] = useState('');
  const [fCat, setFCat] = useState('');
  const [fBudget, setFBudget] = useState('');
  const [fMatch, setFMatch] = useState('');
  const [modalJob, setModalJob] = useState(null);
  const [toast, setToast] = useState(null);

  const [applyForm, setApplyForm] = useState({ cover_letter: '', bid_amount: '', estimated_days: '' });
  const [applySubmitting, setApplySubmitting] = useState(false);

  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem('fl_freelancer_profile') || '{}');
    setMySkills((profile.skills || []).map(s => s.toLowerCase()));
  }, []);

  const fetchJobs = useCallback(async (params = {}) => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.category) q.set('category', params.category);
      if (params.search) q.set('search', params.search);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));

      const { data } = await api.get(`/jobs?${q.toString()}`);
      const items = Array.isArray(data) ? data : data?.jobs || data?.items || [];
      setJobs(items);
      setTotalPages(params.hasMore ? (params.hasMore) : 1);
      setPage(params.page || 1);

      const uniqueClientIds = Array.from(new Set(items.map(j => j.client_id).filter(Boolean)));
      if (uniqueClientIds.length) {
        try {
          const { data: usersData } = await api.get(`/users?ids=${uniqueClientIds.join(',')}`);
          const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);
          const map = {};
          for (const u of users) map[u.id] = u;
          setUsersMap(map);
        } catch {
          // best-effort enrichment
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail?.message || 'Failed to load jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs({ status: 'open', category: fCat || null, search: search || null, page, limit: 20 });
  }, [fetchJobs, fCat, search, page, fBudget]);

  const matchCount = useCallback((job) => {
    return job.skills.filter(s => mySkills.includes(s.toLowerCase())).length;
  }, [mySkills]);

  const matchPct = useCallback((job) => {
    return mySkills.length > 0 ? Math.round(matchCount(job) / job.skills.length * 100) : 0;
  }, [mySkills, matchCount]);

  function parseBudgetRange(range) {
    if (range === '0-500') return [0, 500];
    if (range === '500-2000') return [500, 2000];
    if (range === '2000-5000') return [2000, 5000];
    if (range === '5000+') return [5000, Infinity];
    return null;
  }

  const displayed = jobs.filter(j => {
    const br = parseBudgetRange(fBudget);
    if (br && (Number(j.budget) < br[0] || Number(j.budget) >= br[1])) return false;
    if (fMatch === 'saved' && !savedJobs.includes(j.id)) return false;
    if (fMatch === 'applied' && !appliedJobs.includes(j.id)) return false;
    if (fMatch === 'match' && matchCount(j) === 0) return false;
    return true;
  });

  function clearFilters() {
    setSearch('');
    setFCat('');
    setFBudget('');
    setFMatch('');
    setPage(1);
  }

  function toggleSave(e, id) {
    e.stopPropagation();
    const next = savedJobs.includes(id) ? savedJobs.filter(x => x !== id) : [...savedJobs, id];
    setSavedJobs(next);
    localStorage.setItem('fl_saved_jobs_fl', JSON.stringify(next));
  }

  function openModal(job) {
    setModalJob(job);
    setApplyForm({ cover_letter: '', bid_amount: '', estimated_days: '' });
  }

  async function submitApplication() {
    if (!modalJob) return;
    const bid = parseFloat(applyForm.bid_amount);
    if (!applyForm.cover_letter.trim() || Number.isNaN(bid) || bid <= 0) {
      showToast('Please enter a cover letter and valid bid amount.', '⚠️');
      return;
    }
    setApplySubmitting(true);
    try {
      const payload = {
        job_id: modalJob.id,
        cover_letter: applyForm.cover_letter.trim(),
        bid_amount: bid,
        estimated_days: applyForm.estimated_days ? parseInt(applyForm.estimated_days, 10) : null,
      };
      await api.post('/proposals', payload);
      const next = [...appliedJobs, modalJob.id];
      setAppliedJobs(next);
      localStorage.setItem('fl_applied_jobs', JSON.stringify(next));
      setModalJob(null);
      showToast('Application submitted!');
    } catch (err) {
      const msg = err?.response?.data?.detail?.message || 'Application failed';
      showToast(msg, '❌');
    } finally {
      setApplySubmitting(false);
    }
  }

  function showToast(msg, icon) {
    setToast({ msg, icon: icon || '✅' });
    setTimeout(() => setToast(null), 2500);
  }

  function renderJobCard(job) {
    const client = usersMap[job.client_id] || {};
    const name = client.username || client.email || '';
    const initialsVal = initials(name, 'CL');
    const colorVal = colorFor(name || job.client_id, '#999');
    const posted = relativeDate(job.created_at);
    const isNew = (Date.now() - new Date(job.created_at).getTime()) < 86400000 * 3;
    const mp = matchPct(job);
    const isApplied = appliedJobs.includes(job.id);
    const isSaved = savedJobs.includes(job.id);

    return (
      <div key={job.id} className={'job-card' + (isApplied ? ' applied' : '') + (currentView === 'list' ? ' list-card' : '')} onClick={() => openModal(job)} style={{ cursor: 'pointer', position: 'relative' }}>
        {isNew ? <span className="new-tag">NEW</span> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className={'job-category ' + catClass(job.category)}>{job.category || 'General'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {mp > 0 ? <span className="match-badge">{mp}% match</span> : null}
            {isApplied ? <span className="applied-badge">✓ Applied</span> : null}
            <button className={'job-save-btn' + (isSaved ? ' saved' : '')} onClick={e => toggleSave(e, job.id)}>{isSaved ? '★' : '☆'}</button>
          </div>
        </div>
        <div>
          <div className="job-title">{job.title}</div>
          <div className="job-desc" style={{ marginTop: 6 }}>{job.description}</div>
        </div>
        <div className="job-skills">
          {Array.isArray(job.skills) ? job.skills.map(s => <span key={s} className={'skill-tag' + (mySkills.includes(s.toLowerCase()) ? ' match' : '')}>{s}</span>) : null}
        </div>
        <div className="job-footer">
          <div>
            <div className="job-budget">{formatCurrency(job.budget)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Posted {posted}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>👥 {name ? '-' : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{client ? `· ${name}` : ''}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar activePage="find-jobs" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">Find Jobs</h1>
            <p className="page-sub">Browse <span>{loading ? '...' : displayed.length}</span> open projects — matched skills are highlighted</p>
          </div>
          <div className="view-toggle">
            <button className={'view-btn' + (currentView === 'grid' ? ' active' : '')} onClick={() => setCurrentView('grid')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
            <button className={'view-btn' + (currentView === 'list' ? ' active' : '')} onClick={() => setCurrentView('list')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/></svg>
            </button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" className="search-input" placeholder="Search title, skill, keyword…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="">All Categories</option>
            <option>Development</option><option>Design</option><option>Marketing</option>
            <option>Writing</option><option>Smart Contracts</option><option>Data & Analytics</option>
          </select>
          <select className="filter-select" value={fBudget} onChange={e => setFBudget(e.target.value)}>
            <option value="">Any Budget</option>
            <option value="0-500">Under $500</option>
            <option value="500-2000">$500–$2,000</option>
            <option value="2000-5000">$2,000–$5,000</option>
            <option value="5000+">$5,000+</option>
          </select>
          <select className="filter-select" value={fMatch} onChange={e => setFMatch(e.target.value)}>
            <option value="">All Jobs</option>
            <option value="match">Skill Matches Only</option>
            <option value="saved">Saved Only</option>
            <option value="applied">Applied</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>
        </div>

        {error && <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 16 }}>{error} <button className="btn btn-outline btn-sm" onClick={() => fetchJobs({ status: 'open', category: fCat || null, search: search || null, page: 1, limit: 20 })}>Retry</button></div>}
        {loading && <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading jobs…</div>}

        <div className={'jobs-grid' + (currentView === 'list' ? ' list-view' : '')}>
          {!loading && displayed.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No jobs found</h3>
              <p>Try adjusting your filters or search terms.</p>
              <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>
            </div>
          ) : displayed.map(job => renderJobCard(job))}
        </div>
      </div>

      {modalJob && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setModalJob(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalJob(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            {(() => {
              const job = modalJob;
              const client = usersMap[job.client_id] || {};
              const name = client.username || client.email || '';
              const initialsVal = initials(name, 'CL');
              const colorVal = colorFor(name || job.client_id, '#999');
              const posted = job.created_at ? relativeDate(job.created_at) : 'recently';
              const isNew = job.created_at && (Date.now() - new Date(job.created_at).getTime()) < 86400000 * 3;
              const mp = matchPct(job);
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span className={'job-category ' + catClass(job.category)}>{job.category || 'General'}</span>
                    {mp > 0 ? <span className="match-badge">{mp}% skill match</span> : null}
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Posted {posted}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 10 }}>{job.title}</div>
                  {name ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: colorVal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initialsVal}</div>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Posted by <strong>{name}</strong></span>
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Budget</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(job.budget)}</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{job.status ? job.status.replace(/\b\w/g, c => c.toUpperCase()) : 'Open'}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 8 }}>Description</div>
                    <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{job.description}</p>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-3)', marginBottom: 8 }}>Required Skills</div>
                    <div className="job-skills">{Array.isArray(job.skills) ? job.skills.map(s => <span key={s} className={'skill-tag' + (mySkills.includes(s.toLowerCase()) ? ' match' : '')}>{s}</span>) : null}</div>
                  </div>

                  {!appliedJobs.includes(job.id) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Apply to this job</div>
                      <textarea className="search-input" rows={4} placeholder="Short cover letter…" value={applyForm.cover_letter} onChange={e => setApplyForm(f => ({ ...f, cover_letter: e.target.value }))} style={{ background: '#f7f7f8', borderRadius: 14, padding: '14px 16px' }}></textarea>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                        <input type="number" className="search-input" placeholder="Bid amount" min="0" step="0.01" value={applyForm.bid_amount} onChange={e => setApplyForm(f => ({ ...f, bid_amount: e.target.value }))} style={{ background: '#f7f7f8', borderRadius: 14, padding: '12px 12px' }} />
                        <input type="number" className="search-input" placeholder="Est. days" min="1" step="1" value={applyForm.estimated_days} onChange={e => setApplyForm(f => ({ ...f, estimated_days: e.target.value }))} style={{ background: '#f7f7f8', borderRadius: 14, padding: '12px 12px' }} />
                      </div>
                      <button className="btn btn-primary" style={{ flex: 1, marginTop: 12 }} onClick={submitApplication} disabled={applySubmitting}>{applySubmitting ? 'Submitting…' : 'Apply Now →'}</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} disabled>✓ Already Applied</button>
                      <button className="btn btn-outline" onClick={() => setModalJob(null)}>Close</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast show">
          <span className="toast-icon">{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

function catClass(cat) {
  return 'cat-' + String(cat || '').toLowerCase().replace(/[^a-z]/g,'-').replace(/-+/g,'-');
}
