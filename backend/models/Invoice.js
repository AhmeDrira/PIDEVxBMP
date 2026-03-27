const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Please select a project']
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    default: null
  },
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: [true, 'Please add a client name']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  issueDate: {
    type: Date,
    required: [true, 'Please add an issue date']
  },
  dueDate: {
    type: Date,
    required:[true, 'Please add a due date']
  },
  status: {
    type: String,
    enum:['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  paymentProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  paymentPlan: {
    firstTranchePercent: { type: Number, default: 50, min: 1, max: 99 },
    secondTranchePercent: { type: Number, default: 50, min: 1, max: 99 },
    firstTrancheAmount: { type: Number, default: 0 },
    secondTrancheAmount: { type: Number, default: 0 },
    firstTranchePaid: { type: Boolean, default: false },
    secondTranchePaid: { type: Boolean, default: false },
    firstTranchePaidAt: { type: Date, default: null },
    secondTranchePaidAt: { type: Date, default: null },
    secondTrancheDueDate: { type: Date, default: null },
  },
  paymentSessions: [{
    sessionId: { type: String, required: true },
    phase: { type: String, enum: ['upfront', 'completion'], required: true },
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
  }],
  delivery: {
    status: {
      type: String,
      enum: ['none', 'scheduled', 'in_transit', 'delivered'],
      default: 'none',
    },
    etaDate: { type: Date, default: null },
    timeline: [{
      title: { type: String },
      date: { type: Date },
      status: { type: String, enum: ['done', 'upcoming'], default: 'upcoming' },
    }],
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);