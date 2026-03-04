const express = require('express');
const router = express.Router();
const { createQuote, getQuotes, updateQuoteStatus } = require('../controllers/quoteController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createQuote);
router.get('/', protect, getQuotes);
router.put('/:id/status', protect, updateQuoteStatus);

module.exports = router;