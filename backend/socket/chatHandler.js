const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { verifySocketToken } = require('../middleware/auth');

// userId -> Set of socketIds. A user can have multiple sockets (phone + laptop
// tab both open) - we only mark them offline once ALL of their sockets close.
const onlineUsers = new Map();

function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    let currentUserId = null;

    socket.on('authenticate', async ({ token }) => {
      try {
        const user = await verifySocketToken(token);
        currentUserId = user._id.toString();

        if (!onlineUsers.has(currentUserId)) onlineUsers.set(currentUserId, new Set());
        onlineUsers.get(currentUserId).add(socket.id);

        await User.findByIdAndUpdate(currentUserId, { isOnline: true });

        // Join a room for every conversation this user is part of, so
        // "send-message" broadcasts reach them without a separate join
        // step per chat window they open.
        const conversations = await Conversation.find({ participants: currentUserId }).select('_id');
        conversations.forEach((c) => socket.join(`conversation:${c._id}`));

        // Tell everyone who shares a conversation with this user that they're online
        conversations.forEach((c) => {
          socket.to(`conversation:${c._id}`).emit('presence:update', { userId: currentUserId, isOnline: true });
        });

        socket.emit('authenticated');
      } catch (err) {
        socket.emit('auth-error', { message: 'Authentication failed, please log in again' });
      }
    });

    // --- Join a conversation room dynamically (e.g. right after creating a new group) ---
    socket.on('join-conversation', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    // --- Send a message (text and/or a previously-uploaded file) ---
    socket.on('send-message', async ({ conversationId, text, fileUrl, fileName, fileType }) => {
      if (!currentUserId) return;
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        // If disappearing messages are ON for this conversation, compute the
        // exact future deletion time now, at send-time - not at read-time,
        // which matches how WhatsApp's disappearing messages actually work
        // (the timer starts from when it was sent, not when each person saw it).
        const expiresAt = conversation.disappearingMessageDuration > 0
          ? new Date(Date.now() + conversation.disappearingMessageDuration * 1000)
          : undefined;

        const message = await Message.create({
          conversation: conversationId,
          sender: currentUserId,
          text: text || '',
          fileUrl,
          fileName,
          fileType,
          readBy: [currentUserId],
          expiresAt,
        });

        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });

        const populated = await message.populate('sender', 'name avatarColor');
        io.to(`conversation:${conversationId}`).emit('new-message', populated);
      } catch (err) {
        socket.emit('message-error', { message: 'Failed to send message' });
      }
    });

    // --- Toggle disappearing messages on/off (or change the timer) for a
    //     conversation - any participant can change this at any time, and
    //     it only affects messages sent AFTER the change, not existing ones ---
    socket.on('set-disappearing', async ({ conversationId, duration }) => {
      if (!currentUserId) return;
      try {
        await Conversation.findByIdAndUpdate(conversationId, { disappearingMessageDuration: duration });
        io.to(`conversation:${conversationId}`).emit('disappearing:update', { conversationId, duration });
      } catch (err) {
        console.error('Failed to update disappearing messages setting:', err.message);
      }
    });

    // --- Typing indicator ---
    socket.on('typing', ({ conversationId, isTyping, name }) => {
      socket.to(`conversation:${conversationId}`).emit('typing-update', {
        userId: currentUserId,
        name,
        isTyping,
      });
    });

    // --- Read receipts: mark a batch of messages as read by this user ---
    socket.on('mark-read', async ({ conversationId, messageIds }) => {
      if (!currentUserId || !messageIds?.length) return;
      try {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $addToSet: { readBy: currentUserId } } // $addToSet avoids duplicate entries
        );
        socket.to(`conversation:${conversationId}`).emit('read-update', { messageIds, userId: currentUserId });
      } catch (err) {
        console.error('Failed to mark messages as read:', err.message);
      }
    });

    // --- Emoji reactions: tapping the same emoji again removes it (toggle) ---
    socket.on('react', async ({ conversationId, messageId, emoji }) => {
      if (!currentUserId) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === currentUserId && r.emoji === emoji
        );

        if (existingIndex > -1) {
          message.reactions.splice(existingIndex, 1); // toggle off
        } else {
          message.reactions.push({ user: currentUserId, emoji });
        }

        await message.save();
        io.to(`conversation:${conversationId}`).emit('reaction-update', {
          messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error('Failed to update reaction:', err.message);
      }
    });

    // --- Cleanup on disconnect ---
    socket.on('disconnect', async () => {
      if (!currentUserId) return;
      const sockets = onlineUsers.get(currentUserId);
      if (!sockets) return;

      sockets.delete(socket.id);

      // Only mark the user offline once their LAST tab/device disconnects -
      // otherwise closing one tab would wrongly show them as offline while
      // they're still active on another device.
      if (sockets.size === 0) {
        onlineUsers.delete(currentUserId);
        const lastSeen = new Date();
        await User.findByIdAndUpdate(currentUserId, { isOnline: false, lastSeen });

        const conversations = await Conversation.find({ participants: currentUserId }).select('_id');
        conversations.forEach((c) => {
          io.to(`conversation:${c._id}`).emit('presence:update', {
            userId: currentUserId,
            isOnline: false,
            lastSeen,
          });
        });
      }
    });
  });
}

module.exports = registerChatHandlers;
