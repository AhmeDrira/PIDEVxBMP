// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name']
  },
  category: {
    type: String,
    required: [true, 'Please select a category']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price']
  },
  stock: {
    type: Number,
    required: [true, 'Please add stock quantity']
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'low-stock', 'out-of-stock'],
    default: 'active'
  },
  // Relie le produit au Manufacturer qui l'a créé
  manufacturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentUrl: {
    type: String, // Pour le futur upload de document technique
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);