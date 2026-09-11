const Quote = require('../models/Quote');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const { logAction } = require('../utils/actionLogger');
const { generateQuoteAIDraft } = require('../services/quoteAIDraftService');
const { listQuoteTemplates, QUOTE_UNITS, QUOTE_LINE_TYPES } = require('../utils/quoteTemplates');
const { computePaymentSchedule, TRANCHE_TYPES } = require('../utils/paymentSchedule');
const { computeTemplateLines, hasCalculator } = require('../services/quoteCalculators');
const { readPlan, mapReading } = require('../services/planReaderService');
const { detectTrade } = require('../utils/tradeDetection');

const { resolveChromeExecutablePath } = require('../utils/chromePath');

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

// @desc    Generate AI quote draft suggestions
// @route   POST /api/quotes/ai-draft
const generateQuoteDraft = async (req, res) => {
  try {
    const projectId = String(req.body?.projectId || req.body?.project || '').trim();
    const clientName = String(req.body?.clientName || '').trim();

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Valid projectId is required' });
    }

    const project = await Project.findOne({
      _id: projectId,
      artisan: req.user._id,
    })
      .populate('materials', 'name price category status stock')
      .lean();

    if (!project) {
      return res.status(404).json({ message: 'Project not found for this artisan' });
    }

    const numericProgress = Number(project?.progress ?? 0);
    const isCompletedByStatus = String(project?.status || '').toLowerCase() === 'completed';
    const isCompletedByProgress = Number.isFinite(numericProgress) && numericProgress >= 100;
    if (isCompletedByStatus || isCompletedByProgress) {
      return res.status(400).json({ message: 'Cannot generate quote draft for completed project' });
    }

    const draft = await generateQuoteAIDraft({
      project,
      clientName,
      artisanId: req.user._id,
    });
    return res.status(200).json(draft);
  } catch (error) {
    console.error('generateQuoteDraft error:', error);
    return res.status(500).json({ message: 'Server error while generating AI quote draft' });
  }
};

// @desc    Create a new quote
// @route   POST /api/quotes
/**
 * Valide et normalise les lignes recues du client.
 * Renvoie null si `quoteLines` est absent (devis libre) ; leve une Error avec un
 * message exploitable si une ligne est invalide.
 */
const normalizeQuoteLines = (rawLines) => {
  if (rawLines === undefined || rawLines === null) return null;
  if (!Array.isArray(rawLines)) {
    throw new Error('quoteLines must be an array');
  }
  if (rawLines.length === 0) return null;

  return rawLines.map((line, index) => {
    const designation = String(line?.designation || '').trim();
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unitPrice ?? 0);

    if (!designation) {
      throw new Error(`Line ${index + 1}: designation is required`);
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`Line ${index + 1}: quantity must be a non-negative number`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Line ${index + 1}: unit price must be a non-negative number`);
    }
    if (!QUOTE_UNITS.includes(line?.unit)) {
      throw new Error(`Line ${index + 1}: unknown unit`);
    }
    if (!QUOTE_LINE_TYPES.includes(line?.lineType)) {
      throw new Error(`Line ${index + 1}: lineType must be 'labor' or 'material'`);
    }

    return {
      designation,
      quantity,
      unit: line.unit,
      unitPrice,
      lineType: line.lineType,
      total: quantity * unitPrice,
    };
  });
};

/** Somme des lignes d'un type donne. */
const sumLines = (lines, lineType) =>
  lines.filter((line) => line.lineType === lineType).reduce((sum, line) => sum + line.total, 0);

// @desc    Modeles de devis par corps de metier
// @route   GET /api/quotes/templates
// @access  Private
const getQuoteTemplates = async (req, res) => {
  try {
    return res.status(200).json(listQuoteTemplates());
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/quotes/templates/:id/compute
 *
 * Calcule les lignes d'un modele auto-calcule a partir des parametres saisis
 * par l'artisan. Les lignes renvoyees sont un point de depart : elles restent
 * entierement editables dans le formulaire, et les prix unitaires valent 0.
 */
const computeQuoteTemplateLines = async (req, res) => {
  try {
    const templateId = String(req.params.id || '');
    const template = listQuoteTemplates().find((item) => item.id === templateId);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    if (!hasCalculator(templateId)) {
      return res.status(400).json({ message: 'This template is not auto-calculated' });
    }

    let lines;
    try {
      lines = computeTemplateLines(templateId, req.body || {});
    } catch (paramError) {
      // Parametre manquant ou hors des choix connus.
      return res.status(400).json({ message: paramError.message });
    }

    return res.status(200).json({ id: template.id, title: template.title, lines });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/quotes/plan-reading
 *
 * Corps multipart : `plan` (image ou PDF). Le fichier reste en memoire, il
 * n'est jamais ecrit sur disque.
 *
 * SEUL appel au modele de tout le parcours, donc seul poste payant. Ne connait
 * aucun metier : a ce stade l'artisan n'a pas encore choisi le sien.
 */
const readPlanFile = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'A plan file is required' });
    }

    let resultat;
    try {
      resultat = await readPlan(req.file.buffer, req.file.mimetype);
    } catch (planError) {
      // Resolution insuffisante ou type refuse : la faute vient de l'envoi,
      // pas du serveur. Le message est destine a l'artisan.
      if (planError.code === 'PLAN_RESOLUTION_TOO_LOW'
        || planError.code === 'PLAN_TYPE_UNSUPPORTED'
        || planError.code === 'PLAN_TOO_DENSE') {
        return res.status(400).json({ message: planError.message, code: planError.code });
      }
      if (planError.code === 'GEMINI_QUOTA_EXHAUSTED') {
        // 429 plutot que 502 : le service fonctionne, c'est le palier
        // journalier qui est atteint. Le message est destine a l'artisan.
        return res.status(429).json({ message: planError.message, code: planError.code });
      }
      if (planError.code === 'GEMINI_KEY_MISSING') {
        return res.status(503).json({ message: 'La lecture de plan n\'est pas configurée sur ce serveur.' });
      }
      return res.status(502).json({
        message: 'La lecture du plan a échoué.',
        error: planError.message,
      });
    }

    return res.status(200).json(resultat);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/quotes/detect-trade
 *
 * Corps JSON : `description`, le texte libre de l artisan.
 *
 * Determine le metier par correspondance de mots-cles. AUCUN appel a l IA :
 * classer un texte court sur deux categories ne le justifie pas, et une regle
 * deterministe se teste.
 *
 * Un `templateId` a null n est pas une erreur : c est le signal que l appelant
 * doit proposer la galerie de metiers plutot que de deviner.
 */
const detectTradeFromDescription = async (req, res) => {
  try {
    const { description } = req.body || {};
    if (typeof description !== 'string') {
      return res.status(400).json({ message: 'A description is required' });
    }

    const resultat = detectTrade(description);

    // Un metier reconnu doit exister : sans quoi le frontend enverrait
    // l artisan sur un modele fantome.
    if (resultat.templateId) {
      const template = listQuoteTemplates().find((t) => t.id === resultat.templateId);
      if (!template) {
        return res.status(200).json({ templateId: null, motsCles: [], raison: 'modèle introuvable' });
      }
      // Le modele complet accompagne la reponse : le frontend enchaine
      // directement sur le formulaire sans avoir a recharger la galerie.
      return res.status(200).json({ ...resultat, template });
    }

    return res.status(200).json(resultat);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/quotes/templates/:id/map-reading
 *
 * Corps JSON : `lecture`, telle que renvoyee par /plan-reading.
 *
 * Projette la lecture sur les champs du modele choisi. AUCUN appel a l'IA :
 * changer de metier ne relit jamais le plan. Le garde-fou de source est
 * reapplique ici, cote serveur.
 */
const mapPlanReadingToTemplate = async (req, res) => {
  try {
    const templateId = String(req.params.id || '');
    const template = listQuoteTemplates().find((item) => item.id === templateId);

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const { lecture } = req.body || {};
    if (!lecture || typeof lecture !== 'object') {
      return res.status(400).json({ message: 'A plan reading is required' });
    }

    const resultat = mapReading(lecture, templateId);
    return res.status(200).json({ id: template.id, title: template.title, ...resultat });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Valide l'echeancier recu et recalcule les montants depuis le total.
 * Renvoie null si absent (comportement d'origine a 2 tranches).
 */
const normalizePaymentSchedule = (rawSchedule, total) => {
  if (rawSchedule === undefined || rawSchedule === null) return null;
  if (!Array.isArray(rawSchedule)) {
    throw new Error('paymentSchedule must be an array');
  }
  if (rawSchedule.length === 0) return null;

  rawSchedule.forEach((tranche, index) => {
    if (!String(tranche?.label || '').trim()) {
      throw new Error(`Tranche ${index + 1}: label is required`);
    }
    if (!TRANCHE_TYPES.includes(tranche?.type)) {
      throw new Error(`Tranche ${index + 1}: unknown payment type`);
    }
    if (tranche.type !== 'remaining') {
      const value = Number(tranche?.value);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Tranche ${index + 1}: value must be a non-negative number`);
      }
    }
  });

  const { tranches, isBalanced } = computePaymentSchedule(rawSchedule, total);
  if (!isBalanced) {
    throw new Error('Payment schedule must add up to the quote total');
  }

  return tranches;
};

const createQuote = async (req, res) => {
  try {
    const { project, clientName, laborHand, materialsAmount, description, validUntil, paymentTerms, upfrontPercent, quoteLines, paymentSchedule } = req.body;

    if (!project || !clientName || !description || !validUntil) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    let normalizedLines = null;
    try {
      normalizedLines = normalizeQuoteLines(quoteLines);
    } catch (lineError) {
      return res.status(400).json({ message: lineError.message });
    }

    // Les lignes sont desormais l'unique source du montant, quel que soit le mode
    // (devis libre ou modele metier). Les anciens champs laborHand/materialsAmount
    // du body ne servent plus que de repli pour les integrations historiques qui
    // n'envoient pas encore de lignes.
    const parsedLaborHand = normalizedLines ? sumLines(normalizedLines, 'labor') : Number(laborHand || 0);
    const parsedMaterialsAmount = normalizedLines
      ? sumLines(normalizedLines, 'material')
      : Number(materialsAmount || 0);

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

    let normalizedSchedule = null;
    try {
      normalizedSchedule = normalizePaymentSchedule(paymentSchedule, amount);
    } catch (scheduleError) {
      return res.status(400).json({ message: scheduleError.message });
    }

    // Générer un numéro de devis unique (ex: QT-2026-8452)
    const currentYear = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QT-${currentYear}-${randomCode}`;

    const parsedUpfrontPercent = Number(upfrontPercent);
    const safeUpfrontPercent = Number.isFinite(parsedUpfrontPercent) && parsedUpfrontPercent >= 0 && parsedUpfrontPercent <= 100
      ? parsedUpfrontPercent
      : 50;

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
      paymentTerms,
      // La premiere tranche devient l'acompte de reference : c'est ce que lisent
      // invoiceController, quoteMLService et quoteAIDraftService.
      upfrontPercent: normalizedSchedule ? normalizedSchedule[0].percentage : safeUpfrontPercent,
      ...(normalizedLines ? { quoteLines: normalizedLines } : {}),
      ...(normalizedSchedule ? { paymentSchedule: normalizedSchedule } : {}),
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
      .populate({
        path: 'project',
        select: 'title materials personalMaterials',
        populate: {
          path: 'materials',
          select: 'name price',
        },
      })
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
    const materialItems = extractProjectMaterialItems(quote.project);
    const materialRowsHtml = materialItems.map((item) => {
      const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
      return `<div class="material-row">
        <span>${escapeHtml(item.name)} <small>(${escapeHtml(item.source)})</small></span>
        <strong>x${item.quantity} - ${lineTotal.toLocaleString()} TND</strong>
      </div>`;
    }).join('');

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
          .material-list { margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #ffffff; }
          .material-list h4 { margin: 0 0 10px; font-size: 16px; }
          .material-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .material-row:last-child { border-bottom: none; }
          .material-row small { color: #64748b; font-weight: 600; }
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
              <p>${escapeHtml(quote.description || '')}</p>
            </div>

            ${materialItems.length > 0 ? `<div class="material-list"><h4>Materials Included</h4>${materialRowsHtml}</div>` : ''}

            ${Array.isArray(quote.paymentSchedule) && quote.paymentSchedule.length > 0
              ? `<div class="section"><h4>Payment Schedule</h4><table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead><tr>
                    <th style="text-align:left;border-bottom:1px solid #ccc;padding:4px;">Tranche</th>
                    <th style="text-align:right;border-bottom:1px solid #ccc;padding:4px;">%</th>
                    <th style="text-align:right;border-bottom:1px solid #ccc;padding:4px;">Amount (TND)</th>
                  </tr></thead>
                  <tbody>${quote.paymentSchedule.map((t) => `<tr>
                    <td style="padding:4px;">${escapeHtml(t.label)}</td>
                    <td style="padding:4px;text-align:right;">${Number(t.percentage || 0).toFixed(2)}%</td>
                    <td style="padding:4px;text-align:right;">${Number(t.amount || 0).toFixed(2)}</td>
                  </tr>`).join('')}</tbody>
                </table></div>`
              : (quote.paymentTerms ? `<div class="section"><h4>Payment Terms</h4><p>${escapeHtml(quote.paymentTerms)}</p></div>` : '')}

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

module.exports = {
  getQuoteTemplates,
  computeQuoteTemplateLines,
  readPlanFile,
  detectTradeFromDescription,
  mapPlanReadingToTemplate,
  generateQuoteDraft,
  createQuote,
  getQuotes,
  updateQuoteStatus,
  downloadQuotePdf,
  deleteQuote,
};