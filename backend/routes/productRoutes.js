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
  createStripeCheckoutSession,
  confirmStripeCheckoutSession,
  ensureStaticProduct, // <--- C'EST ICI QU'ELLE MANQUAIT ! 🚨
  getManufacturerOrders,
  updateOrderStatus,
  getManufacturerAnalytics,
} = require('../controllers/productController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Configuration de l'upload pour accepter deux champs différents
const productUploads = upload.fields([
  { name: 'document', maxCount: 1 }, // Pour l'image du produit
  { name: 'techSheet', maxCount: 1 } // Pour la fiche technique PDF
]);

// ---> NOUVELLES ROUTES POUR LA MARKETPLACE
router.get('/marketplace', protect, getMarketplaceProducts);
router.post('/ensure-static', protect, ensureStaticProduct);

// Routes pour les achats et les avis
router.get('/analytics', protect, getManufacturerAnalytics);
router.get('/orders', protect, getManufacturerOrders);
router.put('/orders/:id/status', protect, updateOrderStatus);
router.post('/checkout/create-session', protect, createStripeCheckoutSession);
router.post('/checkout/confirm-session', protect, confirmStripeCheckoutSession);
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