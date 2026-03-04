const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteAll } = require('../controllers/notificationController');

router.get('/', protect, admin, getNotifications);
router.get('/unread-count', protect, admin, getUnreadCount);
router.put('/read-all', protect, admin, markAllRead);
router.delete('/', protect, admin, deleteAll);
router.put('/:id/read', protect, admin, markRead);

module.exports = router;
