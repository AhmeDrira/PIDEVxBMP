/**
 * aiShopperController.js — BMP.tn
 * ---------------------------------------------------------------------------
 * POST /api/recommendations/ai-shopper
 *
 * Cette route implemente le flux "Personal Shopper IA":
 * 1) Recupere le contexte projet + brief artisan
 * 2) Fait un pre-filtre local MongoDB (mini-RAG)
 * 3) Envoie un catalogue allege a Gemini
 * 4) Retourne 2 listes: produits BMP.tn + recommandations externes
 */

const Project = require('../models/Project');
const Product = require('../models/Product');
const { inferCategories, generateRecommendations, getActiveModelName, getActiveApiVersion } = require('../services/geminiService');

const ACTIVE_STATUSES = ['active', 'low-stock'];
const ALLOWED_RANGES = new Set(['economique', 'standard', 'premium']);

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const isAllowedRangeInput = (value) => {
  const normalized = normalizeText(value);
  return ['economique', 'economy', 'standard', 'premium'].includes(normalized);
};

const normalizeRange = (value) => {
  const normalized = normalizeText(value);
  if (normalized === 'economique' || normalized === 'economy') return 'economique';
  if (normalized === 'premium') return 'premium';
  return 'standard';
};

const toDisplayRange = (value) => {
  if (value === 'economique') return 'Economique';
  if (value === 'premium') return 'Premium';
  return 'Standard';
};

const resolveBrand = (manufacturer) => {
  if (!manufacturer || typeof manufacturer !== 'object') return 'BMP.tn';

  const company = String(manufacturer.companyName || '').trim();
  if (company) return company;

  const fullName = `${String(manufacturer.firstName || '').trim()} ${String(manufacturer.lastName || '').trim()}`.trim();
  return fullName || 'BMP.tn';
};

const STOP_WORDS = new Set([
  'avec', 'pour', 'dans', 'sans', 'plus', 'moins', 'tres', 'tout', 'tous', 'des', 'les', 'une', 'sur',
  'projet', 'chantier', 'travaux', 'renovation', 'construction', 'besoin', 'materiaux', 'materiel',
  'je', 'veux', 'faire', 'realiser', 'besoins', 'specifiques', 'standard', 'premium', 'economique',
]);

const BTP_SEMANTIC_GROUPS = [
  {
    canonical: 'mur de soutenement',
    aliases: ['mur de retenue', 'mur anti poussee', 'mur en parpaing', 'parpaing', 'bloc a bancher', 'bancher'],
  },
  {
    canonical: 'fondation',
    aliases: ['semelle', 'semelle filante', 'radier', 'beton arme', 'ferraillage', 'acier a beton'],
  },
  {
    canonical: 'drainage',
    aliases: ['drain', 'drain agricole', 'barbacane', 'geotextile', 'evacuation eau', 'humidite'],
  },
  {
    canonical: 'etancheite',
    aliases: ['enduit bitumineux', 'membrane', 'protection humidite', 'hydrofuge'],
  },
  {
    canonical: 'coffrage',
    aliases: ['planche de coffrage', 'panneau coffrage', 'bois coffrage'],
  },
  {
    canonical: 'mortier',
    aliases: ['ciment colle', 'mortier batiment', 'liant', 'ciment'],
  },
];

const UNIT_ALIASES = {
  piece: 'pieces',
  pieces: 'pieces',
  unite: 'pieces',
  unites: 'pieces',
  pcs: 'pieces',
  sac: 'sacs',
  sacs: 'sacs',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramme: 'kg',
  kilogrammes: 'kg',
  g: 'g',
  gramme: 'g',
  grammes: 'g',
  t: 't',
  tonne: 't',
  tonnes: 't',
  m2: 'm2',
  metrecarre: 'm2',
  metrescarres: 'm2',
  mcarre: 'm2',
  mcarres: 'm2',
  m3: 'm3',
  metrecube: 'm3',
  metrescubes: 'm3',
  ml: 'ml',
  metrelineaire: 'ml',
  metreslineaires: 'ml',
  rouleau: 'rouleaux',
  rouleaux: 'rouleaux',
};

const toMoney = (value) => Number((Number(value) || 0).toFixed(2));

const tokenizeNormalized = (value) => normalizeText(value).split(' ').filter(Boolean);

const buildSemanticSignals = (text) => {
  const normalizedText = normalizeText(text);
  const terms = new Set(
    tokenizeNormalized(text).filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  );
  const phraseTerms = new Set();

  BTP_SEMANTIC_GROUPS.forEach((group) => {
    const canonical = normalizeText(group.canonical);
    const variants = [canonical, ...(group.aliases || []).map((alias) => normalizeText(alias)).filter(Boolean)];
    const detected = variants.some((variant) => variant && normalizedText.includes(variant));

    if (!detected) return;

    phraseTerms.add(canonical);

    variants.forEach((variant) => {
      if (!variant) return;
      terms.add(variant);
      tokenizeNormalized(variant).forEach((token) => {
        if (token.length >= 3 && !STOP_WORDS.has(token)) {
          terms.add(token);
        }
      });
    });
  });

  return {
    terms: Array.from(terms).slice(0, 40),
    phraseTerms: Array.from(phraseTerms).slice(0, 16),
  };
};

const parseRecommendedQuantity = (value, fallback = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Number(num.toFixed(2));
};

const normalizeUnit = (value, fallback = 'pieces') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const compact = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  return UNIT_ALIASES[compact] || raw;
};

const scoreProductCandidate = (product, inferredCategories, semanticSignals) => {
  const name = normalizeText(product?.name);
  const category = normalizeText(product?.category);
  const description = normalizeText(product?.description);
  const searchable = `${name} ${category} ${description}`.trim();

  let score = 0;

  semanticSignals.phraseTerms.forEach((phrase) => {
    if (!phrase) return;
    if (searchable.includes(phrase)) score += 8;
    if (name.includes(phrase)) score += 3;
  });

  semanticSignals.terms.forEach((term) => {
    if (!term) return;
    if (name.includes(term)) {
      score += 5;
      return;
    }
    if (category.includes(term)) {
      score += 3;
      return;
    }
    if (description.includes(term)) {
      score += 2;
    }
  });

  inferredCategories.forEach((categoryLabel) => {
    const normalizedCategory = normalizeText(categoryLabel);
    if (!normalizedCategory) return;
    if (category.includes(normalizedCategory)) {
      score += 6;
      return;
    }
    if (description.includes(normalizedCategory)) {
      score += 2;
    }
  });

  const rating = Number(product?.rating || 0);
  const numReviews = Number(product?.numReviews || 0);
  const stock = Number(product?.stock || 0);

  score += Math.min(Math.max(rating, 0), 5) * 0.8;
  score += Math.min(Math.log10(Math.max(numReviews, 0) + 1), 2.5);
  score += Math.min(Math.max(stock, 0) / 50, 2);

  return score;
};

const buildLocalCatalogue = async ({ inferredCategories, semanticSignals }) => {
  const categoryRegexes = inferredCategories.map((category) => new RegExp(escapeRegex(category), 'i'));
  const semanticRegexes = [...semanticSignals.terms, ...semanticSignals.phraseTerms]
    .filter(Boolean)
    .slice(0, 40)
    .map((term) => new RegExp(escapeRegex(term), 'i'));

  const signalFilters = [];
  if (categoryRegexes.length > 0) {
    signalFilters.push({ category: { $in: categoryRegexes } });
  }

  semanticRegexes.forEach((regex) => {
    signalFilters.push({ name: regex });
    signalFilters.push({ category: regex });
    signalFilters.push({ description: regex });
  });

  const query = {
    status: { $in: ACTIVE_STATUSES },
    stock: { $gt: 0 },
  };

  if (signalFilters.length > 0) {
    query.$or = signalFilters;
  }

  let candidates = await Product.find(query)
    .select('_id name price category description manufacturer rating numReviews stock')
    .populate({
      path: 'manufacturer',
      select: 'companyName firstName lastName',
    })
    .limit(220)
    .lean();

  if (!candidates.length) {
    // Fallback: si le prefiltre est trop restrictif, expose un catalogue actif general.
    candidates = await Product.find({
      status: { $in: ACTIVE_STATUSES },
      stock: { $gt: 0 },
    })
      .select('_id name price category description manufacturer rating numReviews stock')
      .populate({
        path: 'manufacturer',
        select: 'companyName firstName lastName',
      })
      .limit(220)
      .lean();
  }

  const rankedCandidates = candidates
    .map((product) => ({
      product,
      score: scoreProductCandidate(product, inferredCategories, semanticSignals),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Number(b.product?.rating || 0) !== Number(a.product?.rating || 0)) {
        return Number(b.product?.rating || 0) - Number(a.product?.rating || 0);
      }
      return Number(b.product?.stock || 0) - Number(a.product?.stock || 0);
    })
    .slice(0, 80)
    .map(({ product }) => product);

  return rankedCandidates.map((product) => ({
    _id: String(product._id),
    name: String(product.name || 'Produit'),
    brand: resolveBrand(product.manufacturer),
    price: toMoney(product.price),
    category: String(product.category || 'Autre'),
  }));
};

const resolveBmpSelection = (aiRows, lightweightCatalogue) => {
  const byId = new Map(lightweightCatalogue.map((item) => [String(item._id), item]));
  const usedIds = new Set();

  const findByNameApprox = (name) => {
    const target = normalizeText(name);
    if (!target) return null;

    return (
      lightweightCatalogue.find((item) => {
        const normalizedName = normalizeText(item.name);
        return normalizedName.includes(target) || target.includes(normalizedName);
      }) || null
    );
  };

  const out = [];
  const rows = Array.isArray(aiRows) ? aiRows : [];

  rows.forEach((row) => {
    const rawId = String(row?.productId || '').trim();
    let product = rawId ? byId.get(rawId) : null;

    if (!product) {
      product = findByNameApprox(row?.name);
    }

    if (!product) return;
    if (usedIds.has(product._id)) return;

    usedIds.add(product._id);
    const recommendedQuantity = parseRecommendedQuantity(row?.quantite_recommandee, 1);
    const recommendedUnit = normalizeUnit(row?.unite_mesure, 'pieces');

    out.push({
      productId: product._id,
      name: product.name,
      brand: product.brand,
      price: toMoney(product.price),
      quantite_recommandee: recommendedQuantity,
      unite_mesure: recommendedUnit,
      category: product.category,
      ai_justification: String(row?.ai_justification || 'Selection recommandee selon votre chantier.').trim(),
    });
  });

  return out;
};

const sanitizeExternalRows = (rows) => {
  const list = Array.isArray(rows) ? rows : [];

  return list
    .map((row) => {
      const genericName = String(row?.generic_name || '').trim();
      const suggestedBrand = String(row?.suggested_brand || '').trim();
      const searchKeyword = String(row?.search_keyword || genericName || '').trim();
      const recommendedQuantity = parseRecommendedQuantity(row?.quantite_recommandee, 1);
      const recommendedUnit = normalizeUnit(row?.unite_mesure, 'pieces');

      return {
        generic_name: genericName,
        estimated_price: toMoney(row?.estimated_price),
        quantite_recommandee: recommendedQuantity,
        unite_mesure: recommendedUnit,
        suggested_brand: suggestedBrand || 'Marque locale equivalente',
        search_keyword: searchKeyword,
      };
    })
    .filter((row) => row.generic_name);
};

const aiShopper = async (req, res) => {
  try {
    const {
      projectId,
      budget: rawBudget,
      range: rawRange,
      specificNeeds: rawSpecificNeeds,
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ message: 'projectId est requis.' });
    }

    const budget = parsePositiveNumber(rawBudget, 0);
    if (budget <= 0) {
      return res.status(400).json({ message: 'Le budget doit etre un nombre positif.' });
    }

    if (!isAllowedRangeInput(rawRange)) {
      return res.status(400).json({ message: 'La gamme doit etre Economique, Standard ou Premium.' });
    }

    const normalizedRange = normalizeRange(rawRange);
    if (!ALLOWED_RANGES.has(normalizedRange)) {
      return res.status(400).json({ message: 'La gamme doit etre Economique, Standard ou Premium.' });
    }

    const specificNeeds = String(rawSpecificNeeds || '').trim();

    const project = await Project.findById(projectId)
      .select('title description location startDate endDate artisan')
      .lean();

    if (!project) {
      return res.status(404).json({ message: 'Projet introuvable.' });
    }

    if (String(project.artisan) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Acces refuse: ce projet ne vous appartient pas.' });
    }

    const projectSummaryText = [project.title, project.description, project.location, specificNeeds]
      .filter(Boolean)
      .join(' ');

    const inferredCategories = inferCategories(projectSummaryText);
    const semanticSignals = buildSemanticSignals(projectSummaryText);

    const lightweightCatalogue = await buildLocalCatalogue({
      inferredCategories,
      semanticSignals,
    });

    const aiOutput = await generateRecommendations({
      project: {
        title: project.title,
        description: project.description,
        location: project.location,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      constraints: {
        budget_tnd: budget,
        gamme: toDisplayRange(normalizedRange),
        besoins_specifiques: specificNeeds || 'Aucun besoin specifique mentionne.',
      },
      products: lightweightCatalogue,
    });

    const bmpMaterials = resolveBmpSelection(aiOutput.bmp_materials, lightweightCatalogue);
    const externalMaterials = sanitizeExternalRows(aiOutput.external_materials);

    const estimatedBmpTotal = toMoney(
      bmpMaterials.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * parseRecommendedQuantity(item.quantite_recommandee, 1),
        0
      )
    );

    const estimatedExternalTotal = toMoney(
      externalMaterials.reduce(
        (sum, item) => sum + (Number(item.estimated_price) || 0) * parseRecommendedQuantity(item.quantite_recommandee, 1),
        0
      )
    );

    const estimatedGrandTotal = toMoney(estimatedBmpTotal + estimatedExternalTotal);
    const overBudgetThreshold = toMoney(budget * 1.15);
    const isOverBudget15Percent = estimatedGrandTotal > overBudgetThreshold;
    const budgetWarningMessage = isOverBudget15Percent
      ? `Attention, votre budget de ${toMoney(budget)} TND semble insuffisant pour couvrir la totalite des recommandations. L'estimation reelle est d'environ ${estimatedGrandTotal} TND.`
      : null;

    return res.status(200).json({
      project: {
        _id: String(project._id),
        title: String(project.title || ''),
        description: String(project.description || ''),
        location: String(project.location || ''),
      },
      constraints: {
        budget,
        range: toDisplayRange(normalizedRange),
        specificNeeds,
      },
      bmp_materials: bmpMaterials,
      external_materials: externalMaterials,
      meta: {
        model: getActiveModelName(),
        api_version: getActiveApiVersion(),
        local_candidates: lightweightCatalogue.length,
        inferred_categories: inferredCategories,
        semantic_terms: semanticSignals.terms.slice(0, 12),
        budget_check: {
          provided_budget: toMoney(budget),
          estimated_total: estimatedGrandTotal,
          estimated_bmp_total: estimatedBmpTotal,
          estimated_external_total: estimatedExternalTotal,
          threshold_15_percent: overBudgetThreshold,
          is_over_budget_15_percent: isOverBudget15Percent,
          warning_message: budgetWarningMessage,
        },
      },
    });
  } catch (error) {
    console.error('[aiShopper] error:', error);

    const errorMessage = String(error?.message || '');

    if (error?.code === 'GEMINI_KEY_MISSING' || /GEMINI_API_KEY|GOOGLE_API_KEY/i.test(errorMessage)) {
      return res.status(503).json({
        message: 'Configuration IA manquante: ajoutez GEMINI_API_KEY (ou GOOGLE_API_KEY) dans backend/.env puis redemarrez le serveur.',
      });
    }

    if (error?.code === 'GEMINI_MODEL_NOT_FOUND' || /Aucun modele Gemini compatible/i.test(errorMessage)) {
      return res.status(503).json({
        message: 'Aucun modele Gemini compatible n\'est disponible pour cette cle API. Definissez GEMINI_API_VERSION=v1 et GEMINI_MODEL=gemini-2.0-flash dans backend/.env puis redemarrez.',
      });
    }

    if (error?.code === 'GEMINI_SERVICE_UNAVAILABLE' || /Service Unavailable|UNAVAILABLE|temporairement indisponible/i.test(errorMessage)) {
      return res.status(503).json({
        message: 'Service IA temporairement indisponible. Reessayez dans quelques instants.',
      });
    }

    if (error?.code === 'GEMINI_QUOTA_EXHAUSTED') {
      return res.status(429).json({
        message: 'Quota IA atteint pour cette cle API. Activez la facturation/quotas Gemini ou reessayez plus tard.',
      });
    }

    if (/n\'a pas retourne un JSON valide|Unexpected token|JSON/i.test(errorMessage)) {
      return res.status(502).json({
        message: 'L\'IA a retourne une reponse invalide. Reessayez dans quelques secondes.',
      });
    }

    if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(errorMessage)) {
      return res.status(429).json({
        message: 'Quota IA atteint temporairement. Reessayez plus tard.',
      });
    }

    return res.status(500).json({
      message: 'Erreur serveur lors de l\'analyse IA des materiaux.',
      detail: error.message,
    });
  }
};

module.exports = {
  aiShopper,
};
