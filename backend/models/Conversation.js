const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true }, // only used when isGroup is true
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // only for groups
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    // 0 = disappearing messages OFF (the default). Any other value is the
    // lifetime in seconds a new message should last before auto-deleting.
    // This is a per-conversation setting any participant can toggle on/off
    // manually at any time - see chatHandler.js's 'set-disappearing' event.
    disappearingMessageDuration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
