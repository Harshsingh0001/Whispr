const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    fileUrl: { type: String }, // set only if a file was attached
    fileName: { type: String },
    fileType: { type: String }, // mime type, used by the frontend to decide image vs generic file preview
    // Every user who has read this message - checking length against the
    // conversation's participant count is how we show single vs double
    // (blue) checkmarks, same visual pattern as WhatsApp/Telegram.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [reactionSchema],
    // If set, MongoDB itself deletes this document once this exact
    // timestamp passes - see the TTL index below. Left undefined for
    // messages sent while disappearing messages are OFF, so they persist
    // forever (a TTL index simply ignores documents missing the field).
    expiresAt: { type: Date },
    // Present only on system-generated "call log" messages (e.g. "Missed
    // video call", "Voice call - 5:32") - these render differently in the
    // UI than normal text/file messages, same idea as WhatsApp's call log
    // entries showing up inline in the chat itself.
    callInfo: {
      type: { type: String, enum: ['voice', 'video'] },
      status: { type: String, enum: ['missed', 'completed', 'declined', 'cancelled'] },
      durationSeconds: { type: Number },
    },
  },
  { timestamps: true }
);

// expireAfterSeconds: 0 tells MongoDB "delete exactly at the timestamp
// stored in this field" (rather than N seconds after it) - correct usage
// when the app itself computes the exact future deletion time, as we do
// in chatHandler.js's send-message handler.
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', messageSchema);
