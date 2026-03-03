// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// GET messages d'une conversation
router.get('/', protect, getMessages);

// POST envoyer un message
router.post('/', protect, sendMessage);

module.exports = router;