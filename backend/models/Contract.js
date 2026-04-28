const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectProposal',
      required: [true, 'proposalId is required'],
    },
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
    content: {
      type: String,
      required: [true, 'Contract content is required'],
      trim: true,
    },
    signedByArtisanAt: {
      type: Date,
      default: null,
    },
    signatureData: {
      type: String,   // Base64 ou données SVG de la signature électronique
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_artisan_signature', 'signed', 'completed'],
      default: 'draft',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
  },
  { timestamps: true }
);

contractSchema.index({ proposalId: 1 });
contractSchema.index({ artisanId: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
