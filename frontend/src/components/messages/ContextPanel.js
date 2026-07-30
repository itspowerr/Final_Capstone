import { useState } from 'react';
import { getIPFSGatewayUrl } from '../../services/ipfs';

export default function ContextPanel({ activeThread, avatarCache, collapsed, onToggle, myRole, myId }) {
  const [copied, setCopied] = useState(false);

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
        </div>
      )}
    </div>
  );
}
