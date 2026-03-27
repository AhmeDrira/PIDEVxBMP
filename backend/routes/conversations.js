const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware'); // ← importer juste protect

// GET toutes les conversations de l'utilisateur
router.get('/', protect, conversationController.getConversations);

// POST création d'une conversation
router.post('/', protect, conversationController.createConversation);
router.delete('/:id', protect, conversationController.deleteConversation);
router.post('/:id/block', protect, conversationController.blockUser);
router.post('/:id/unblock', protect, conversationController.unblockUser);
router.get('/:id/status', protect, conversationController.getConversationStatus);

module.exports = router;