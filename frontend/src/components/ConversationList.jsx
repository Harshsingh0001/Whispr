import { useState } from 'react';
import Avatar from './Avatar';
import NewChatModal from './NewChatModal';

// Figures out the right display name/avatar for a conversation - for a
// group it's the group's own name; for a 1:1 chat there's no "group name",
// so we show whichever participant ISN'T the logged-in user.
function getDisplayInfo(conversation, currentUserId) {
  if (conversation.isGroup) {
    return { name: conversation.groupName, color: '#5e6c84', isOnline: false };
  }
  const other = conversation.participants.find((p) => p._id !== currentUserId);
  return { name: other?.name || 'Unknown', color: other?.avatarColor, isOnline: other?.isOnline };
}

export default function ConversationList({ conversations, activeId, onSelect, currentUserId, onConversationCreated }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Whispr</h2>
        <button className="new-chat-btn" onClick={() => setShowModal(true)}>+ New</button>
      </div>

      <div className="conversation-items">
        {conversations.length === 0 && (
          <p className="hint-text" style={{ padding: '1rem' }}>No chats yet. Start one above.</p>
        )}
        {conversations.map((conv) => {
          const { name, color, isOnline } = getDisplayInfo(conv, currentUserId);
          const preview = conv.lastMessage?.text || (conv.lastMessage?.fileName ? `📎 ${conv.lastMessage.fileName}` : 'No messages yet');
          return (
            <div
              key={conv._id}
              className={`conversation-item ${activeId === conv._id ? 'active' : ''}`}
              onClick={() => onSelect(conv)}
            >
              <Avatar name={name} color={color} isOnline={isOnline} />
              <div className="conversation-item-text">
                <div className="conversation-item-name">{name}</div>
                <div className="conversation-item-preview">{preview}</div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onConversationCreated={(conv) => {
            setShowModal(false);
            onConversationCreated(conv);
          }}
        />
      )}
    </div>
  );
}
