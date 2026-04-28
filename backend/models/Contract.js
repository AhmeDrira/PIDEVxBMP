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
    // ── Expert signature ──────────────────────────────────────────────────────
    signedByExpertAt: {
      type: Date,
      default: null,
    },
    signatureDataExpert: {
      type: String,   // Base64 data URL de la signature de l'expert
      default: null,
    },
    // ── Artisan signature ─────────────────────────────────────────────────────
    signedByArtisanAt: {
      type: Date,
      default: null,
    },
    signatureData: {
      type: String,   // Base64 data URL de la signature de l'artisan (rétrocompatibilité)
      default: null,
    },
    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'draft',
        'pending_expert_signature',   // en attente de la signature de l'expert (1er signataire)
        'pending_artisan_signature',  // expert a signé, en attente de l'artisan (2ème signataire)
        'signed',                     // les deux ont signé ✅
        'completed',
      ],
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
contractSchema.index({ expertId: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
