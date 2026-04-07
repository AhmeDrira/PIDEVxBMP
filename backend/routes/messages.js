// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, deleteMessage, uploadAttachments, toggleReaction, uploadVoice, sendVoiceMessage, generateAIDraftMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// GET messages d'une conversation
router.get('/', protect, getMessages);

// POST envoyer un message
router.post('/', protect, uploadAttachments, sendMessage);
router.post('/ai-generate', protect, generateAIDraftMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:id/reaction', protect, toggleReaction);

// POST envoyer un message vocal
router.post('/voice', protect, uploadVoice, sendVoiceMessage);

module.exports = router;