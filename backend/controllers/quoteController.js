const Quote = require('../models/Quote');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { logAction } = require('../utils/actionLogger');
const fs = require('fs');

const resolveChromeExecutablePath = () => {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

// @desc    Create a new quote
// @route   POST /api/quotes
const createQuote = async (req, res) => {
  try {
    const { project, clientName, laborHand, materialsAmount, description, validUntil, paymentTerms } = req.body;

    if (!project || !clientName || !description || !validUntil) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    const parsedLaborHand = Number(laborHand);
    const parsedMaterialsAmount = Number(materialsAmount);

    if (!Number.isFinite(parsedLaborHand) || parsedLaborHand < 0) {
      return res.status(400).json({ message: 'Labor hand must be a valid non-negative number' });
    }

    if (!Number.isFinite(parsedMaterialsAmount) || parsedMaterialsAmount < 0) {
      return res.status(400).json({ message: 'Materials amount must be a valid non-negative number' });
    }

    const amount = parsedLaborHand + parsedMaterialsAmount;

    if (amount <= 0) {
      return res.status(400).json({ message: 'Total amount must be greater than 0' });
    }

    // Générer un numéro de devis unique (ex: QT-2026-8452)
    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QT-${currentYear}-${randomCode}`;

    const quote = await Quote.create({
      quoteNumber,
      project,
      artisan: req.user._id,
      clientName,
      laborHand: parsedLaborHand,
      materialsAmount: parsedMaterialsAmount,
      amount,
      description,
      validUntil,
      paymentTerms
    });

    await logAction(req, {
      actionKey: 'artisan.quote.create',
      actionLabel: 'Generated Quote',
      entityType: 'quote',
      entityId: quote._id,
      description: `Generated quote ${quote.quoteNumber}.`,
      metadata: {
        quoteNumber,
        clientName,
        laborHand: parsedLaborHand,
        materialsAmount: parsedMaterialsAmount,
        amount,
      },
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
      .sort({ createdAt: -1 })
      .lean();

    const linkedInvoices = await Invoice.find({
      artisan: req.user._id,
      quote: { $ne: null },
    })
      .select('quote')
      .lean();

    const invoiceQuoteIds = new Set(
      linkedInvoices
        .map((inv) => String(inv.quote || ''))
        .filter(Boolean)
    );

    const enrichedQuotes = quotes.map((quote) => ({
      ...quote,
      hasInvoice: invoiceQuoteIds.has(String(quote._id)),
    }));

    res.status(200).json(enrichedQuotes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update quote status (Approved/Rejected)
// @route   PUT /api/quotes/:id/status
const updateQuoteStatus = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const quoteId = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(quoteId)) {
      return res.status(400).json({ message: 'Invalid quote id' });
    }

    const nextStatus = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected', 'pending'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid quote status' });
    }

    // Use direct filtered update to avoid legacy doc validation failures and null artisan crashes.
    const updatedQuote = await Quote.findOneAndUpdate(
      { _id: quoteId, artisan: req.user._id },
      { $set: { status: nextStatus } },
      { returnDocument: 'after', runValidators: false }
    ).populate('project', 'title');

    if (!updatedQuote) {
      const exists = await Quote.exists({ _id: quoteId });
      return exists
        ? res.status(403).json({ message: 'Not authorized' })
        : res.status(404).json({ message: 'Quote not found' });
    }

    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error('updateQuoteStatus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Download quote as styled PDF
// @route   GET /api/quotes/:id/pdf
const downloadQuotePdf = async (req, res) => {
  let browser;
  try {
    let puppeteer;
    try {
      puppeteer = require('puppeteer-core');
    } catch (dependencyError) {
      return res.status(500).json({
        message: 'PDF dependency missing. Please run npm install in backend to enable Puppeteer PDF.',
      });
    }

    const quote = await Quote.findById(req.params.id)
      .populate('project', 'title')
      .populate('artisan', 'firstName lastName email');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.artisan && quote.artisan._id && quote.artisan._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this quote' });
    }

    const createdOn = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-GB') : 'N/A';
    const validUntil = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : 'N/A';
    const laborHand = Number(quote.laborHand || 0);
    const materialsAmount = Number(quote.materialsAmount || 0);
    const total = Number(quote.amount || 0);

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
          .page { padding: 32px; }
          .card { background: #ffffff; border-radius: 20px; padding: 28px; border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
          .title { font-size: 44px; font-weight: 800; color: #1d4ed8; margin: 0; letter-spacing: 1px; }
          .number { margin-top: 8px; color: #64748b; font-size: 18px; }
          .brand { text-align: right; }
          .brand h3 { margin: 0; font-size: 28px; color: #0f172a; }
          .brand p { margin: 4px 0 0; color: #64748b; }
          .badge { display: inline-block; margin-top: 10px; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: #fef3c7; color: #b45309; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
          .label { font-size: 13px; color: #64748b; margin-bottom: 6px; }
          .value { font-size: 20px; font-weight: 700; color: #0f172a; }
          .section { margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #f8fafc; }
          .section h4 { margin: 0 0 10px; font-size: 16px; }
          .section p { margin: 0; color: #475569; line-height: 1.5; white-space: pre-wrap; }
          .totals { margin-top: 24px; border-top: 2px solid #e2e8f0; padding-top: 16px; display: grid; gap: 10px; }
          .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; }
          .row.total { background: #1d4ed8; color: #ffffff; border-color: #1d4ed8; font-size: 22px; font-weight: 800; }
          .footer { margin-top: 20px; color: #64748b; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="card">
            <div class="header">
              <div>
                <h1 class="title">QUOTE</h1>
                <div class="number">${quote.quoteNumber}</div>
              </div>
              <div class="brand">
                <h3>BMP Marketplace</h3>
                <p>Digital Construction Platform</p>
                <span class="badge">${String(quote.status || 'pending').toUpperCase()}</span>
              </div>
            </div>

            <div class="grid">
              <div>
                <div class="label">Project</div>
                <div class="value">${quote.project?.title || 'Unknown Project'}</div>
              </div>
              <div>
                <div class="label">Client</div>
                <div class="value">${quote.clientName || 'N/A'}</div>
              </div>
              <div>
                <div class="label">Created On</div>
                <div class="value">${createdOn}</div>
              </div>
              <div>
                <div class="label">Valid Until</div>
                <div class="value">${validUntil}</div>
              </div>
            </div>

            <div class="section">
              <h4>Description of Work / Items</h4>
              <p>${quote.description || ''}</p>
            </div>

            ${quote.paymentTerms ? `<div class="section"><h4>Payment Terms</h4><p>${quote.paymentTerms}</p></div>` : ''}

            <div class="totals">
              <div class="row"><span>Labor hand</span><strong>${laborHand.toLocaleString()} TND</strong></div>
              <div class="row"><span>Materials</span><strong>${materialsAmount.toLocaleString()} TND</strong></div>
              <div class="row total"><span>Total</span><strong>${total.toLocaleString()} TND</strong></div>
            </div>

            <div class="footer">Generated by BMP Marketplace</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const executablePath = resolveChromeExecutablePath();
    if (!executablePath) {
      return res.status(500).json({
        message: 'No Chrome/Edge executable found for PDF generation. Set CHROME_PATH in backend .env',
      });
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while generating quote PDF' });
  } finally {
    if (browser) await browser.close();
  }
};

// @desc    Delete a quote
// @route   DELETE /api/quotes/:id
const deleteQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const linkedInvoice = await Invoice.findOne({ quote: quote._id }).select('_id invoiceNumber');
    if (linkedInvoice) {
      return res.status(400).json({
        message: `Cannot delete quote ${quote.quoteNumber} because it is linked to invoice ${linkedInvoice.invoiceNumber}.`,
      });
    }

    const quoteNumber = quote.quoteNumber;
    await quote.deleteOne();

    await logAction(req, {
      actionKey: 'artisan.quote.delete',
      actionLabel: 'Deleted Quote',
      entityType: 'quote',
      entityId: quote._id,
      description: `Deleted quote ${quoteNumber}.`,
      metadata: {
        quoteNumber,
      },
    });

    return res.status(200).json({ message: `Quote ${quoteNumber} deleted successfully` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while deleting quote' });
  }
};

module.exports = { createQuote, getQuotes, updateQuoteStatus, downloadQuotePdf, deleteQuote };