const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createCheckoutSession, createSubscriptionSession, verifySubscription, getSubscriptionHistory, cancelSubscription } = require('../controllers/paymentController');

router.post('/checkout', protect, createCheckoutSession);
router.post('/subscription', protect, createSubscriptionSession);
router.get('/subscription/verify', protect, verifySubscription);
router.get('/subscription/history', protect, getSubscriptionHistory);
router.post('/subscription/cancel', protect, cancelSubscription);

module.exports = router;

