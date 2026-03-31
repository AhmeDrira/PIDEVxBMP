const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reporterRole: {
    type: String,
    enum: ['artisan', 'expert', 'manufacturer', 'admin'],
    required: true,
  },
  reportType: {
    type: String,
    enum: ['user', 'app'],
    required: true,
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  targetRole: {
    type: String,
    enum: ['artisan', 'expert', 'manufacturer', 'admin', 'unknown'],
    default: 'unknown',
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  details: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['submitted', 'accepted', 'rejected'],
    default: 'submitted',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Report', reportSchema);
