const express = require('express');
const router = express.Router();
const { protect, admin, superAdminOnly } = require('../middleware/authMiddleware');
const { getNotifications, getUnreadCount, markRead, markAllRead, deleteAll } = require('../controllers/notificationController');

router.get('/', protect, admin, superAdminOnly, getNotifications);
router.get('/unread-count', protect, admin, superAdminOnly, getUnreadCount);
router.put('/read-all', protect, admin, superAdminOnly, markAllRead);
router.delete('/', protect, admin, superAdminOnly, deleteAll);
router.put('/:id/read', protect, admin, superAdminOnly, markRead);

module.exports = router;
