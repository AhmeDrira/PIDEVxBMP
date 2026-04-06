const express = require('express');

const router = express.Router();

const { aiShopper } = require('../controllers/aiShopperController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/recommendations/ai-shopper
router.post('/ai-shopper', protect, aiShopper);

module.exports = router;
