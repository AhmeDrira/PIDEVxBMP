const express = require('express');
const router = express.Router();
const {
	generateQuoteDraft,
	createQuote,
	getQuotes,
	updateQuoteStatus,
	downloadQuotePdf,
	deleteQuote,
} = require('../controllers/quoteController');
const { protect } = require('../middleware/authMiddleware');

router.post('/ai-draft', protect, generateQuoteDraft);
router.post('/', protect, createQuote);
router.get('/', protect, getQuotes);
router.get('/:id/pdf', protect, downloadQuotePdf);
router.put('/:id/status', protect, updateQuoteStatus);
router.delete('/:id', protect, deleteQuote);

module.exports = router;