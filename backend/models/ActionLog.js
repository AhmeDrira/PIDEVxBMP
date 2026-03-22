const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  actorName: {
    type: String,
    default: 'Unknown',
    trim: true,
  },
  actorRole: {
    type: String,
    enum: ['artisan', 'expert', 'manufacturer', 'admin', 'system'],
    default: 'system',
  },
  actorAdminType: {
    type: String,
    enum: ['super', 'sub', null],
    default: null,
  },
  actionKey: {
    type: String,
    required: true,
    trim: true,
  },
  actionLabel: {
    type: String,
    required: true,
    trim: true,
  },
  entityType: {
    type: String,
    required: true,
    trim: true,
  },
  entityId: {
    type: String,
    default: null,
  },
  targetName: {
    type: String,
    default: '',
    trim: true,
  },
  targetRole: {
    type: String,
    default: '',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
}, { timestamps: true });

actionLogSchema.index({ createdAt: -1 });
actionLogSchema.index({ actorRole: 1, createdAt: -1 });
actionLogSchema.index({ actionKey: 1, createdAt: -1 });

actionLogSchema.index({
  actorName: 'text',
  actionLabel: 'text',
  description: 'text',
  targetName: 'text',
});

module.exports = mongoose.model('ActionLog', actionLogSchema);
