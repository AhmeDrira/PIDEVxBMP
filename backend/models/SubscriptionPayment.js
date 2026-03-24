const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  planId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: ['paid', 'failed', 'pending'],
    default: 'paid',
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
