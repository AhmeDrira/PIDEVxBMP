const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/actionLogger');
const fs = require('fs');

let stripeClient = null;

const getStripeClient = () => {
  if (stripeClient) return stripeClient;
  const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.Stripe_Secret_key;
  if (!stripeSecret) {
    throw new Error('Stripe secret key is missing. Set STRIPE_SECRET_KEY in backend .env');
  }
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  stripeClient = new Stripe(stripeSecret);
  return stripeClient;
};

const getStripeCurrencyConfig = () => {
  const currency = String(process.env.STRIPE_CURRENCY || 'usd').trim().toLowerCase();
  const minorUnit = currency === 'tnd' ? 1000 : 100;
  return { currency, minorUnit };
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const normalizeInvoicePaymentFields = (invoice) => {
  if (!invoice.paymentPlan) {
    invoice.paymentPlan = {};
  }

  if (!Number.isFinite(Number(invoice.paymentPlan.firstTranchePercent))) {
    invoice.paymentPlan.firstTranchePercent = 50;
  }

  const firstPercent = Number(invoice.paymentPlan.firstTranchePercent);
  const secondPercent = 100 - firstPercent;
  invoice.paymentPlan.secondTranchePercent = secondPercent;

  const firstAmount = roundMoney((Number(invoice.amount || 0) * firstPercent) / 100);
  const secondAmount = roundMoney(Number(invoice.amount || 0) - firstAmount);

  invoice.paymentPlan.firstTrancheAmount = firstAmount;
  invoice.paymentPlan.secondTrancheAmount = secondAmount;

  if (!Number.isFinite(Number(invoice.paidAmount))) {
    invoice.paidAmount = 0;
  }

  if (invoice.status === 'paid' && Number(invoice.paidAmount || 0) <= 0) {
    invoice.paidAmount = Number(invoice.amount || 0);
  }

  invoice.paymentProgress = Number(invoice.amount || 0) > 0
    ? Math.min(100, Math.round((Number(invoice.paidAmount || 0) / Number(invoice.amount || 0)) * 100))
    : 0;

  if (!invoice.delivery) {
    invoice.delivery = { status: 'none', etaDate: null, timeline: [] };
  }

  if (!Array.isArray(invoice.paymentSessions)) {
    invoice.paymentSessions = [];
  }
};

const buildDeliveryTimeline = (fromDate = new Date()) => {
  const day2 = new Date(fromDate);
  day2.setDate(day2.getDate() + 2);
  const day5 = new Date(fromDate);
  day5.setDate(day5.getDate() + 5);
  const day7 = new Date(fromDate);
  day7.setDate(day7.getDate() + 7);

  return {
    etaDate: day7,
    timeline: [
      { title: 'Order confirmed', date: fromDate, status: 'done' },
      { title: 'Preparing shipment', date: day2, status: 'upcoming' },
      { title: 'In transit', date: day5, status: 'upcoming' },
      { title: 'Delivery deadline', date: day7, status: 'upcoming' },
    ],
  };
};

const phaseAmount = (invoice, phase) => {
  normalizeInvoicePaymentFields(invoice);
  return phase === 'upfront'
    ? Number(invoice.paymentPlan.firstTrancheAmount || 0)
    : Number(invoice.paymentPlan.secondTrancheAmount || 0);
};

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

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const extractProjectMaterialItems = (project) => {
  const groupedMarketplace = Array.isArray(project?.materials)
    ? Object.values(
        project.materials.reduce((acc, mat) => {
          const id = String((mat && (mat._id || mat)) || '');
          if (!id) return acc;
          if (!acc[id]) {
            acc[id] = {
              name: mat?.name || 'Marketplace material',
              quantity: 0,
              unitPrice: Number(mat?.price) || 0,
              source: 'Marketplace',
            };
          }
          acc[id].quantity += 1;
          return acc;
        }, {})
      )
    : [];

  const personalItems = Array.isArray(project?.personalMaterials)
    ? project.personalMaterials
      .filter((item) => item && item.name)
      .map((item) => {
        const quantity = Number(item?.stock);
        return {
          name: item.name,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unitPrice: Number(item?.price) || 0,
          source: 'Personal',
        };
      })
    : [];

  return [...groupedMarketplace, ...personalItems];
};

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private (Artisan only)
const createInvoice = async (req, res) => {
  try {
    const { project, clientName, amount, description, issueDate, dueDate, upfrontPercent } = req.body;

    if (!project || !clientName || !amount || !description || !issueDate || !dueDate) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    const firstPct = Math.min(99, Math.max(1, Number(upfrontPercent) || 50));
    const secondPct = 100 - firstPct;

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
      dueDate,
      paidAmount: 0,
      paymentProgress: 0,
      paymentPlan: {
        firstTranchePercent: firstPct,
        secondTranchePercent: secondPct,
        firstTranchePaid: false,
        secondTranchePaid: false,
      },
      delivery: {
        status: 'none',
        timeline: [],
      },
    });

    normalizeInvoicePaymentFields(invoice);
    await invoice.save();

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
    const invoices = await Invoice.find({ artisan: req.user._id })
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    // Normalize payment fields so the frontend always sees correct tranche amounts
    invoices.forEach((inv) => normalizeInvoicePaymentFields(inv));

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
      paidAmount: 0,
      paymentProgress: 0,
      paymentPlan: {
        firstTranchePercent: Number(quote.upfrontPercent) || 50,
        secondTranchePercent: 100 - (Number(quote.upfrontPercent) || 50),
        firstTranchePaid: false,
        secondTranchePaid: false,
      },
      delivery: {
        status: 'none',
        timeline: [],
      },
    });

    normalizeInvoicePaymentFields(invoice);
    await invoice.save();

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
      .populate({
        path: 'project',
        select: 'title materials personalMaterials',
        populate: {
          path: 'materials',
          select: 'name price',
        },
      })
      .populate('artisan', 'firstName lastName email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.artisan && invoice.artisan._id && invoice.artisan._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this invoice' });
    }

    const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('fr-FR') : 'N/A';
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : 'N/A';
    const total = Number(invoice.amount || 0);
    const TVA_RATE = 0.19;
    const totalHT = +(total / (1 + TVA_RATE)).toFixed(2);
    const totalTVA = +(total - totalHT).toFixed(2);
    const totalTTC = total;
    const materialItems = extractProjectMaterialItems(invoice.project);
    const materialRowsHtml = materialItems.map((item) => {
      const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
      return `<div class="material-row">
        <span>${escapeHtml(item.name)} <small>(${escapeHtml(item.source)})</small></span>
        <strong>x${item.quantity} - ${lineTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND</strong>
      </div>`;
    }).join('');

    const artisanName = invoice.artisan ? `${invoice.artisan.firstName || ''} ${invoice.artisan.lastName || ''}`.trim() : 'N/A';
    const artisanEmail = invoice.artisan?.email || '';

    const statusLabels = { pending: 'EN ATTENTE', paid: 'PAYÉE', overdue: 'EN RETARD' };
    const statusColors = { pending: { bg: '#fef3c7', color: '#b45309' }, paid: { bg: '#d1fae5', color: '#065f46' }, overdue: { bg: '#fee2e2', color: '#991b1b' } };
    const sBadge = statusColors[invoice.status] || statusColors.pending;

    const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Payment plan info
    const pp = invoice.paymentPlan || {};
    const hasPaymentPlan = pp.firstTrancheAmount > 0 || pp.secondTrancheAmount > 0;

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; }
          .page { padding: 40px; }

          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .header-left h1 { font-size: 36px; font-weight: 800; color: #1d4ed8; margin-bottom: 4px; text-decoration: underline; text-underline-offset: 6px; }
          .logo-circle { width: 60px; height: 60px; background: #e8edf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; font-weight: 600; }

          /* Parties */
          .parties { display: flex; gap: 40px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
          .party { flex: 1; }
          .party-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          .party-name { font-size: 15px; font-weight: 700; color: #0f172a; }
          .party-detail { font-size: 12px; color: #475569; line-height: 1.6; }

          /* Invoice meta */
          .meta-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
          .meta-item .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
          .meta-item .meta-value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 3px; }

          /* Status badge */
          .badge { display: inline-block; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; }

          /* Additional info */
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
          .info-box .info-label { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
          .info-box p { font-size: 12px; color: #475569; line-height: 1.6; white-space: pre-wrap; }
          .materials-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
          .materials-box .info-label { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
          .material-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .material-row:last-child { border-bottom: none; }
          .material-row small { color: #64748b; font-weight: 600; }

          /* Items table */
          table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
          thead th { background: #1d4ed8; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 10px 12px; text-align: left; }
          thead th:first-child { border-radius: 6px 0 0 0; }
          thead th:last-child { border-radius: 0 6px 0 0; text-align: right; }
          thead th.right { text-align: right; }
          thead th.center { text-align: center; }
          tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #1a1a1a; }
          tbody td.right { text-align: right; }
          tbody td.center { text-align: center; }
          tbody tr:last-child td { border-bottom: none; }

          /* Totals */
          .totals-section { display: flex; justify-content: flex-end; margin-top: 0; }
          .totals-table { width: 280px; }
          .totals-table .trow { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
          .totals-table .trow .tlabel { color: #475569; font-weight: 600; }
          .totals-table .trow .tvalue { color: #0f172a; font-weight: 700; }
          .totals-table .trow.ttc { background: #1d4ed8; color: #fff; border-radius: 0 0 6px 6px; border-bottom: none; }
          .totals-table .trow.ttc .tlabel, .totals-table .trow.ttc .tvalue { color: #fff; font-weight: 800; font-size: 14px; }

          /* Payment plan */
          .payment-plan { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; }
          .payment-plan h4 { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
          .tranche { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
          .tranche:last-child { border-bottom: none; }
          .tranche-label { color: #475569; }
          .tranche-amount { font-weight: 700; color: #0f172a; }
          .tranche-status { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
          .tranche-paid { background: #d1fae5; color: #065f46; }
          .tranche-unpaid { background: #fee2e2; color: #991b1b; }

          /* Footer */
          .footer-bar { margin-top: 40px; padding-top: 16px; border-top: 2px solid #1d4ed8; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
          .footer-bar .col { line-height: 1.7; }
          .footer-bar .col-title { font-weight: 700; color: #0f172a; font-size: 11px; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="header-left">
              <h1>Facture</h1>
            </div>
            <div class="logo-circle">Logo</div>
          </div>

          <!-- Parties: Vendor / Client -->
          <div class="parties">
            <div class="party">
              <div class="party-label">Vendeur</div>
              <div class="party-name">${artisanName}</div>
              <div class="party-detail">${artisanEmail}</div>
            </div>
            <div class="party">
              <div class="party-label">Client</div>
              <div class="party-name">${invoice.clientName || 'N/A'}</div>
            </div>
          </div>

          <!-- Invoice Meta -->
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Date de facturation</div>
              <div class="meta-value">${issueDate}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">N° de facture</div>
              <div class="meta-value">${invoice.invoiceNumber}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Échéance</div>
              <div class="meta-value">${dueDate}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Paiement</div>
              <div class="meta-value">30 jours</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Statut</div>
              <div class="meta-value"><span class="badge" style="background:${sBadge.bg};color:${sBadge.color}">${statusLabels[invoice.status] || 'EN ATTENTE'}</span></div>
            </div>
          </div>

          <!-- Description -->
          <div class="info-box">
            <div class="info-label">Description des travaux</div>
            <p>${escapeHtml(invoice.description || '—')}</p>
          </div>

          ${materialItems.length > 0 ? `<div class="materials-box"><div class="info-label">Matériaux inclus</div>${materialRowsHtml}</div>` : ''}

          <!-- Items Table -->
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="center">Qté</th>
                <th class="right">Prix unitaire HT</th>
                <th class="center">% TVA</th>
                <th class="right">Total TVA</th>
                <th class="right">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${invoice.project?.title || 'Prestation de service'}</td>
                <td class="center">1</td>
                <td class="right">${fmt(totalHT)} TND</td>
                <td class="center">19 %</td>
                <td class="right">${fmt(totalTVA)} TND</td>
                <td class="right">${fmt(totalTTC)} TND</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-table">
              <div class="trow">
                <span class="tlabel">Total HT</span>
                <span class="tvalue">${fmt(totalHT)} TND</span>
              </div>
              <div class="trow">
                <span class="tlabel">Total TVA (19%)</span>
                <span class="tvalue">${fmt(totalTVA)} TND</span>
              </div>
              <div class="trow ttc">
                <span class="tlabel">Total TTC</span>
                <span class="tvalue">${fmt(totalTTC)} TND</span>
              </div>
            </div>
          </div>

          ${hasPaymentPlan ? `
          <!-- Payment Plan -->
          <div class="payment-plan">
            <h4>Plan de paiement</h4>
            <div class="tranche">
              <span class="tranche-label">Acompte (${pp.firstTranchePercent || 50}%)</span>
              <span class="tranche-amount">${fmt(pp.firstTrancheAmount || 0)} TND</span>
              <span class="tranche-status ${pp.firstTranchePaid ? 'tranche-paid' : 'tranche-unpaid'}">${pp.firstTranchePaid ? 'Payé' : 'Non payé'}</span>
            </div>
            <div class="tranche">
              <span class="tranche-label">Solde (${pp.secondTranchePercent || 50}%)</span>
              <span class="tranche-amount">${fmt(pp.secondTrancheAmount || 0)} TND</span>
              <span class="tranche-status ${pp.secondTranchePaid ? 'tranche-paid' : 'tranche-unpaid'}">${pp.secondTranchePaid ? 'Payé' : 'Non payé'}</span>
            </div>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer-bar">
            <div class="col">
              <div class="col-title">BMP Marketplace</div>
              Plateforme numérique de construction<br/>
              Tunisie
            </div>
            <div class="col">
              <div class="col-title">Coordonnées</div>
              Email : support@bmp.tn<br/>
              Tél : +216 70 000 000<br/>
              www.bmp.tn
            </div>
            <div class="col">
              <div class="col-title">Détails</div>
              Facture générée automatiquement<br/>
              TVA : 19%
            </div>
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

// @desc    Create Stripe session for invoice installment payment
// @route   POST /api/invoices/:id/create-payment-session
const createInvoicePaymentSession = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project', 'title');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const phase = String(req.body?.phase || '').trim();
    if (!['upfront', 'completion'].includes(phase)) {
      return res.status(400).json({ message: 'Invalid phase. Use upfront or completion.' });
    }

    normalizeInvoicePaymentFields(invoice);

    if (phase === 'upfront' && invoice.paymentPlan.firstTranchePaid) {
      return res.status(400).json({ message: 'Upfront tranche already paid.' });
    }

    if (phase === 'completion' && !invoice.paymentPlan.firstTranchePaid) {
      return res.status(400).json({ message: 'Upfront tranche must be paid first.' });
    }

    if (phase === 'completion' && invoice.paymentPlan.secondTranchePaid) {
      return res.status(400).json({ message: 'Completion tranche already paid.' });
    }

    const amount = phaseAmount(invoice, phase);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid installment amount.' });
    }

    const { currency, minorUnit } = getStripeCurrencyConfig();
    const stripe = getStripeClient();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${invoice.invoiceNumber} - ${phase === 'upfront' ? 'Upfront Tranche' : 'Upon Completion Tranche'}`,
            },
            unit_amount: Math.round(amount * minorUnit),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/?artisanView=invoices&invoicePayment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?artisanView=invoices&invoicePayment=cancel`,
      metadata: {
        invoiceId: String(invoice._id),
        phase,
        userId: String(req.user._id),
      },
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
      amount,
      phase,
    });
  } catch (error) {
    console.error('createInvoicePaymentSession error:', error);
    return res.status(500).json({ message: 'Failed to initialize invoice payment', error: error.message });
  }
};

// @desc    Confirm Stripe invoice installment payment
// @route   POST /api/invoices/confirm-payment-session
const confirmInvoicePaymentSession = async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Stripe payment is not completed' });
    }

    const invoiceId = String(session?.metadata?.invoiceId || '').trim();
    const phase = String(session?.metadata?.phase || '').trim();
    if (!invoiceId || !['upfront', 'completion'].includes(phase)) {
      return res.status(400).json({ message: 'Invalid Stripe metadata for invoice payment.' });
    }

    const invoice = await Invoice.findById(invoiceId).populate('project', 'title');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    normalizeInvoicePaymentFields(invoice);

    const alreadyProcessed = invoice.paymentSessions.some((s) => s.sessionId === sessionId);
    if (alreadyProcessed) {
      return res.status(200).json({ message: 'Payment already processed', invoice });
    }

    const amount = phaseAmount(invoice, phase);
    invoice.paymentSessions.push({ sessionId, phase, amount, paidAt: new Date() });
    invoice.paidAmount = roundMoney(Number(invoice.paidAmount || 0) + amount);

    if (phase === 'upfront') {
      invoice.paymentPlan.firstTranchePaid = true;
      invoice.paymentPlan.firstTranchePaidAt = new Date();

      const secondDue = new Date();
      secondDue.setDate(secondDue.getDate() + 14);
      invoice.paymentPlan.secondTrancheDueDate = secondDue;

      await Notification.create({
        type: 'invoice_second_tranche_due',
        title: 'Second Tranche Deadline Scheduled',
        message: `Second tranche for ${invoice.invoiceNumber} is due by ${secondDue.toLocaleDateString('en-GB')}.`,
        recipient: req.user._id,
        recipientRole: 'artisan',
        icon: 'Clock3',
        metadata: {
          invoiceId: String(invoice._id),
          dueDate: secondDue,
        },
      });
    }

    if (phase === 'completion') {
      invoice.paymentPlan.secondTranchePaid = true;
      invoice.paymentPlan.secondTranchePaidAt = new Date();
    }

    invoice.paymentProgress = Number(invoice.amount || 0) > 0
      ? Math.min(100, Math.round((Number(invoice.paidAmount || 0) / Number(invoice.amount || 0)) * 100))
      : 0;

    if (invoice.paymentProgress >= 100 || invoice.paymentPlan.secondTranchePaid) {
      invoice.status = 'paid';

      await Notification.create({
        type: 'invoice_payment_completed',
        title: 'Invoice Fully Paid',
        message: `${invoice.invoiceNumber} is fully paid.`,
        recipient: req.user._id,
        recipientRole: 'artisan',
        icon: 'CreditCard',
        metadata: {
          invoiceId: String(invoice._id),
        },
      });
    } else {
      invoice.status = 'pending';
    }

    await invoice.save();

    await logAction(req, {
      actionKey: `artisan.invoice.payment.${phase}`,
      actionLabel: phase === 'upfront' ? 'Paid Invoice Upfront Tranche' : 'Paid Invoice Completion Tranche',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `${invoice.invoiceNumber} ${phase} payment confirmed via Stripe.`,
      metadata: {
        sessionId,
        phase,
        amount,
        paidAmount: invoice.paidAmount,
        paymentProgress: invoice.paymentProgress,
      },
    });

    return res.status(200).json({
      message: phase === 'upfront' ? 'Upfront payment successful' : 'Completion payment successful',
      invoice,
    });
  } catch (error) {
    console.error('confirmInvoicePaymentSession error:', error);
    return res.status(500).json({ message: 'Failed to confirm invoice payment', error: error.message });
  }
};

// @desc    Mark a tranche as manually paid (no Stripe) – artisan confirms client paid in real life
// @route   PATCH /api/invoices/:id/mark-tranche-paid
const markTranchePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project', 'title');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const phase = String(req.body?.phase || '').trim();
    if (!['upfront', 'completion'].includes(phase)) {
      return res.status(400).json({ message: 'Invalid phase. Use upfront or completion.' });
    }

    normalizeInvoicePaymentFields(invoice);

    if (phase === 'upfront' && invoice.paymentPlan.firstTranchePaid) {
      return res.status(400).json({ message: 'Upfront tranche already marked as paid.' });
    }
    if (phase === 'completion' && !invoice.paymentPlan.firstTranchePaid) {
      return res.status(400).json({ message: 'Upfront tranche must be confirmed first.' });
    }
    if (phase === 'completion' && invoice.paymentPlan.secondTranchePaid) {
      return res.status(400).json({ message: 'Completion tranche already marked as paid.' });
    }

    const amount = phaseAmount(invoice, phase);
    invoice.paidAmount = roundMoney(Number(invoice.paidAmount || 0) + amount);

    if (phase === 'upfront') {
      invoice.paymentPlan.firstTranchePaid = true;
      invoice.paymentPlan.firstTranchePaidAt = new Date();

      const secondDue = new Date();
      secondDue.setDate(secondDue.getDate() + 14);
      invoice.paymentPlan.secondTrancheDueDate = secondDue;

      await Notification.create({
        type: 'invoice_second_tranche_due',
        title: 'Second Tranche Deadline Scheduled',
        message: `Second tranche for ${invoice.invoiceNumber} is due by ${secondDue.toLocaleDateString('en-GB')}.`,
        recipient: req.user._id,
        recipientRole: 'artisan',
        icon: 'Clock3',
        metadata: { invoiceId: String(invoice._id), dueDate: secondDue },
      });
    }

    if (phase === 'completion') {
      invoice.paymentPlan.secondTranchePaid = true;
      invoice.paymentPlan.secondTranchePaidAt = new Date();
    }

    invoice.paymentProgress = Number(invoice.amount || 0) > 0
      ? Math.min(100, Math.round((Number(invoice.paidAmount || 0) / Number(invoice.amount || 0)) * 100))
      : 0;

    if (invoice.paymentProgress >= 100 || invoice.paymentPlan.secondTranchePaid) {
      invoice.status = 'paid';
      await Notification.create({
        type: 'invoice_payment_completed',
        title: 'Invoice Fully Paid',
        message: `${invoice.invoiceNumber} is fully paid.`,
        recipient: req.user._id,
        recipientRole: 'artisan',
        icon: 'CreditCard',
        metadata: { invoiceId: String(invoice._id) },
      });
    } else {
      invoice.status = 'pending';
    }

    await invoice.save();

    await logAction(req, {
      actionKey: `artisan.invoice.manual.${phase}`,
      actionLabel: phase === 'upfront' ? 'Confirmed Upfront Payment Received' : 'Confirmed Completion Payment Received',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `${invoice.invoiceNumber} ${phase} tranche manually marked as received.`,
      metadata: { phase, amount, paidAmount: invoice.paidAmount, paymentProgress: invoice.paymentProgress },
    });

    return res.status(200).json({
      message: phase === 'upfront' ? 'Upfront payment marked as received' : 'Completion payment marked as received',
      invoice,
    });
  } catch (error) {
    console.error('markTranchePaid error:', error);
    return res.status(500).json({ message: 'Failed to mark tranche as paid', error: error.message });
  }
};

// @desc    Unmark (cancel) a tranche payment
// @route   PATCH /api/invoices/:id/unmark-tranche-paid
const unmarkTranchePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project', 'title');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const phase = String(req.body?.phase || '').trim();
    if (!['upfront', 'completion'].includes(phase)) {
      return res.status(400).json({ message: 'Invalid phase. Use upfront or completion.' });
    }

    normalizeInvoicePaymentFields(invoice);

    if (phase === 'upfront') {
      if (!invoice.paymentPlan.firstTranchePaid) {
        return res.status(400).json({ message: 'Upfront tranche is not marked as paid.' });
      }
      if (invoice.paymentPlan.secondTranchePaid) {
        return res.status(400).json({ message: 'Cannot cancel upfront while completion is already received. Cancel completion first.' });
      }
      const amount = phaseAmount(invoice, 'upfront');
      invoice.paidAmount = roundMoney(Math.max(0, Number(invoice.paidAmount || 0) - amount));
      invoice.paymentPlan.firstTranchePaid = false;
      invoice.paymentPlan.firstTranchePaidAt = null;
      invoice.paymentPlan.secondTrancheDueDate = null;
    }

    if (phase === 'completion') {
      if (!invoice.paymentPlan.secondTranchePaid) {
        return res.status(400).json({ message: 'Completion tranche is not marked as paid.' });
      }
      const amount = phaseAmount(invoice, 'completion');
      invoice.paidAmount = roundMoney(Math.max(0, Number(invoice.paidAmount || 0) - amount));
      invoice.paymentPlan.secondTranchePaid = false;
      invoice.paymentPlan.secondTranchePaidAt = null;
    }

    invoice.paymentProgress = Number(invoice.amount || 0) > 0
      ? Math.min(100, Math.round((Number(invoice.paidAmount || 0) / Number(invoice.amount || 0)) * 100))
      : 0;
    invoice.status = invoice.paymentProgress >= 100 ? 'paid' : 'pending';

    await invoice.save();

    await logAction(req, {
      actionKey: `artisan.invoice.unmark.${phase}`,
      actionLabel: phase === 'upfront' ? 'Cancelled Upfront Payment Mark' : 'Cancelled Completion Payment Mark',
      entityType: 'invoice',
      entityId: invoice._id,
      description: `${invoice.invoiceNumber} ${phase} tranche mark cancelled.`,
      metadata: { phase, paidAmount: invoice.paidAmount, paymentProgress: invoice.paymentProgress },
    });

    return res.status(200).json({
      message: phase === 'upfront' ? 'Upfront payment mark cancelled' : 'Completion payment mark cancelled',
      invoice,
    });
  } catch (error) {
    console.error('unmarkTranchePaid error:', error);
    return res.status(500).json({ message: 'Failed to cancel tranche mark', error: error.message });
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  updateInvoiceStatus,
  createInvoiceFromQuote,
  createInvoicePaymentSession,
  confirmInvoicePaymentSession,
  markTranchePaid,
  unmarkTranchePaid,
  downloadInvoicePdf,
  deleteInvoice,
};