const Notification = require('../models/Notification');

// Build a filter based on user role:
// - admin sees notifications where recipient is null (system/admin notifications)
// - other users see only their own notifications (recipient === userId)
const buildUserFilter = (req) => {
  if (req.user?.role === 'admin') {
    return { recipient: null };
  }
  return { recipient: req.user?._id };
};

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const filter = buildUserFilter(req);
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const filter = { ...buildUserFilter(req), read: false };
    const count = await Notification.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    const filter = { ...buildUserFilter(req), read: false };
    await Notification.updateMany(filter, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/notifications
const deleteAll = async (req, res) => {
  try {
    const filter = buildUserFilter(req);
    await Notification.deleteMany(filter);
    res.json({ message: 'All notifications deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead, deleteAll };
