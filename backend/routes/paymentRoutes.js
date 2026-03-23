const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createCheckoutSession } = require('../controllers/paymentController');

router.post('/checkout', protect, createCheckoutSession);

module.exports = router;

