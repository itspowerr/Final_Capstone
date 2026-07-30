import { useState } from 'react';
import { getIPFSGatewayUrl } from '../../services/ipfs';

export default function ContextPanel({ activeThread, jobCache, avatarCache, collapsed, onToggle, myRole, messages, myId }) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('job');

  if (!activeThread) {
    return (
      <div className="msg-right-col collapsed">
        <div className="msg-context-toggle" onClick={onToggle} title="Expand panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
      </div>
    );
  }

  const threadMsgs = messages.filter(m =>
    (m.sender_id === myId && m.receiver_id === activeThread.partnerId) ||
    (m.sender_id === activeThread.partnerId && m.receiver_id === myId)
  );

  const lastWithJob = [...threadMsgs].reverse().find(m => m.job_id);
  const job = lastWithJob ? jobCache[lastWithJob.job_id] : null;

  let hash = 0;
  const idStr = activeThread.partnerId || '';
  for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e8', '#c026d3'];
  const avatarColor = colors[Math.abs(hash) % colors.length];

  function copyWallet() {
    if (activeThread.partnerId) {
      navigator.clipboard.writeText(activeThread.partnerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const statusColors = {
    'active': '#059669',
    'completed': '#2563eb',
    'pending': '#d97706',
    'cancelled': '#dc2626',
    'disputed': '#7c3aed',
  };

  return (
    <div className={`msg-right-col ${collapsed ? 'collapsed' : ''}`}>
      <button className="msg-context-toggle" onClick={onToggle} title={collapsed ? 'Expand panel' : 'Collapse panel'}>
        {collapsed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </button>

      {!collapsed && (
        <div className="msg-context-inner">
          {job ? (
            <>
              <div className="msg-context-tabs">
                <button className={`msg-context-tab ${view === 'job' ? 'active' : ''}`} onClick={() => setView('job')}>
                  Job Details
                </button>
                <button className={`msg-context-tab ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
                  Contact Profile
                </button>
              </div>

              {view === 'job' ? (
                <>
                  <div className="msg-context-section">
                    <div className="msg-context-section-title">Job</div>
                    <div className="msg-context-job-title">{job.title}</div>
                    <span className="msg-context-status" style={{
                      background: `${statusColors[job.status?.toLowerCase()] || '#6b7280'}15`,
                      color: statusColors[job.status?.toLowerCase()] || '#6b7280',
                    }}>
                      {job.status || 'Unknown'}
                    </span>
                  </div>

                  <div className="msg-context-section">
                    <div className="msg-context-section-title">Details</div>
                    <div className="msg-context-detail">
                      <span>Budget</span>
                      <strong>{job.budget} ETH</strong>
                    </div>
                    {job.duration_days && (
                      <div className="msg-context-detail">
                        <span>Duration</span>
                        <strong>{job.duration_days} days</strong>
                      </div>
                    )}
                    {job.deadline && (
                      <div className="msg-context-detail">
                        <span>Deadline</span>
                        <strong>{new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                      </div>
                    )}
                  </div>

                  <div className="msg-context-actions">
                    <button className="msg-context-btn primary" onClick={() => window.location.href = '/client/my-contracts'}>
                      View Contract
                    </button>
                    <button className="msg-context-btn secondary" onClick={() => window.location.href = myRole === 'client' ? '/client/my-contracts' : '/freelancer/jobs'}>
                      View Job
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="msg-context-profile">
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, fontWeight: 700, color: '#fff', background: avatarColor, overflow: 'hidden',
                    }}>
                      {avatarCache[activeThread.partnerId]?.avatar_cid
                        ? <img src={getIPFSGatewayUrl(avatarCache[activeThread.partnerId].avatar_cid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (activeThread.partnerId || '?')[0].toUpperCase()
                      }
                    </div>
                    <div className="msg-context-profile-name">
                      {avatarCache[activeThread.partnerId]?.name || activeThread.partnerId}
                    </div>
                    <span className="msg-chat-role-badge" style={{ margin: '0 auto' }}>
                      {myRole === 'client' ? 'Freelancer' : 'Client'}
                    </span>
                  </div>

                  <div className="msg-context-section">
                    <div className="msg-context-section-title">User ID</div>
                    <div className="msg-context-wallet">
                      <span className="msg-context-wallet-addr">
                        {activeThread.partnerId ? `${activeThread.partnerId.slice(0, 6)}...${activeThread.partnerId.slice(-4)}` : '—'}
                      </span>
                      <button className="msg-context-copy-btn" onClick={copyWallet}>
                        {copied ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="msg-context-actions">
                    <button className="msg-context-btn secondary" style={{ width: '100%' }}>
                      View Profile
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="msg-context-profile">
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: '#fff', background: avatarColor, overflow: 'hidden',
                }}>
                  {avatarCache[activeThread.partnerId]?.avatar_cid
                    ? <img src={getIPFSGatewayUrl(avatarCache[activeThread.partnerId].avatar_cid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (activeThread.partnerId || '?')[0].toUpperCase()
                  }
                </div>
                <div className="msg-context-profile-name">
                  {avatarCache[activeThread.partnerId]?.name || activeThread.partnerId}
                </div>
                <span className="msg-chat-role-badge" style={{ margin: '0 auto' }}>
                  {myRole === 'client' ? 'Freelancer' : 'Client'}
                </span>
              </div>

              <div className="msg-context-section">
                <div className="msg-context-section-title">User ID</div>
                <div className="msg-context-wallet">
                  <span className="msg-context-wallet-addr">
                    {activeThread.partnerId ? `${activeThread.partnerId.slice(0, 6)}...${activeThread.partnerId.slice(-4)}` : '—'}
                  </span>
                  <button className="msg-context-copy-btn" onClick={copyWallet}>
                    {copied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="msg-context-actions">
                <button className="msg-context-btn secondary" style={{ width: '100%' }}>
                  View Profile
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
