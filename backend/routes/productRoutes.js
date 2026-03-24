const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getMarketplaceProducts,
  createProductReview,
  checkoutProducts,
} = require('../controllers/productController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Configuration de l'upload pour accepter deux champs différents
const productUploads = upload.fields([
  { name: 'document', maxCount: 1 },  // Pour l'image du produit
  { name: 'techSheet', maxCount: 1 }  // Pour la fiche technique PDF
]);

// Routes publiques / Marketplace
router.get('/marketplace', getMarketplaceProducts);

// Routes pour les achats et les avis
router.post('/checkout', protect, checkoutProducts);
router.post('/:id/reviews', protect, createProductReview);

// Routes CRUD (Fabricant)
router.route('/')
  .get(protect, getProducts)
  .post(protect, productUploads, createProduct); // productUploads intercepte les fichiers

router.route('/:id')
  .put(protect, productUploads, updateProduct) // productUploads pour la modification
  .delete(protect, deleteProduct);

module.exports = router;