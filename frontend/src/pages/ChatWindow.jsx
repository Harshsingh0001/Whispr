import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import socket from '../socket/socket';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import DisappearingMenu from '../components/DisappearingMenu';

function getDisplayInfo(conversation, currentUserId) {
  if (conversation.isGroup) {
    return { name: conversation.groupName, color: '#5e6c84', isGroupChat: true };
  }
  const other = conversation.participants.find((p) => p._id !== currentUserId);
  return { name: other?.name || 'Unknown', color: other?.avatarColor, isOnline: other?.isOnline, lastSeen: other?.lastSeen, isGroupChat: false };
}

export default function ChatWindow({ conversation, currentUser, onBack, onStartCall }) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // userId -> name
  const [presence, setPresence] = useState({}); // userId -> { isOnline, lastSeen }
  const [disappearingDuration, setDisappearingDuration] = useState(conversation.disappearingMessageDuration || 0);
  const messagesEndRef = useRef(null);
  const uploadsBaseUrl = import.meta.env.VITE_UPLOADS_URL || 'http://localhost:5000';

  const displayInfo = getDisplayInfo(conversation, currentUser._id);
  const livePresence = presence[conversation.participants.find((p) => p._id !== currentUser._id)?._id];

  // --- Load message history whenever the active conversation changes ---
  useEffect(() => {
    let isMounted = true;
    socket.emit('join-conversation', { conversationId: conversation._id });

    api.get(`/messages/${conversation._id}`).then(({ data }) => {
      if (isMounted) setMessages(data);
    });

    return () => {
      isMounted = false;
    };
  }, [conversation._id]);

  // --- Socket listeners for this chat ---
  useEffect(() => {
    const onNewMessage = (message) => {
      if (message.conversation !== conversation._id && message.conversation?._id !== conversation._id) return;
      setMessages((prev) => [...prev, message]);
    };

    const onTypingUpdate = ({ userId, name, isTyping }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = name;
        else delete next[userId];
        return next;
      });
    };

    const onReadUpdate = ({ messageIds }) => {
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m._id) ? { ...m, readBy: [...new Set([...(m.readBy || []), currentUser._id])] } : m))
      );
    };

    const onReactionUpdate = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };

    const onPresenceUpdate = ({ userId, isOnline, lastSeen }) => {
      setPresence((prev) => ({ ...prev, [userId]: { isOnline, lastSeen } }));
    };

    const onDisappearingUpdate = ({ conversationId, duration }) => {
      if (conversationId === conversation._id) setDisappearingDuration(duration);
    };

    socket.on('disappearing:update', onDisappearingUpdate);

    socket.on('new-message', onNewMessage);
    socket.on('typing-update', onTypingUpdate);
    socket.on('read-update', onReadUpdate);
    socket.on('reaction-update', onReactionUpdate);
    socket.on('presence:update', onPresenceUpdate);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('typing-update', onTypingUpdate);
      socket.off('read-update', onReadUpdate);
      socket.off('reaction-update', onReactionUpdate);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('disappearing:update', onDisappearingUpdate);
    };
  }, [conversation._id, currentUser._id]);

  // --- Mark unread messages as read whenever new ones arrive while this chat is open ---
  useEffect(() => {
    const unread = messages.filter((m) => !m.readBy?.includes(currentUser._id));
    if (unread.length > 0) {
      socket.emit('mark-read', { conversationId: conversation._id, messageIds: unread.map((m) => m._id) });
    }
  }, [messages, conversation._id, currentUser._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // MongoDB's TTL index sweeps for expired documents roughly every 60
  // seconds - it's the source of truth for actual deletion, but relying on
  // it alone means a message could visibly linger on screen for up to a
  // minute past its expiry. This interval hides expired messages from the
  // UI immediately and independently, for a UX that actually matches the
  // timer the user set.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSetDisappearing = (duration) => {
    socket.emit('set-disappearing', { conversationId: conversation._id, duration });
  };

  const handleSend = ({ text, fileUrl, fileName, fileType }) => {
    socket.emit('send-message', { conversationId: conversation._id, text, fileUrl, fileName, fileType });
  };

  const handleTyping = (isTyping) => {
    socket.emit('typing', { conversationId: conversation._id, isTyping, name: currentUser.name });
  };

  const handleReact = (messageId, emoji) => {
    socket.emit('react', { conversationId: conversation._id, messageId, emoji });
  };

  const typingNames = Object.values(typingUsers);
  const isOnline = displayInfo.isGroupChat ? false : (livePresence?.isOnline ?? displayInfo.isOnline);
  const lastSeen = livePresence?.lastSeen ?? displayInfo.lastSeen;

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <Avatar name={displayInfo.name} color={displayInfo.color} isOnline={isOnline} size={38} />
        <div className="chat-window-title">
          <div className="chat-window-name">{displayInfo.name}</div>
          <div className="chat-window-status">
            {typingNames.length > 0
              ? `${typingNames.join(', ')} typing...`
              : displayInfo.isGroupChat
                ? `${conversation.participants.length} members`
                : isOnline
                  ? 'Online'
                  : lastSeen
                    ? `Last seen ${new Date(lastSeen).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}`
                    : ''}
          </div>
        </div>
        <button className="header-icon-btn" onClick={() => onStartCall(false)} title="Voice call">📞</button>
        <button className="header-icon-btn" onClick={() => onStartCall(true)} title="Video call">📹</button>
        <DisappearingMenu currentDuration={disappearingDuration} onChange={handleSetDisappearing} />
      </div>

      <div className="messages-container">
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            isOwn={msg.sender._id === currentUser._id}
            isGroup={conversation.isGroup}
            totalParticipants={conversation.participants.length}
            onReact={handleReact}
            uploadsBaseUrl={uploadsBaseUrl}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} onTyping={handleTyping} />
    </div>
  );
}
