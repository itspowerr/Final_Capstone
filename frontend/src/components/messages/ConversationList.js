import { SkeletonThreadList } from '../shared/Skeleton';
import { getIPFSGatewayUrl } from '../../services/ipfs';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ id, avatarCid, size = 40 }) {
  let hash = 0;
  const idStr = id || '';
  for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e8', '#c026d3'];
  const color = colors[Math.abs(hash) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
      background: color, overflow: 'hidden',
    }}>
      {avatarCid
        ? <img src={getIPFSGatewayUrl(avatarCid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (id || '?')[0].toUpperCase()
      }
    </div>
  );
}

export default function ConversationList({ threads, activeThread, onSelectThread, avatarCache, searchQuery, onSearchChange, loading }) {
  const filtered = threads.filter(t => {
    if (!searchQuery) return true;
    const name = (avatarCache[t.partnerId]?.name || t.partnerId || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="msg-left-col">
      <div className="msg-conversation-search">
        <div className="msg-search-wrap">
          <svg className="msg-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="msg-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className="msg-conversation-list">
        {loading ? (
          <SkeletonThreadList count={6} />
        ) : filtered.length === 0 ? (
          <div className="msg-conversation-empty">
            {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
          </div>
        ) : (
          filtered.map(t => {
            const isActive = activeThread?.partnerId === t.partnerId;
            return (
              <div
                key={t.partnerId}
                className={`msg-conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => { onSelectThread(t); }}
              >
                <Avatar id={t.partnerId} avatarCid={avatarCache[t.partnerId]?.avatar_cid} size={40} />
                <div className="msg-conversation-item-body">
                  <div className="msg-conversation-item-top">
                    <span className={`msg-conversation-name ${t.unread > 0 ? 'unread' : ''}`}>
                      {avatarCache[t.partnerId]?.name || (t.partnerId || '').slice(0, 18)}
                    </span>
                    <span className="msg-conversation-time">{formatTime(t.lastMessage.created_at)}</span>
                  </div>
                  <div className="msg-conversation-item-bottom">
                    <span className="msg-conversation-preview">
                      {t.lastMessage.sender_id !== t.partnerId ? 'You: ' : ''}
                      {t.lastMessage.content?.slice(0, 50)}
                    </span>
                    {t.unread > 0 && <span className="msg-unread-dot" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
