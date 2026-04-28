const mongoose = require('mongoose');

// Sous-schéma pour les messages de négociation (ancienne structure conservée)
const negotiationMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['expert', 'artisan'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Sous-schéma pour l'historique de négociation (nouvelle structure enrichie)
const negotiationHistoryEntrySchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['expert', 'artisan'],
      required: true,
    },
    proposedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const projectProposalSchema = new mongoose.Schema(
  {
    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'artisanId is required'],
    },
    expertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'expertId is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    localisation: {
      type: String,
      required: [true, 'Localisation is required'],
      trim: true,
    },
    proposedPrice: {
      type: Number,
      required: [true, 'Proposed price is required'],
      min: [0, 'Price cannot be negative'],
    },
    negotiatedPrice: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: null,
    },
    // ── Négociation enrichie ──────────────────────────────────────────────────
    currentPrice: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: null,   // null = pas encore de contre-offre; sinon = dernier prix proposé
    },
    lastProposedBy: {
      type: String,
      enum: ['expert', 'artisan', null],
      default: null,
    },
    negotiationHistory: {
      type: [negotiationHistoryEntrySchema],
      default: [],
    },
    // ─────────────────────────────────────────────────────────────────────────
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'negotiating', 'accepted', 'rejected', 'signed'],
      default: 'pending',
    },
    expertHidden: {
      type: Boolean,
      default: false,
    },
    artisanHidden: {
      type: Boolean,
      default: false,
    },
    messages: {
      type: [negotiationMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

projectProposalSchema.index({ artisanId: 1, status: 1 });
projectProposalSchema.index({ expertId: 1, status: 1 });

module.exports = mongoose.model('ProjectProposal', projectProposalSchema);
