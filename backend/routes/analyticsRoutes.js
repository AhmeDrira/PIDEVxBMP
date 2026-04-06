const express = require('express');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { trackMissingProduct } = require('../controllers/analyticsController');

// POST /api/analytics/missing-product
router.post('/missing-product', protect, trackMissingProduct);

module.exports = router;
