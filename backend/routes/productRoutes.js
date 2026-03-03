const express = require('express');
const router = express.Router();
const { createProduct, getProducts, updateProduct, deleteProduct, getMarketplaceProducts, createProductReview } = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

// ---> NOUVELLES ROUTES POUR LA MARKETPLACE
router.get('/marketplace', protect, getMarketplaceProducts);
router.post('/:id/reviews', protect, createProductReview);

// Anciennes routes
router.route('/')
  .post(protect, createProduct)
  .get(protect, getProducts);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

module.exports = router;