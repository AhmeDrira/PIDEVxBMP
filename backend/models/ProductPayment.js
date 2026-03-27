const mongoose = require('mongoose');

const productPaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    manufacturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: String,
    quantity: Number,
    price: Number,
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'TND',
  },
  stripeSessionId: String,
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'shipped', 'delivered'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ProductPayment', productPaymentSchema);
