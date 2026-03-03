const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware'); // ← importer juste protect

// GET toutes les conversations de l'utilisateur
router.get('/', protect, conversationController.getConversations);

// POST création d'une conversation
router.post('/', protect, conversationController.createConversation);

module.exports = router;