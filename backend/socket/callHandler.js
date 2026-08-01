const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { verifySocketToken } = require('../middleware/auth');

// conversationId -> { isVideo, initiatorSocketId, initiatedAt, participants: Map(socketId -> {userId, name}), ringTimeout }
const activeCalls = new Map();

const RING_TIMEOUT_MS = 30000; // matches real phone/video call apps' typical ring duration

async function logCallMessage(io, conversationId, callerId, type, status, durationSeconds) {
  try {
    const message = await Message.create({
      conversation: conversationId,
      sender: callerId,
      text: '',
      callInfo: { type, status, durationSeconds },
      readBy: [callerId],
    });
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    const populated = await message.populate('sender', 'name avatarColor');
    io.to(`conversation:${conversationId}`).emit('new-message', populated);
  } catch (err) {
    console.error('Failed to log call message:', err.message);
  }
}

function registerCallHandlers(io) {
  io.on('connection', (socket) => {
    let currentUserId = null;
    let currentUserName = null;

    // chatHandler.js already authenticates this socket for messaging: we
    // piggyback on the same 'authenticate' event here rather than requiring
    // a second handshake, so both handlers just need the token once.
    socket.on('authenticate', async ({ token }) => {
      try {
        const { verifySocketToken: verify } = require('../middleware/auth');
        const user = await verify(token);
        currentUserId = user._id.toString();
        currentUserName = user.name;
      } catch (err) {
        // chatHandler.js already emits an auth-error for this same event;
        // no need to duplicate that here.
      }
    });

    // --- Caller starts a call ---
    socket.on('call:initiate', async ({ conversationId, isVideo }) => {
      if (!currentUserId || activeCalls.has(conversationId)) return; // one call at a time per conversation

      const call = {
        isVideo,
        initiatorSocketId: socket.id,
        initiatorId: currentUserId,
        initiatedAt: Date.now(),
        participants: new Map([[socket.id, { userId: currentUserId, name: currentUserName }]]),
      };
      activeCalls.set(conversationId, call);

      socket.to(`conversation:${conversationId}`).emit('call:incoming', {
        conversationId,
        callerId: currentUserId,
        callerName: currentUserName,
        isVideo,
      });

      // If nobody answers within the ring window, log it as missed and
      // clean up - this is what makes "missed call" entries appear in chat.
      call.ringTimeout = setTimeout(async () => {
        if (activeCalls.get(conversationId)?.participants.size === 1) {
          activeCalls.delete(conversationId);
          io.to(`conversation:${conversationId}`).emit('call:missed', { conversationId });
          await logCallMessage(io, conversationId, currentUserId, isVideo ? 'video' : 'voice', 'missed');
        }
      }, RING_TIMEOUT_MS);
    });

    // --- Callee accepts ---
    socket.on('call:accept', ({ conversationId }) => {
      const call = activeCalls.get(conversationId);
      if (!call || !currentUserId) return;

      clearTimeout(call.ringTimeout);

      // Tell the new joiner who's already on the call, so THEY initiate the
      // WebRTC offer to each existing participant - same one-directional
      // rule used in CodeSync's video handler, avoiding both sides racing
      // to send offers simultaneously.
      const existingPeers = Array.from(call.participants.entries()).map(([socketId, p]) => ({
        socketId,
        name: p.name,
      }));
      socket.emit('call:existing-peers', { conversationId, isVideo: call.isVideo, peers: existingPeers });

      call.participants.set(socket.id, { userId: currentUserId, name: currentUserName });
      io.to(`conversation:${conversationId}`).emit('call:accepted', {
        conversationId,
        by: currentUserName,
        socketId: socket.id,
      });
    });

    // --- Callee declines ---
    socket.on('call:decline', async ({ conversationId }) => {
      const call = activeCalls.get(conversationId);
      if (!call) return;
      clearTimeout(call.ringTimeout);
      activeCalls.delete(conversationId);
      io.to(`conversation:${conversationId}`).emit('call:declined', { conversationId, by: currentUserName });
      await logCallMessage(io, conversationId, call.initiatorId, call.isVideo ? 'video' : 'voice', 'declined');
    });

    // --- Caller cancels before anyone answers ---
    socket.on('call:cancel', async ({ conversationId }) => {
      const call = activeCalls.get(conversationId);
      if (!call) return;
      clearTimeout(call.ringTimeout);
      activeCalls.delete(conversationId);
      io.to(`conversation:${conversationId}`).emit('call:cancelled', { conversationId });
      await logCallMessage(io, conversationId, call.initiatorId, call.isVideo ? 'video' : 'voice', 'cancelled');
    });

    // --- WebRTC signaling relay (mesh, same pattern as CodeSync) ---
    socket.on('call:offer', ({ to, offer }) => io.to(to).emit('call:offer', { from: socket.id, offer }));
    socket.on('call:answer', ({ to, answer }) => io.to(to).emit('call:answer', { from: socket.id, answer }));
    socket.on('call:ice-candidate', ({ to, candidate }) =>
      io.to(to).emit('call:ice-candidate', { from: socket.id, candidate })
    );

    // --- Someone leaves an active call ---
    socket.on('call:leave', ({ conversationId }) => leaveCall(conversationId));

    socket.on('disconnect', () => {
      for (const [conversationId, call] of activeCalls.entries()) {
        if (call.participants.has(socket.id)) leaveCall(conversationId);
      }
    });

    async function leaveCall(conversationId) {
      const call = activeCalls.get(conversationId);
      if (!call) return;

      call.participants.delete(socket.id);
      socket.to(`conversation:${conversationId}`).emit('call:peer-left', { socketId: socket.id });

      // Call ends once everyone's left - log it as a completed call with
      // its actual duration, unless it never really connected (still ringing).
      if (call.participants.size === 0) {
        clearTimeout(call.ringTimeout);
        activeCalls.delete(conversationId);
        const durationSeconds = Math.round((Date.now() - call.initiatedAt) / 1000);
        io.to(`conversation:${conversationId}`).emit('call:ended', { conversationId });
        await logCallMessage(io, conversationId, call.initiatorId, call.isVideo ? 'video' : 'voice', 'completed', durationSeconds);
      }
    }
  });
}

module.exports = registerCallHandlers;
