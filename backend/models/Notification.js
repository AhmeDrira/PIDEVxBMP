const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, default: 'manufacturer_registration' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
