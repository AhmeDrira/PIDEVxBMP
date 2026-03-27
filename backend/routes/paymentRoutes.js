const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  createCheckoutSession, 
  createSubscriptionSession, 
  verifySubscription, 
  getSubscriptionHistory, 
  cancelSubscription,
  verifyCheckout,
  getProductPayments,
  downloadProductPaymentPdf
} = require('../controllers/paymentController');

router.post('/checkout', protect, createCheckoutSession);
router.get('/checkout/verify', protect, verifyCheckout);
router.get('/product-payments', protect, getProductPayments);
router.get('/product-payments/:id/pdf', protect, downloadProductPaymentPdf);
router.post('/subscription', protect, createSubscriptionSession);
router.get('/subscription/verify', protect, verifySubscription);
router.get('/subscription/history', protect, getSubscriptionHistory);
router.post('/subscription/cancel', protect, cancelSubscription);

module.exports = router;

