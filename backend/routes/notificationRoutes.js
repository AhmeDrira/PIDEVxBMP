const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteAll } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllRead);
router.delete('/', protect, deleteAll);
router.put('/:id/read', protect, markRead);

module.exports = router;
