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
  documentUrl: { type: String, default: '' },
  
  // --- NOUVEAUX CHAMPS POUR LA MARKETPLACE ---
  image: { type: String, default: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBrw3v8qGtHADl_B9kBzi3BapmKcOqpWcntg&s' },
  reviews: [reviewSchema], // Tableau des avis
  rating: { type: Number, default: 0 }, // Moyenne des étoiles
  numReviews: { type: Number, default: 0 } // Nombre total de votes
}, { timestamps: true });

productSchema.pre('save', function(next) {
  if (this.stock === 0) this.status = 'out-of-stock';
  else if (this.stock <= 10) this.status = 'low-stock';
  else this.status = 'active';
  next();
});

module.exports = mongoose.model('Product', productSchema);