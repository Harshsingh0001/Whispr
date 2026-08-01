import Avatar from './Avatar';

export default function IncomingCallModal({ call, onAccept, onDecline }) {
  if (!call) return null;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <Avatar name={call.callerName} color="#00a884" size={72} />
        <h2>{call.callerName}</h2>
        <p>{call.isVideo ? 'Incoming video call...' : 'Incoming voice call...'}</p>
        <div className="incoming-call-actions">
          <button className="decline-btn" onClick={onDecline}>
            <span>✕</span> Decline
          </button>
          <button className="accept-btn" onClick={onAccept}>
            <span>{call.isVideo ? '📹' : '📞'}</span> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
