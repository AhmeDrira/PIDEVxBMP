const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Please select a project']
  },
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: [true, 'Please add a client name'],
    trim: true
  },
  laborHand: {
    type: Number,
    required: [true, 'Please add labor hand amount'],
    min: 0,
    default: 0
  },
  materialsAmount: {
    type: Number,
    required: [true, 'Please add materials amount'],
    min: 0,
    default: 0
  },
  amount: {
    type: Number,
    required:[true, 'Please add an estimated amount'],
    min: 0,
    default: 0
  },
  description: {
    type: String,
    required:[true, 'Please add a description']
  },
  validUntil: {
    type: Date,
    required: [true, 'Please add a validity date']
  },
  paymentTerms: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum:['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true // Gère createdAt automatiquement
});

module.exports = mongoose.model('Quote', quoteSchema);