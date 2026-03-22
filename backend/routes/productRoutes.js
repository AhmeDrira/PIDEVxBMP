const express = require('express');
const router = express.Router();
const { createProduct, getProducts, updateProduct, deleteProduct, getMarketplaceProducts, createProductReview, checkoutProducts } = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

// ---> NOUVELLES ROUTES POUR LA MARKETPLACE
router.get('/marketplace', protect, getMarketplaceProducts);
router.post('/:id/reviews', protect, createProductReview);
router.post('/checkout', protect, checkoutProducts);

// Anciennes routes
router.route('/')
  .post(protect, createProduct)
  .get(protect, getProducts);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

module.exports = router;