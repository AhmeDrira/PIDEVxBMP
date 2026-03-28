const mongoose = require('mongoose');

const productPaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
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
  shippingAmount: {
    type: Number,
    default: 15,
  },
  currency: {
    type: String,
    default: 'TND',
  },
  stripeSessionId: String,
  status: {
    type: String,
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'],
    default: 'pending',
  },
  // Shipping & Contact
  shippingAddress: {
    fullName: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'Tunisia' },
  },
  contactInfo: {
    email: String,
    phone: String,
  },
  shippingMethod: {
    name: { type: String, default: 'Standard Delivery' },
    cost: { type: Number, default: 15 },
    estimatedDays: { type: Number, default: 5 },
  },
  // Delivery timeline events
  deliveryTimeline: { type: [{
    status: String,
    label: String,
    description: String,
    date: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }], default: [] },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
});

// Auto-generate orderNumber before save
productPaymentSchema.pre('save', async function () {
  if (!this.orderNumber && this.isNew) {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `ORD-${year}-${timestamp}${random}`;
  }
});

module.exports = mongoose.model('ProductPayment', productPaymentSchema);
