/**
 * Recommendation Controller v4 — BMP.tn
 * ─────────────────────────────────────────
 * POST /api/projects/:projectId/material-recommendations
 * POST /api/products/:id/analyze-tech-sheet
 *
 * ══ ARCHITECTURE EN 4 PHASES ══
 *
 * PHASE 0 — Analyse du projet + conversion surface → quantité de référence
 *   L'artisan saisit : surface (m²/m³/m/pièce), unité, catégorie, budget.
 *   Le type de projet est déduit depuis le titre + description du projet.
 *   Une quantité de référence est calculée (filtre MongoDB).
 *
 * PHASE 1 — Filtrage K.O. (requête MongoDB)
 *   K.O.1 CATÉGORIE   : catégorie produit = catégorie sélectionnée
 *   K.O.2 STOCK MIN   : stock > 0 (le filtrage précis est fait par produit en Phase 2)
 *   K.O.3 NOTE MIN    : rating >= minRating (si définie)
 *   K.O.4 DOUBLON     : produit absent du projet actuel
 *
 * PHASE 2 — Scoring par produit
 *   Pour chaque candidat :
 *     a. Calcul de la quantité SPÉCIFIQUE via conversionFactors
 *        (facteur par nom de produit, fallback=1 + flag isNonStandard)
 *     b. Vérification stock : product.stock < productQty → exclu
 *     c. Analyse sémantique produit↔projet (nom, description, mots-clés, PDF)
 *     d. Scoring 5 critères sur 100 pts
 *
 * PHASE 3 — Tri + formatage JSON (5 meilleurs résultats max)
 */

const Project              = require('../models/Project');
const Product              = require('../models/Product');
const ProductPayment       = require('../models/ProductPayment');
const RecommendationEngine = require('../services/RecommendationEngine');
const TechSheetAnalyzer    = require('../services/TechSheetAnalyzer');
const conversionService    = require('../services/conversionService');
const ProjectAnalyzer      = require('../services/projectAnalyzer');
const ProductAnalyzer      = require('../services/productAnalyzer');
const { calculateProductQuantity } = require('../services/conversionFactors');

// ── Helpers ───────────────────────────────────────────────────────────────────

function posNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function safeStr(val) { return val ? String(val).trim() : ''; }
function safeBool(val, fallback = true) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  if (val === 'false' || val === '0') return false;
  if (val === 'true'  || val === '1') return true;
  return fallback;
}

const ALLOWED_UNITS = new Set(['m²', 'm³', 'm', 'pièce']);

// ── Endpoint principal ────────────────────────────────────────────────────────

/**
 * POST /api/projects/:projectId/material-recommendations
 *
 * Body :
 *   surface      {number}  — valeur saisie (m², m³, m, ou nb pièces)   (requis)
 *   unit         {string}  — 'm²' | 'm³' | 'm' | 'pièce'              (requis)
 *   category     {string}  — catégorie produit                         (requis)
 *   budget       {number}  — budget total TND                          (requis)
 *   margeSecurite{boolean} — appliquer +10 % marge de sécurité (défaut: true)
 *   applyMargin  {boolean} — alias compatibilité avec anciens clients
 *   minRating    {number}  — note minimale 1-5                         (optionnel)
 *   constraint   {string}  — contrainte technique                      (optionnel)
 *   maxResults   {number}  — nb max (défaut 5, max 20)                 (optionnel)
 */
const getMaterialRecommendations = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      surface:     rawSurface,
      unit:        rawUnit,
      category:    rawCategory,
      budget:      rawBudget,
      margeSecurite: rawMargeSecurite,
      applyMargin: rawApplyMargin,
      minRating:   rawMinRating,
      constraint:  rawConstraint,
      maxResults:  rawMax,
    } = req.body;

    // ─── Validation ───────────────────────────────────────────────────────────

    const surface     = posNum(rawSurface, 0);
    const budget      = posNum(rawBudget, 0);
    const unit        = safeStr(rawUnit);
    const category    = safeStr(rawCategory);
    const applyMargin = safeBool(rawMargeSecurite ?? rawApplyMargin, true);
    const maxResults  = Math.min(posNum(rawMax, 5), 20);
    const minRating   = rawMinRating ? Math.max(0, Math.min(5, parseFloat(rawMinRating))) : 0;
    const constraint  = safeStr(rawConstraint);

    if (surface   <= 0) return res.status(400).json({ message: 'surface doit être un nombre positif' });
    if (budget    <= 0) return res.status(400).json({ message: 'budget doit être un nombre positif' });
    if (!unit)          return res.status(400).json({ message: 'unit est requise' });
    if (!ALLOWED_UNITS.has(unit)) {
      return res.status(400).json({ message: 'unit doit être une des valeurs: m², m³, m, pièce' });
    }
    if (!category)      return res.status(400).json({ message: 'category est requise' });

    // ─── Ownership projet ─────────────────────────────────────────────────────

    const project = await Project.findById(projectId).populate('materials');
    if (!project) return res.status(404).json({ message: 'Projet introuvable' });
    if (project.artisan.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé : ce projet ne vous appartient pas' });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 0 — Analyse projet + quantité de référence
    // ════════════════════════════════════════════════════════════════════════

    const projectAnalysis = ProjectAnalyzer.detectProjectType({
      title: project.title,
      description: project.description,
      fallbackCategory: category,
    });
    const projectType = projectAnalysis.primaryType || ProjectAnalyzer.mapCategoryToProjectType(category) || category;

    // La quantité de référence utilise la table catégorielle (conversionService).
    // Elle sert uniquement de valeur contextuelle dans la réponse.
    // La quantité par produit est calculée individuellement en Phase 2.
    const refConversion = conversionService.calculateQuantity(surface, unit, category, 0.10, applyMargin);

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1 — Filtrage K.O. strict (requête MongoDB)
    // ════════════════════════════════════════════════════════════════════════

    // K.O.4 : doublons existants dans le projet
    const existingIds = (project.materials || []).map((m) => (m._id || m));

    const baseQuery = {
      status: { $in: ['active', 'low-stock'] },
      stock:  { $gt: 0 },  // K.O.2 (stock > 0 ; vérification précise par produit en Phase 2)
    };

    if (existingIds.length) baseQuery._id = { $nin: existingIds }; // K.O.4

    // K.O.3 : note minimale
    if (minRating > 0) baseQuery.rating = { $gte: minRating };

    // K.O.1 : filtre catégoriel explicite (catégorie choisie par l'artisan)
    baseQuery.category = new RegExp(
      category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );

    const candidates = await Product.find(baseQuery).lean();

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2 — Scoring par produit
    // ════════════════════════════════════════════════════════════════════════

    // Historique d'achats artisan → IDs des fabricants pour bonus fidélité
    const payments = await ProductPayment.find({
      user:   req.user._id,
      status: { $in: ['paid', 'completed', 'delivered'] },
    }).lean();

    const purchasedProductIds = [
      ...new Set(payments.flatMap((p) => (p.items || []).map((i) => i.productId?.toString()).filter(Boolean)))
    ];

    let purchasedManufIds = new Set();
    if (purchasedProductIds.length > 0) {
      const bought = await Product.find({ _id: { $in: purchasedProductIds } }, { manufacturer: 1 }).lean();
      purchasedManufIds = new Set(bought.map((p) => p.manufacturer?.toString()).filter(Boolean));
    }

    // Score chaque candidat
    const scored = [];
    let semanticRejected = 0;

    await Promise.all(
      candidates.map(async (product) => {

        // ── a. Quantité spécifique par produit ──────────────────────────────
        const prodConversion = calculateProductQuantity(
          product.name,
          surface,
          unit,
          applyMargin
        );
        const productQuantity = prodConversion.quantity;

        // ── b. Vérification stock précise ───────────────────────────────────
        if (product.stock < productQuantity) {
          return; // K.O. stock insuffisant pour CE produit
        }

        // ── c. Analyse PDF ──────────────────────────────────────────────────
        const pdfResult  = await TechSheetAnalyzer.getOrAnalyze(product);
        const pdfPresent = !!(product.techSheetUrl && product.techSheetUrl.trim());

        // ── d. Analyse sémantique produit↔projet ───────────────────────────
        const semanticAnalysis = ProductAnalyzer.analyzeProductForProjectType({
          product,
          projectType,
          techProfile: pdfResult.profile,
        });

        if (semanticAnalysis.shouldFilter) {
          semanticRejected += 1;
          return;
        }

        // ── e. Scoring ──────────────────────────────────────────────────────
        const { scores, totalCost, justification, pdfBadges } = RecommendationEngine.computeScore({
          product,
          category,
          unit,
          constraint,
          quantity: productQuantity,
          budget,
          purchasedManufIds,
          techProfile: pdfResult.profile,
          pdfPresent,
          isNonStandard: prodConversion.isNonStandard,
          semanticAnalysis,
        });

        scored.push({
          productId:    product._id,
          productName:  product.name,
          category:     product.category,
          calculatedQuantity: productQuantity,
          totalPrice:   parseFloat(totalCost.toFixed(2)),
          unitPrice:    product.price,
          image:        product.image,
          rating:       product.rating,
          numReviews:   product.numReviews,
          stock:        product.stock,
          techSheetUrl: product.techSheetUrl,

          // Conversion spécifique au produit
          conversionInfo: {
            factor:        prodConversion.factor,
            matchedKey:    prodConversion.matchedKey,
            quantity:      productQuantity,
            outputUnit:    prodConversion.outputUnit,
            formula:       prodConversion.formula,
            note:          prodConversion.note,
            isNonStandard: prodConversion.isNonStandard,
            warning:       prodConversion.warning,
          },

          scores: {
            total:         scores.total,
            compatibilite: scores.compatibilite,
            budget:        scores.budget,
            contrainte:    scores.contrainte,
            fiabilite:     scores.fiabilite,
            pdf:           scores.pdf,
            semanticBonus: scores.semanticBonus,
            genericPenalty: scores.genericPenalty,
            rankingTotal:  scores.rankingTotal,
          },
          semanticAnalysis: {
            projectType,
            matchCount:      semanticAnalysis.matchCount,
            matchStrength:   semanticAnalysis.matchStrength,
            matchedKeywords: semanticAnalysis.matchedKeywords,
            sourceHits:      semanticAnalysis.sourceHits,
            genericRatio:    semanticAnalysis.genericRatio,
          },
          explainableAI: {
            justification,
            pdfBadges,
            withinBudget:    totalCost <= budget,
            stockSufficient: product.stock >= productQuantity,
          },
          pdfInsights: {
            hasTechSheet:    pdfPresent,
            analysisSuccess: pdfResult.success,
            confidence:      pdfResult.confidence,
            profile:         pdfResult.profile,
            error:           pdfResult.errorMessage || null,
          },
          pricingSummary: {
            unitPrice:     product.price,
            quantity:      productQuantity,
            estimatedCost: parseFloat(totalCost.toFixed(2)),
            currency:      'TND',
            withinBudget:  budget > 0 ? totalCost <= budget : null,
          },
          stockSummary: {
            available:             product.stock,
            needed:                productQuantity,
            sufficient:            product.stock >= productQuantity,
            estimatedDeliveryDays: product.stock >= productQuantity ? 3 : 3 + (productQuantity - product.stock) * 2,
          },
        });
      })
    );

    // ── Cas : aucun produit disponible ───────────────────────────────────────
    if (!scored.length) {
      const message = candidates.length > 0
        ? `Aucun produit dans la catégorie "${category}" n'a un stock suffisant pour votre surface de ${surface} ${unit}.`
        : `Aucun produit disponible dans la catégorie "${category}". Vérifiez la catégorie ou élargissez vos critères.`;

      const semanticMessage = semanticRejected > 0
        ? ` ${semanticRejected} produit(s) ont été exclus par analyse sémantique (non cohérents avec le projet ${projectType}).`
        : '';

      return res.status(200).json({
        projectId,
        recommendations: [],
        projectAnalysis: {
          detectedType: projectType,
          confidence: projectAnalysis.confidence,
          matchedKeywords: projectAnalysis.matchedKeywords,
          rankedTypes: projectAnalysis.rankedTypes,
        },
        refConversion: {
          surface,
          unit,
          category,
          applyMargin,
          margeSecurite: applyMargin,
          calculatedQuantity: refConversion.quantity,
          formula:            refConversion.formula,
          conversionLabel:    refConversion.label,
        },
        meta: {
          candidatesEvaluated: candidates.length,
          semanticRejected,
          returned: 0,
          message: message + semanticMessage,
        },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 3 — Tri décroissant, top N
    // ════════════════════════════════════════════════════════════════════════

    const sorted = scored
      .sort((a, b) => (b.scores.rankingTotal || b.scores.total) - (a.scores.rankingTotal || a.scores.total))
      .slice(0, maxResults);

    return res.status(200).json({
      projectId,
      recommendations: sorted,
      projectAnalysis: {
        detectedType: projectType,
        confidence: projectAnalysis.confidence,
        matchedKeywords: projectAnalysis.matchedKeywords,
        rankedTypes: projectAnalysis.rankedTypes,
      },
      refConversion: {
        surface,
        unit,
        category,
        applyMargin,
        margeSecurite: applyMargin,
        calculatedQuantity: refConversion.quantity,
        formula:            refConversion.formula,
        conversionLabel:    refConversion.label,
      },
      meta: {
        candidatesEvaluated: candidates.length,
        semanticRejected,
        returned:            sorted.length,
        scoringFormula:      'S_base(100)=COMPAT_SURFACE(25)+BUDGET(25)+CONTRAINTE(20)+FIABILITE(15)+PDF(15); S_rank=S_base+BONUS_SEM(10)-PENALITE_GENERICITE',
      },
    });

  } catch (error) {
    console.error('getMaterialRecommendations error:', error);
    return res.status(500).json({
      message: 'Erreur serveur lors du calcul des recommandations',
      detail:  error.message,
    });
  }
};

// ── Analyse forcée d'une fiche PDF ────────────────────────────────────────────

const analyzeTechSheet = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });
    if (!product.techSheetUrl) return res.status(400).json({ message: 'Ce produit n\'a pas de fiche technique' });

    const result = await TechSheetAnalyzer.forceAnalyze(product);
    return res.status(200).json({
      productId:  product._id,
      success:    result.success,
      confidence: result.confidence,
      profile:    result.profile,
      error:      result.errorMessage || null,
      fromCache:  false,
    });
  } catch (error) {
    console.error('analyzeTechSheet error:', error);
    return res.status(500).json({ message: 'Erreur analyse PDF', detail: error.message });
  }
};

module.exports = { getMaterialRecommendations, analyzeTechSheet };
