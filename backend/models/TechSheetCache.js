const mongoose = require('mongoose');

/**
 * Cache for PDF tech-sheet analysis results.
 * Keyed by productId; invalidated when techSheetUrl changes.
 */
const techSheetCacheSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    unique: true,
    index: true,
  },
  techSheetUrl: { type: String, default: '' }, // snapshot of URL at analysis time → detect changes
  extractedText: { type: String, default: '' },
  profile: {
    norms:          { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    resistance:     { type: [String], default: [] },
    dimensions:     { type: [String], default: [] },
    environment:    { type: [String], default: [] },
    safety:         { type: [String], default: [] },
    materials:      { type: [String], default: [] },
    keywords:       { type: [String], default: [] },
  },
  /** 0-1 extraction confidence based on text quality & entity richness */
  confidence: { type: Number, default: 0 },
  /** true when extraction succeeded; false on error/empty */
  success: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  analyzedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('TechSheetCache', techSheetCacheSchema);
