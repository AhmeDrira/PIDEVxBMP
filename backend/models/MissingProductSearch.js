const mongoose = require('mongoose');

const missingProductSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    suggestedBrand: {
      type: String,
      default: '',
      trim: true,
    },
    searchKeyword: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      default: 'ai-shopper',
      trim: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

missingProductSearchSchema.index({ normalizedName: 1, clickedAt: -1 });
missingProductSearchSchema.index({ user: 1, clickedAt: -1 });

module.exports = mongoose.model('MissingProductSearch', missingProductSearchSchema);
