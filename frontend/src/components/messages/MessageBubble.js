import { getIPFSGatewayUrl } from '../../services/ipfs';

function formatFullTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

function formatDateSeparator(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MessageBubble({ message, isMe, partnerId, avatarCache, job, isFirstOfJob, navigate }) {
  return (
    <div className={`msg-bubble-row ${isMe ? 'sent' : 'received'}`}>
      {!isMe && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginRight: 10, marginTop: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden',
          background: (() => {
            let hash = 0;
            const idStr = partnerId || '';
            for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
            const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e8', '#c026d3'];
            return colors[Math.abs(hash) % colors.length];
          })()
        }}>
          {avatarCache[partnerId]?.avatar_cid
            ? <img src={getIPFSGatewayUrl(avatarCache[partnerId].avatar_cid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (partnerId || '?')[0].toUpperCase()
          }
        </div>
      )}
      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        {isFirstOfJob && job && (
          <div className="msg-job-card">
            <div className="msg-job-card-title">
              <span onClick={() => navigate(isMe ? '/client/my-contracts' : '/freelancer/jobs')}>
                {job.title}
              </span>
            </div>
            <div className="msg-job-card-meta">
              Budget: {job.budget} ETH &middot; {job.status}
            </div>
          </div>
        )}
        <div className={`msg-bubble ${isMe ? 'sent' : 'received'}`}>
          <div>{message.content}</div>
        </div>
        <span className="msg-bubble-time">{formatFullTime(message.created_at)}</span>
      </div>
    </div>
  );
}

export { formatDateSeparator };
