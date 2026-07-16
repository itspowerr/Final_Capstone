import { useState, useMemo, useEffect } from 'react';
import Navbar from '../../components/client/Navbar';
import { SkeletonCard } from '../../components/shared/Skeleton';
import api from '../../services/api.js';
import '../../css/client/explore-jobs.css';

const catClass = (cat) => 'cat-' + cat.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-');

const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#d97706', '#14b8a6'];

function formatJob(job) {
  const hoursDiff = (Date.now() - new Date(job.created_at).getTime()) / 36e5;
  let posted;
  if (hoursDiff < 1) posted = 'Less than an hour ago';
  else if (hoursDiff < 24) posted = `${Math.floor(hoursDiff)}h ago`;
  else if (hoursDiff < 48) posted = '1 day ago';
  else posted = `${Math.floor(hoursDiff / 24)} days ago`;

  return {
    id: job.id,
    title: job.title,
    category: job.category || 'General',
    budget: job.budget,
    budgetDisplay: `${(job.budget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETH`,
    desc: job.description || '',
    skills: job.skills || [],
    client: job.client_id,
    clientInitials: job.client_id.slice(4, 6).toUpperCase(),
    clientColor: colors[Math.abs(job.client_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length],
    applicants: 0,
    daysLeft: job.duration_days || '-',
    posted,
    isNew: hoursDiff < 48,
  };
}

export default function ExploreJobs() {
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ category: '', budget: '' });
  const [saved, setSaved] = useState([]);
  const [applied, setApplied] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/jobs')
      .then(res => setAllJobs((res.data || []).map(formatJob)))
      .catch(err => {
        const msg = err.response?.data?.detail?.message || err.message || 'Failed to load jobs';
        setFetchError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSave = (id) => {
    setSaved((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const applyToJob = (id) => {
    if (applied.includes(id)) return;
    setApplied((prev) => [...prev, id]);
    setSelectedJob(null);
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ category: '', budget: '', type: '' });
  };

  const checkBudget = (b, range) => {
    if (range === '0-5') return b < 5;
    if (range === '5-20') return b >= 5 && b < 20;
    if (range === '20-50') return b >= 20 && b < 50;
    if (range === '50+') return b >= 50;
    return true;
  };

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      const q = search.toLowerCase();
      const matchSearch = !q || job.title.toLowerCase().includes(q) || job.desc.toLowerCase().includes(q) || job.skills.some((s) => s.toLowerCase().includes(q));
      const matchCat = !filters.category || job.category === filters.category;
      const matchBudget = !filters.budget || checkBudget(job.budget, filters.budget);
      return matchSearch && matchCat && matchBudget;
    });
  }, [search, filters, allJobs]);

  const activeFilterTags = [];
  if (filters.category) activeFilterTags.push({ label: filters.category, key: 'category' });
  if (filters.budget) activeFilterTags.push({ label: filters.budget, key: 'budget' });

  const removeFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  };

  useEffect(() => {
    if (!selectedJob) { setJobDetail(null); return; }
    setDetailLoading(true);
    api.get(`/jobs/${selectedJob}`)
      .then(res => setJobDetail(res.data))
      .catch(() => setJobDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedJob]);

  const selectedJobData = selectedJob ? allJobs.find((j) => j.id === selectedJob) : null;

  return (
    <>
      <Navbar activePage="explore-jobs" />
      <div className="dash-body">
        <div className="page-header">
          <div>
            <h1 className="page-title">Explore Jobs</h1>
            <p className="page-sub">Browse <span>{filteredJobs.length}</span> open projects from verified clients</p>
          </div>
          <div className="header-actions">
            <div className="view-toggle">
              <button className={`view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              </button>
              <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" className="search-input" placeholder="Search jobs, skills, keywords…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}>
            <option value="">All Categories</option>
            {['Development', 'Design', 'Marketing', 'Writing', 'Smart Contracts', 'Data & Analytics'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={filters.budget} onChange={(e) => setFilters((prev) => ({ ...prev, budget: e.target.value }))}>
            <option value="">Any Budget</option>
            <option value="0-5">Under 5 ETH</option>
            <option value="5-20">5 – 20 ETH</option>
            <option value="20-50">20 – 50 ETH</option>
            <option value="50+">50+ ETH</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>
        </div>

        {activeFilterTags.length > 0 && (
          <div className="active-filters">
            {activeFilterTags.map((tag, i) => (
              <span key={i} className="filter-tag">{tag.label}<button onClick={() => removeFilter(tag.key)}>×</button></span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} rows={3} />)}
          </div>
        ) : fetchError ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 32 }}>⚠️</div>
            <h3>Failed to load jobs</h3>
            <p>{fetchError}</p>
            <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No jobs found</h3>
            <p>Try adjusting your filters or search terms.</p>
            <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : (
          <div className={`jobs-grid${view === 'list' ? ' list-view' : ''}`}>
            {filteredJobs.map((job) => {
              const isSaved = saved.includes(job.id);
              const isApplied = applied.includes(job.id);
              return (
                <div key={job.id} className={`job-card${view === 'list' ? ' list-view' : ''}`} onClick={() => setSelectedJob(job.id)}>
                  {job.isNew && <span className="job-new-badge">NEW</span>}
                  <div className="job-card-top">
                    <span className={`job-category ${catClass(job.category)}`}>{job.category}</span>
                    <button className={`job-save-btn${isSaved ? ' saved' : ''}`} onClick={(e) => { e.stopPropagation(); toggleSave(job.id); }} title={isSaved ? 'Unsave' : 'Save'}>
                      {isSaved ? '★' : '☆'}
                    </button>
                  </div>
                  <div>
                    <div className="job-title">{job.title}</div>
                    <div className="job-desc">{job.desc}</div>
                  </div>
                  <div className="job-skills">
                    {job.skills.slice(0, 4).map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
                  </div>
                  <div className="job-footer">
                    <div>
                      <div className="job-budget">{job.budgetDisplay}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{job.contractType || ''}</div>
                    </div>
                    <div className="job-meta">
                      <div className="job-meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                        {job.applicants} applied
                      </div>
                      <div className="job-meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {job.daysLeft}d left
                      </div>
                      {isApplied && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>✓ Applied</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedJobData && (
        <div className="modal-overlay open" onClick={() => setSelectedJob(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={() => setSelectedJob(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div className="modal-cat-row">
              <span className={`job-category ${catClass(selectedJobData.category)}`}>{selectedJobData.category}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{selectedJobData.posted}</span>
            </div>
            <div className="modal-title-lg">{selectedJobData.title}</div>
            <div className="modal-client">
              <div className="client-avatar" style={{ background: selectedJobData.clientColor }}>{selectedJobData.clientInitials}</div>
              <span>Posted by <strong>{selectedJobData.client}</strong></span>
              <span style={{ color: 'var(--text-3)' }}>·</span>
              <span>{selectedJobData.applicants} applicants</span>
            </div>

            <div className="modal-meta-grid" style={{ marginBottom: 20 }}>
              <div className="modal-meta-box">
                <div className="lbl">Budget</div>
                <div className="val" style={{ color: 'var(--accent)' }}>{selectedJobData.budgetDisplay}</div>
              </div>
              <div className="modal-meta-box">
                <div className="lbl">Contract Type</div>
                <div className="val">{selectedJobData.contractType || selectedJobData.type || '—'}</div>
              </div>
              <div className="modal-meta-box">
                <div className="lbl">Deadline</div>
                <div className="val">{selectedJobData.daysLeft} days left</div>
              </div>
              <div className="modal-meta-box">
                <div className="lbl">Category</div>
                <div className="val">{selectedJobData.category}</div>
              </div>
            </div>

            <div className="modal-section">
              <h4>Project Description</h4>
              <p>{selectedJobData.desc}</p>
            </div>

            <div className="modal-section">
              <h4>Required Skills</h4>
              <div className="job-skills" style={{ marginTop: 4 }}>
                {selectedJobData.skills.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
              </div>
            </div>

            <div className="modal-section">
              <h4>Milestones</h4>
              {detailLoading ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading milestones…</p>
              ) : jobDetail?.milestones && jobDetail.milestones.length > 0 ? (
                <div style={{ marginTop: 4 }}>
                  {jobDetail.milestones.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: i < jobDetail.milestones.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 14,
                    }}>
                      <span>{m.description}</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{parseFloat(m.amount).toLocaleString()} ETH</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>No milestones defined.</p>
              )}
            </div>

            <div className="modal-footer-actions">
              <button className="btn btn-outline" onClick={(e) => { e.stopPropagation(); toggleSave(selectedJobData.id); }}
                style={{ flex: 1 }}>
                {saved.includes(selectedJobData.id) ? '★ Saved' : '☆ Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
