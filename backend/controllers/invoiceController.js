const Invoice = require('../models/Invoice');

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private (Artisan only)
const createInvoice = async (req, res) => {
  try {
    const { project, clientName, amount, description, issueDate, dueDate } = req.body;

    if (!project || !clientName || !amount || !description || !issueDate || !dueDate) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    // Générer un numéro de facture unique (ex: INV-2026-4589)
    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${currentYear}-${randomCode}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      project,
      artisan: req.user._id,
      clientName,
      amount,
      description,
      issueDate,
      dueDate
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating invoice' });
  }
};

// @desc    Get all invoices for artisan
// @route   GET /api/invoices
const getInvoices = async (req, res) => {
  try {
    // On récupère les factures ET on "populate" le projet pour avoir son Titre
    const invoices = await Invoice.find({ artisan: req.user._id })
      .populate('project', 'title')
      .sort({ createdAt: -1 });
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update invoice status (Mark as Paid)
// @route   PUT /api/invoices/:id/status
const updateInvoiceStatus = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    invoice.status = req.body.status; // 'paid'
    await invoice.save();
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createInvoice, getInvoices, updateInvoiceStatus };