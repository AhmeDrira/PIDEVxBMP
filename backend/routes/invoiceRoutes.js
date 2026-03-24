const express = require('express');
const router = express.Router();
const {
	createInvoice,
	getInvoices,
	updateInvoiceStatus,
	createInvoiceFromQuote,
	downloadInvoicePdf,
	deleteInvoice,
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createInvoice);
router.post('/from-quote/:quoteId', protect, createInvoiceFromQuote);
router.get('/', protect, getInvoices);
router.get('/:id/pdf', protect, downloadInvoicePdf);
router.put('/:id/status', protect, updateInvoiceStatus);
router.delete('/:id', protect, deleteInvoice);

module.exports = router;