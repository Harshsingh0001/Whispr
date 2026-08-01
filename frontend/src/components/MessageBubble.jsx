import { useState } from 'react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({ message, isOwn, isGroup, totalParticipants, onReact, uploadsBaseUrl }) {
  const [showReactionBar, setShowReactionBar] = useState(false);

  // Call log entries (missed/completed/declined calls) render as a centered
  // system-style line, not a normal chat bubble - matches how WhatsApp shows
  // "Missed video call" inline in the conversation history.
  if (message.callInfo) {
    const { type, status, durationSeconds } = message.callInfo;
    const icon = type === 'video' ? '📹' : '📞';
    const label =
      status === 'missed' ? 'Missed call' :
      status === 'declined' ? 'Call declined' :
      status === 'cancelled' ? 'Call cancelled' :
      `Call ended · ${formatDuration(durationSeconds)}`;
    const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="call-log-row">
        <span className="call-log-chip">{icon} {label} · {time}</span>
      </div>
    );
  }

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Read-receipt logic: readBy always includes the sender themselves, so
  // "everyone else has read it" means readBy.length === totalParticipants.
  const readByCount = message.readBy?.length || 0;
  const isReadByAll = readByCount >= totalParticipants;

  // Group reactions by emoji so we can show "❤️ x3" instead of 3 separate icons
  const reactionCounts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const isImage = message.fileType?.startsWith('image/');
  const isVideo = message.fileType?.startsWith('video/');
  // Our own uploads are relative paths (e.g. /uploads/abc.png) that need the
  // backend's base URL prefixed. Tenor GIFs come back as full https:// URLs
  // already - prefixing those would break them, so we check first.
  const resolvedFileUrl = message.fileUrl?.startsWith('http') ? message.fileUrl : `${uploadsBaseUrl}${message.fileUrl}`;

  return (
    <div className={`message-row ${isOwn ? 'own' : 'other'}`}>
      <div
        className={`message-bubble ${isOwn ? 'own' : 'other'}`}
        onMouseEnter={() => setShowReactionBar(true)}
        onMouseLeave={() => setShowReactionBar(false)}
        onTouchStart={() => setShowReactionBar((prev) => !prev)}
      >
        {isGroup && !isOwn && <div className="sender-name">{message.sender?.name}</div>}

        {message.fileUrl && isImage && (
          <img src={resolvedFileUrl} alt={message.fileName} className="message-image" />
        )}
        {message.fileUrl && isVideo && (
          <video src={resolvedFileUrl} controls className="message-video" />
        )}
        {message.fileUrl && !isImage && !isVideo && (
          <a href={resolvedFileUrl} target="_blank" rel="noreferrer" className="message-file">
            📎 {message.fileName}
          </a>
        )}
        {message.text && <div className="message-text">{message.text}</div>}

        <div className="message-meta">
          {message.expiresAt && <span className="disappearing-indicator" title="This message will disappear">⏳</span>}
          <span className="message-time">{time}</span>
          {isOwn && <span className={`read-tick ${isReadByAll ? 'read' : ''}`}>{isReadByAll ? '✓✓' : '✓'}</span>}
        </div>

        {Object.keys(reactionCounts).length > 0 && (
          <div className="reaction-chips">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} className="reaction-chip" onClick={() => onReact(message._id, emoji)}>
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}

        {showReactionBar && (
          <div className={`quick-reaction-bar ${isOwn ? 'left' : 'right'}`}>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => onReact(message._id, emoji)}>{emoji}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
