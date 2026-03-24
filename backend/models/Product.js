const mongoose = require('mongoose');

// Sous-schéma pour les avis (reviews)
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true },
  comment: { type: String }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'low-stock', 'out-of-stock'], default: 'active' },
  manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // --- DOCUMENTS ET FICHIERS ---
  documentUrl: { type: String, default: '' }, // L'image principale (uploadée)
  techSheetUrl: { type: String, default: '' }, // LA CORRECTION : Le chemin vers le PDF technique
  
  // --- CHAMPS POUR LA MARKETPLACE ---
  image: { type: String, default: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBrw3v8qGtHADl_B9kBzi3BapmKcOqpWcntg&s' },
  reviews: [reviewSchema], 
  rating: { type: Number, default: 0 }, 
  numReviews: { type: Number, default: 0 } 
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);