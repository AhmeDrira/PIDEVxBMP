const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  artisan: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expert: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', trim: true },
}, { timestamps: true });

// One review per expert per artisan
reviewSchema.index({ artisan: 1, expert: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
