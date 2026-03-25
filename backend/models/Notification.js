const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, default: 'manufacturer_registration' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedModel' }, // Generic ref
  relatedModel: { type: String, enum: ['User', 'ProductPayment', 'Product'], default: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If null, it's for admins
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
