const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
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

    await logAction(req, {
      actionKey: 'artisan.invoice.create',
      actionLabel: 'Generated Invoice',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `Generated invoice ${invoice.invoiceNumber}.`,
      metadata: {
        invoiceNumber,
        amount,
        clientName,
      },
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

// @desc    Create invoice from an approved quote
// @route   POST /api/invoices/from-quote/:quoteId
const createInvoiceFromQuote = async (req, res) => {
  try {
    const { dueDate } = req.body;
    if (!dueDate) {
      return res.status(400).json({ message: 'Due date is required' });
    }

    const quote = await Quote.findById(req.params.quoteId).populate('project', 'title');
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (quote.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved quotes can generate invoices' });
    }

    const existingInvoice = await Invoice.findOne({ quote: quote._id });
    if (existingInvoice) {
      return res.status(409).json({ message: 'Invoice already exists for this quote', invoice: existingInvoice });
    }

    const issueDate = new Date();

    // Parse YYYY-MM-DD as local calendar date to avoid timezone edge cases.
    let parsedDueDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate))) {
      const [year, month, day] = String(dueDate).split('-').map(Number);
      parsedDueDate = new Date(year, month - 1, day);
    } else {
      parsedDueDate = new Date(dueDate);
    }

    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: 'Invalid due date' });
    }

    const issueDateOnly = new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate());
    if (parsedDueDate < issueDateOnly) {
      return res.status(400).json({ message: 'Due date cannot be in the past' });
    }

    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${currentYear}-${randomCode}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      quote: quote._id,
      project: quote.project?._id || quote.project,
      artisan: req.user._id,
      clientName: quote.clientName || 'Client',
      amount: quote.amount,
      description: `Invoice generated from quote ${quote.quoteNumber}.\n\n${quote.description || ''}`,
      issueDate,
      dueDate: parsedDueDate,
    });

    await logAction(req, {
      actionKey: 'artisan.invoice.create.from_quote',
      actionLabel: 'Generated Invoice From Quote',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `Generated invoice ${invoice.invoiceNumber} from quote ${quote.quoteNumber}.`,
      metadata: {
        invoiceNumber,
        quoteNumber: quote.quoteNumber,
        amount: invoice.amount,
      },
    });

    return res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while creating invoice from quote' });
  }
};

// @desc    Download invoice as styled PDF
// @route   GET /api/invoices/:id/pdf
const downloadInvoicePdf = async (req, res) => {
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

    const invoice = await Invoice.findById(req.params.id)
      .populate('project', 'title')
      .populate('artisan', 'firstName lastName email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.artisan && invoice.artisan._id && invoice.artisan._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this invoice' });
    }

    const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-GB') : 'N/A';
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A';
    const total = Number(invoice.amount || 0);

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
                <h1 class="title">INVOICE</h1>
                <div class="number">${invoice.invoiceNumber}</div>
              </div>
              <div class="brand">
                <h3>BMP Marketplace</h3>
                <p>Digital Construction Platform</p>
                <span class="badge">${String(invoice.status || 'pending').toUpperCase()}</span>
              </div>
            </div>

            <div class="grid">
              <div>
                <div class="label">Project</div>
                <div class="value">${invoice.project?.title || 'Unknown Project'}</div>
              </div>
              <div>
                <div class="label">Client</div>
                <div class="value">${invoice.clientName || 'N/A'}</div>
              </div>
              <div>
                <div class="label">Issue Date</div>
                <div class="value">${issueDate}</div>
              </div>
              <div>
                <div class="label">Due Date</div>
                <div class="value">${dueDate}</div>
              </div>
            </div>

            <div class="section">
              <h4>Description of Work / Items</h4>
              <p>${invoice.description || ''}</p>
            </div>

            <div class="totals">
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
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while generating invoice PDF' });
  } finally {
    if (browser) await browser.close();
  }
};

// @desc    Delete an invoice
// @route   DELETE /api/invoices/:id
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const invoiceNumber = invoice.invoiceNumber;
    await invoice.deleteOne();

    await logAction(req, {
      actionKey: 'artisan.invoice.delete',
      actionLabel: 'Deleted Invoice',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `Deleted invoice ${invoiceNumber}.`,
      metadata: {
        invoiceNumber,
      },
    });

    return res.status(200).json({ message: `Invoice ${invoiceNumber} deleted successfully` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while deleting invoice' });
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  updateInvoiceStatus,
  createInvoiceFromQuote,
  downloadInvoicePdf,
  deleteInvoice,
};