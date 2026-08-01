const express = require('express');
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// @route   GET /api/conversations
// @desc    List all conversations the logged-in user is part of, newest activity first
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name email avatarColor isOnline lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch conversations', error: err.message });
  }
});

// @route   POST /api/conversations/private
// @desc    Get or create a 1:1 conversation with another user.
//          Returns the EXISTING one if it already exists, rather than
//          creating duplicates every time two people message each other.
router.post('/private', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate('participants', 'name email avatarColor isOnline lastSeen');

    if (!conversation) {
      conversation = await Conversation.create({
        isGroup: false,
        participants: [req.user._id, userId],
      });
      conversation = await conversation.populate('participants', 'name email avatarColor isOnline lastSeen');
    }

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to start conversation', error: err.message });
  }
});

// @route   POST /api/conversations/group
// @desc    Create a new group conversation
router.post('/group', async (req, res) => {
  try {
    const { groupName, participantIds } = req.body;
    if (!groupName || !participantIds || participantIds.length < 2) {
      return res.status(400).json({ message: 'Group needs a name and at least 2 other members' });
    }

    const conversation = await Conversation.create({
      isGroup: true,
      groupName,
      groupAdmin: req.user._id,
      participants: [req.user._id, ...participantIds],
    });

    const populated = await conversation.populate('participants', 'name email avatarColor isOnline lastSeen');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create group', error: err.message });
  }
});

module.exports = router;
