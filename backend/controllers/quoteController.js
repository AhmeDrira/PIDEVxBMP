const Quote = require('../models/Quote');

// @desc    Create a new quote
// @route   POST /api/quotes
const createQuote = async (req, res) => {
  try {
    const { project, amount, description, validUntil, paymentTerms } = req.body;

    if (!project || !amount || !description || !validUntil) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Générer un numéro de devis unique (ex: QT-2026-8452)
    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QT-${currentYear}-${randomCode}`;

    const quote = await Quote.create({
      quoteNumber,
      project,
      artisan: req.user._id,
      amount,
      description,
      validUntil,
      paymentTerms
    });

    res.status(201).json(quote);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating quote' });
  }
};

// @desc    Get all quotes for artisan
// @route   GET /api/quotes
const getQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find({ artisan: req.user._id })
      .populate('project', 'title') // On ramène le titre du projet
      .sort({ createdAt: -1 });
    res.status(200).json(quotes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update quote status (Approved/Rejected)
// @route   PUT /api/quotes/:id/status
const updateQuoteStatus = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    
    quote.status = req.body.status; // 'approved' ou 'rejected'
    await quote.save();
    res.status(200).json(quote);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createQuote, getQuotes, updateQuoteStatus };