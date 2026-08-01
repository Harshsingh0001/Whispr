import { useEffect, useState } from 'react';
import api from '../api/axios';
import socket from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from './ChatWindow';
import IncomingCallModal from '../components/IncomingCallModal';
import CallWindow from '../components/CallWindow';

export default function ChatApp() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Call state lives HERE, not inside ChatWindow, because an incoming call
  // notification needs to work regardless of which chat (if any) the user
  // currently has open - it's global to the whole app, not scoped to one chat.
  const [incomingCall, setIncomingCall] = useState(null); // { conversationId, callerId, callerName, isVideo }
  const [activeCall, setActiveCall] = useState(null); // { conversationId, isVideo, status, conversationName }

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data);
    } finally {
      setLoading(false);
    }
  };

  // --- Keep the sidebar's "last message" preview and ordering fresh even
  //     for conversations that aren't currently open ---
  useEffect(() => {
    const onNewMessage = (message) => {
      const conversationId = message.conversation?._id || message.conversation;
      setConversations((prev) => {
        const updated = prev.map((c) => (c._id === conversationId ? { ...c, lastMessage: message } : c));
        // Move the conversation with the new message to the top, same
        // "most recent activity first" behavior every chat app has.
        const target = updated.find((c) => c._id === conversationId);
        const rest = updated.filter((c) => c._id !== conversationId);
        return target ? [target, ...rest] : updated;
      });
    };

    socket.on('new-message', onNewMessage);
    return () => socket.off('new-message', onNewMessage);
  }, []);

  // --- Global call signaling: works no matter which chat is currently open ---
  useEffect(() => {
    const onIncomingCall = ({ conversationId, callerId, callerName, isVideo }) => {
      // Ignore if we're already on a call - a real app would send back a
      // "busy" signal here; keeping it simple by just not showing a second popup.
      if (activeCall) return;
      setIncomingCall({ conversationId, callerId, callerName, isVideo });
    };

    const onCancelled = ({ conversationId }) => {
      setIncomingCall((prev) => (prev?.conversationId === conversationId ? null : prev));
    };

    socket.on('call:incoming', onIncomingCall);
    socket.on('call:cancelled', onCancelled);
    return () => {
      socket.off('call:incoming', onIncomingCall);
      socket.off('call:cancelled', onCancelled);
    };
  }, [activeCall]);

  const getConversationName = (conversationId) => {
    const conv = conversations.find((c) => c._id === conversationId);
    if (!conv) return 'Unknown';
    if (conv.isGroup) return conv.groupName;
    return conv.participants.find((p) => p._id !== user._id)?.name || 'Unknown';
  };

  const startCall = (conversationId, isVideo) => {
    if (activeCall) return;
    socket.emit('call:initiate', { conversationId, isVideo });
    setActiveCall({ conversationId, isVideo, status: 'calling', conversationName: getConversationName(conversationId) });
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    socket.emit('call:accept', { conversationId: incomingCall.conversationId });
    setActiveCall({
      conversationId: incomingCall.conversationId,
      isVideo: incomingCall.isVideo,
      status: 'connecting',
      conversationName: incomingCall.callerName,
    });
    setIncomingCall(null);
  };

  const declineCall = () => {
    if (!incomingCall) return;
    socket.emit('call:decline', { conversationId: incomingCall.conversationId });
    setIncomingCall(null);
  };

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
  };

  const handleConversationCreated = (conv) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c._id === conv._id);
      return exists ? prev : [conv, ...prev];
    });
    socket.emit('join-conversation', { conversationId: conv._id });
    setActiveConversation(conv);
  };

  if (loading) return <p style={{ padding: '2rem' }}>Loading chats...</p>;

  return (
    // The "mobile-show-chat" class is what the CSS media query hooks into
    // to decide whether the sidebar or the chat window is visible on small
    // screens - see index.css for the actual responsive rules.
    <div className={`chat-layout ${activeConversation ? 'mobile-show-chat' : ''}`}>
      <div className="sidebar">
        <ConversationList
          conversations={conversations}
          activeId={activeConversation?._id}
          onSelect={handleSelectConversation}
          currentUserId={user._id}
          onConversationCreated={handleConversationCreated}
        />
        <button className="logout-link" onClick={logout}>Log out</button>
      </div>

      <div className="chat-area">
        {activeConversation ? (
          <ChatWindow
            key={activeConversation._id}
            conversation={activeConversation}
            currentUser={user}
            onBack={() => setActiveConversation(null)}
            onStartCall={(isVideo) => startCall(activeConversation._id, isVideo)}
          />
        ) : (
          <div className="no-chat-selected">
            <h2>Select a chat to start messaging</h2>
          </div>
        )}
      </div>

      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />

      {activeCall && (
        <CallWindow
          conversationId={activeCall.conversationId}
          isVideo={activeCall.isVideo}
          status={activeCall.status}
          conversationName={activeCall.conversationName}
          currentUser={user}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
