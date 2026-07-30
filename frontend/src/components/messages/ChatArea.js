import { SkeletonChatArea } from '../shared/Skeleton';
import MessageBubble, { formatDateSeparator } from './MessageBubble';
import { getIPFSGatewayUrl } from '../../services/ipfs';

export default function ChatArea({
  loading, activeThread, messages, jobCache, avatarCache,
  replyText, onReplyChange, sending, onSend,
  myId, myRole, effectiveDismissed, proposalJobIds,
  onAcceptJob, onDismissJob, onDeleteThread,
  threadMessagesEndRef, inputRef, onBack, navigate,
}) {
  const visibleClass = activeThread ? 'visible' : '';

  if (loading) {
    return (
      <div className={`msg-middle-col`}>
        <SkeletonChatArea />
      </div>
    );
  }

  if (!activeThread) {
    return (
      <div className={`msg-middle-col`}>
        <div className="msg-empty">
          <div className="msg-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a thread from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  const threadMsgs = messages.filter(m =>
    (m.sender_id === myId && m.receiver_id === activeThread.partnerId) ||
    (m.sender_id === activeThread.partnerId && m.receiver_id === myId)
  );

  const hasInvitableJob = myRole === 'freelancer' && threadMsgs.some(m =>
    m.job_id && m.sender_id !== myId &&
    !effectiveDismissed.has(m.job_id) &&
    !proposalJobIds.has(m.job_id) &&
    !threadMsgs.some(r => r.sender_id === myId && r.job_id === m.job_id && r.content?.toLowerCase().includes('accepted'))
  );

  const inviteJobIds = hasInvitableJob
    ? [...new Set(threadMsgs.filter(m => m.job_id && m.sender_id !== myId).map(m => m.job_id))]
    : [];

  return (
    <div className={`msg-middle-col ${visibleClass}`}>
      <div className="msg-chat-header">
        <button className="msg-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="msg-chat-avatar">
          {(() => {
            let hash = 0;
            const idStr = activeThread.partnerId || '';
            for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
            const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e8', '#c026d3'];
            const color = colors[Math.abs(hash) % colors.length];
            return (
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, color: '#fff', background: color, overflow: 'hidden',
              }}>
                {avatarCache[activeThread.partnerId]?.avatar_cid
                  ? <img src={getIPFSGatewayUrl(avatarCache[activeThread.partnerId].avatar_cid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (activeThread.partnerId || '?')[0].toUpperCase()
                }
              </div>
            );
          })()}
        </div>
        <div className="msg-chat-header-info">
          <h3>{avatarCache[activeThread.partnerId]?.name || activeThread.partnerId}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`msg-chat-role-badge ${myRole === 'client' ? 'is-freelancer' : 'is-client'}`}>
              {myRole === 'client' ? 'Freelancer' : 'Client'}
            </span>
            {(() => {
              const lastWithJob = [...threadMsgs].reverse().find(m => m.job_id);
              const j = lastWithJob ? jobCache[lastWithJob.job_id] : null;
              return j ? <span className="msg-chat-job-label">{j.title}</span> : null;
            })()}
          </div>
        </div>
        <div className="msg-chat-actions">
          <button
            onClick={() => onDeleteThread(activeThread.partnerId)}
            className="msg-chat-delete-btn"
            title="Delete conversation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="msg-chat-messages">
        {threadMsgs.map((msg, i) => {
          const isMe = msg.sender_id === myId;
          const job = msg.job_id ? jobCache[msg.job_id] : null;
          const prevMsg = threadMsgs[i - 1];
          const showDate = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
          const isFirstOfJob = job && (!prevMsg || prevMsg.job_id !== msg.job_id);
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="msg-date-sep">{formatDateSeparator(msg.created_at)}</div>
              )}
              <MessageBubble
                message={msg}
                isMe={isMe}
                partnerId={activeThread.partnerId}
                avatarCache={avatarCache}
                job={job}
                isFirstOfJob={isFirstOfJob}
                navigate={navigate}
              />
            </div>
          );
        })}
        <div ref={threadMessagesEndRef} />
      </div>

      {inviteJobIds.length > 0 && (
        <div className="msg-invite-section">
          {inviteJobIds.map(jid => {
            const job = jobCache[jid];
            const alreadyAccepted = threadMsgs.some(
              m => m.sender_id === myId && m.job_id === jid && m.content?.toLowerCase().includes('accepted')
            );
            if (alreadyAccepted || !job || effectiveDismissed.has(jid) || proposalJobIds.has(jid)) return null;
            return (
              <div className="msg-invite-card" key={jid}>
                <button
                  onClick={() => onDismissJob(jid)}
                  className="msg-invite-dismiss"
                  title="Decline"
                >×</button>
                <h4>{job.title}</h4>
                <p>Budget: {job.budget} ETH &middot; Duration: {job.duration_days || 30} days</p>
                <button className="btn-accept" onClick={() => onAcceptJob(jid, activeThread.partnerId)}>
                  Accept Invitation
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="msg-input-area">
        <textarea
          ref={inputRef}
          className="msg-textarea"
          rows={1}
          placeholder="Type a message..."
          value={replyText}
          onChange={e => {
            onReplyChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(activeThread.partnerId);
              if (inputRef.current) inputRef.current.style.height = 'auto';
            }
          }}
        />
        <button
          className="msg-send-btn"
          onClick={() => onSend(activeThread.partnerId)}
          disabled={sending || !replyText.trim()}
          title="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
