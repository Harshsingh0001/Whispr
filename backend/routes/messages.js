const express = require('express');
const path = require('path');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(protect);

// @route   GET /api/messages/:conversationId?before=<messageId>&limit=30
// @desc    Paginated message history - "before" enables infinite-scroll-up
//          loading of older messages without re-fetching everything each time.
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 30 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    if (!conversation.participants.some((p) => p.equals(req.user._id))) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    const query = { conversation: conversationId };
    if (before) query._id = { $lt: before };

    const messages = await Message.find(query)
      .populate('sender', 'name avatarColor')
      .sort({ _id: -1 })
      .limit(Number(limit));

    res.json(messages.reverse()); // return oldest-first for easy rendering
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages', error: err.message });
  }
});

// @route   POST /api/messages/upload
// @desc    Upload a file/image attachment. Returns the file's metadata,
//          which the frontend then sends over Socket.io as a normal message
//          payload - keeps "persist a file" and "broadcast a message" as
//          two clean, separate steps instead of one giant endpoint.
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  res.json({
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
  });
});

module.exports = router;
