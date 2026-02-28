const express = require('express');
const router = express.Router();
const { createInvoice, getInvoices, updateInvoiceStatus } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createInvoice);
router.get('/', protect, getInvoices);
router.put('/:id/status', protect, updateInvoiceStatus);

module.exports = router;