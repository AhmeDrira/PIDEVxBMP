const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  artisanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expertName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Review', reviewSchema);
