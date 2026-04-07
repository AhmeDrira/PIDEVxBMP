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
const axios = require('axios');

// ── Helpers ───────────────────────────────────────────────────────────────────

function posNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function safeStr(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  return str || fallback;
}
function safeBool(val, fallback = true) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  if (val === 'false' || val === '0') return false;
  if (val === 'true'  || val === '1') return true;
  return fallback;
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  if (!candidates.length) return '';

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const merged = parts
      .map((part) => safeStr(part?.text))
      .filter(Boolean)
      .join(' ')
      .trim();
    if (merged) return merged;
  }

  return '';
}

function sanitizeGeneratedDescription(rawText) {
  let text = safeStr(rawText)
    .replace(/```(?:json|markdown|md|txt)?/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  text = text
    .replace(/^#+\s*/g, '')
    .replace(/^[-*•]\s+/g, '')
    .replace(/^\d+[.)]\s+/g, '')
    .replace(/^(description|material description|product description)\s*:\s*/i, '')
    .replace(/^"+|"+$/g, '')
    .trim();

  return text;
}

function getGeminiErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    return safeStr(
      error.response?.data?.error?.message
      || error.response?.data?.message
      || error.message,
      'Gemini request failed'
    );
  }

  return safeStr(error?.message, 'Gemini request failed');
}

function isGeminiCapacityError(error) {
  const status = Number(error?.response?.status || error?.status || 0);
  const message = getGeminiErrorMessage(error).toLowerCase();

  return status === 429
    || status === 503
    || status === 504
    || /resource_exhausted|quota|rate\s*limit|too many requests|temporar|unavailable|deadline exceeded|timed out|timeout|overloaded|try again later/.test(message);
}

function isGeminiModelUnsupportedError(error) {
  const status = Number(error?.response?.status || error?.status || 0);
  const message = getGeminiErrorMessage(error).toLowerCase();

  return status === 404
    || /model.+not found|is not found|unknown model|unsupported model|not supported|does not exist|listmodels|invalid argument.+model/.test(message);
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiModelCandidates() {
  const primary = safeStr(process.env.GEMINI_MODEL, 'gemini-2.5-flash');
  const fallbackModels = safeStr(process.env.GEMINI_FALLBACK_MODELS)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const candidates = [];
  const seen = new Set();

  for (const model of [primary, ...fallbackModels]) {
    const key = model.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(model);
    }
  }

  return candidates;
}

function buildLocalDescriptionFallback({ name, category, language }) {
  const normalizedLanguage = safeStr(language, 'en').toLowerCase();
  const productName = safeStr(name, normalizedLanguage === 'fr' ? 'ce materiau' : normalizedLanguage === 'ar' ? 'هذه المادة' : 'this material');
  const productCategory = safeStr(category, normalizedLanguage === 'fr' ? 'materiaux de construction' : normalizedLanguage === 'ar' ? 'مواد البناء' : 'construction materials');
  const materialContext = `${productName} ${productCategory}`.toLowerCase();
  const isCementRelated = /cement|ciment|beton|beton\s*&\s*ciment|cpj|cpa|mortier|concrete|\u0627\u0633\u0645\u0646\u062a|\u0625\u0633\u0645\u0646\u062A|\u062e\u0631\u0633\u0627\u0646\u0629|\u0645\u0644\u0627\u0637/.test(materialContext);

  if (normalizedLanguage === 'fr') {
    if (isCementRelated) {
      return `${productName} est adapte aux travaux de ${productCategory} sur chantier neuf comme en renovation, notamment pour les couches structurelles et les zones sollicitees. Sa formulation cimentaire offre une bonne tenue mecanique, une resistance fiable a l'humidite moderee et une stabilite utile lorsque les conditions de travail varient pendant la journee. Avant application, il est conseille de preparer un support propre, sain et legerement humidifie, puis de respecter un dosage eau-melange constant afin d'obtenir une consistance homogene. Pendant la mise en oeuvre, melangez par petites quantites successives pour garder une ouvrabilite reguliere et limiter les pertes de performance. Pour la durabilite, prevoyez une cure adaptee apres pose et evitez les chocs thermiques precoces qui peuvent fragiliser la prise. Stockez les sacs dans un endroit sec, sur palette, a l'abri de l'humidite et utilisez les equipements de protection individuels pour reduire les risques de poussiere et d'irritation.`;
    }
    return `${productName} convient aux travaux de ${productCategory} sur chantier residentiel et professionnel, avec une utilisation pratique pour les phases de preparation, de pose et de finition. Le materiau offre une bonne fiabilite en service, une resistance adaptee aux sollicitations courantes et un comportement stable lorsque la mise en oeuvre respecte les preconisations techniques. Avant application, nettoyez soigneusement le support, verifiez sa planete et appliquez une preparation compatible afin d'ameliorer l'adherence et la regularite du resultat final. Pendant les travaux, il est recommande de controler l'epaisseur appliquee et d'ajuster la methode selon la temperature, l'humidite et le niveau d'exposition de la zone. Cette approche permet d'obtenir une finition plus durable et de reduire les reprises sur le chantier. Conservez le produit dans son emballage d'origine, a l'abri du soleil et de l'humidite, puis appliquez les consignes de securite et de controle qualite avant chaque utilisation.`;
  }

  if (normalizedLanguage === 'ar') {
    if (isCementRelated) {
      return `${productName} مناسب لاعمال ${productCategory} في الورشات الجديدة واعمال الترميم، خصوصا في الطبقات الانشائية والمناطق التي تتعرض لاجهاد مستمر. تركيبة المادة الاسمنتية تعطي تماسك جيد ومقاومة مستقرة للرطوبة المعتدلة وسلوك موثوق عند اختلاف ظروف التنفيذ خلال اليوم. قبل الاستعمال يفضل تجهيز السطح ليكون نظيفا وخاليا من الشوائب مع ترطيب خفيف، ثم الالتزام بنسبة ماء وخلط ثابتة للحصول على قوام متجانس. اثناء التطبيق من الافضل تحضير كميات متدرجة والتحريك المنتظم لتفادي التكتل والحفاظ على جودة الفرد والالتصاق. من اجل اداء طويل المدى ينصح بمرحلة معالجة بعد التطبيق وتجنب الحرارة العالية او الجفاف السريع في الساعات الاولى. احفظ الاكياس في مكان جاف فوق منصات بعيدا عن الرطوبة، واستعمل معدات السلامة الشخصية لضمان جودة العمل وتقليل مخاطر الغبار على الفريق.`;
    }
    return `${productName} مناسب لاعمال ${productCategory} في مواقع البناء السكنية والمشاريع المهنية، ويمكن اعتماده في مراحل التحضير والتنفيذ والانهاء بشكل عملي. المادة تقدم مستوى جيد من المتانة والاعتمادية وتبقى نتائجها مستقرة عندما يتم احترام خطوات التركيب والتعليمات الفنية. قبل التطبيق يجب تنظيف السطح جيدا والتاكد من توازنه واختيار طبقة تحضيرية مناسبة لتحسين الالتصاق وتوحيد النتيجة النهائية. اثناء العمل يفضل مراقبة السماكة وتوزيع المادة بشكل منتظم مع تعديل طريقة التطبيق حسب درجة الحرارة والرطوبة داخل الورشة. هذا الاسلوب يساعد على رفع الجودة وتقليل اعادة العمل ويحسن سلوك المنتج على المدى الطويل. يحفظ المنتج في عبوة مغلقة داخل مكان جاف ومهوى، مع الالتزام بقواعد السلامة ومراقبة الجودة قبل كل استخدام.`;
  }

  if (isCementRelated) {
    return `${productName} is suitable for ${productCategory} operations in both new construction and renovation sites, especially where structural consistency is required across multiple work phases. Its cement-based composition delivers reliable compressive behavior, stable day-to-day workability, and practical resistance to moderate moisture exposure in normal site conditions. Before application, prepare a clean and sound substrate, lightly pre-wet absorbent surfaces, and keep a consistent water-to-mix ratio to maintain predictable performance. During installation, mix in controlled batches and apply with steady thickness so the material cures uniformly and reduces avoidable defects. For long-term reliability, protect fresh application from early thermal shock and support proper curing according to the project schedule. Store sealed bags in a dry elevated area away from humidity, and enforce safety and quality checks, including dust protection, before each use.`;
  }

  return `${productName} is designed for ${productCategory} use on active worksites, providing practical value during preparation, installation, and finishing stages of the project. The material offers dependable behavior under routine field constraints, with balanced durability, reliable resistance, and stable results when applied according to recommended methods. Before application, ensure the substrate is clean, structurally sound, and compatible with the selected primer or preparation layer to improve adhesion quality. During execution, maintain controlled application thickness and adapt handling to onsite temperature and humidity to keep performance consistent across different zones. This approach improves service life, reduces rework risk, and supports predictable quality outcomes for contractors and technicians. Store the product in original sealed packaging away from moisture and heat, and follow safety and quality-control practices on every shift before use.`;
}

function countSentences(text) {
  return safeStr(text)
    .split(/[.!?\u061f]+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function isDescriptionTooShort(text) {
  const description = safeStr(text);
  return description.length < 260 || countSentences(description) < 5;
}

function buildMaterialDescriptionPrompt({ name, category, language, previousDescription = '', refinementInstruction = '' }) {
  const normalizedLanguage = safeStr(language, 'en').toLowerCase();
  const outputLanguage = normalizedLanguage === 'fr' ? 'French' : normalizedLanguage === 'ar' ? 'Arabic' : 'English';
  const productName = safeStr(name);
  const productCategory = safeStr(category, 'Construction Materials');

  const refinementBlock = refinementInstruction
    ? `\nRefinement instruction: ${refinementInstruction}.\nPrevious answer: ${safeStr(previousDescription)}`
    : '';

  return `You are a senior construction materials technical writer. Write one production-ready marketplace product description.
Output language: ${outputLanguage}.
Product name: ${productName}.
Product category: ${productCategory}.

Mandatory constraints:
- Write exactly 6 to 8 complete sentences.
- Target 140 to 220 words.
- Include practical chantier/worksite usage context.
- Explain performance qualities including durability, resistance, reliability, and behavior under realistic conditions.
- Include at least one preparation or application recommendation.
- Include one storage, quality, or safety recommendation.
- No markdown, no bullet points, no headings, no emojis.
- Return only the final description text.${refinementBlock}`;
}

async function requestGeminiDescription({ apiKey, apiVersion, model, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/${encodeURIComponent(apiVersion)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 220,
    },
  };

  const response = await axios.post(endpoint, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const extracted = extractGeminiText(response.data);
  const sanitized = sanitizeGeneratedDescription(extracted);

  if (!sanitized) {
    const emptyError = new Error('Gemini returned an empty description');
    emptyError.code = 'EMPTY_OUTPUT';
    throw emptyError;
  }

  return sanitized;
}

const ALLOWED_UNITS = new Set(['m²', 'm³', 'm', 'pièce']);

const generateMaterialDescription = async (req, res) => {
  const name = safeStr(req.body?.name);
  const category = safeStr(req.body?.category);
  const language = safeStr(req.body?.language, 'en').toLowerCase();

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!req.user || req.user.role !== 'manufacturer') {
    return res.status(403).json({ message: 'Only manufacturer users can generate product descriptions' });
  }

  const apiKey = safeStr(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    console.error('generateMaterialDescription unrecoverable:', 'GEMINI_API_KEY is missing');
    return res.status(500).json({ message: 'Description generation is temporarily unavailable' });
  }

  const apiVersion = safeStr(process.env.GEMINI_API_VERSION, 'v1');
  const parsedRetries = Number.parseInt(process.env.GEMINI_MAX_RETRIES, 10);
  const maxRetries = Number.isFinite(parsedRetries)
    ? Math.min(4, Math.max(1, parsedRetries))
    : 2;

  const models = getGeminiModelCandidates();
  let lastError = null;
  let sawCapacityOrShortOutput = false;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const firstPrompt = buildMaterialDescriptionPrompt({ name, category, language });
        let description = await requestGeminiDescription({
          apiKey,
          apiVersion,
          model,
          prompt: firstPrompt,
        });

        if (isDescriptionTooShort(description)) {
          const refinementPrompt = buildMaterialDescriptionPrompt({
            name,
            category,
            language,
            previousDescription: description,
            refinementInstruction: 'previous answer too short, rewrite with significantly more useful detail',
          });

          description = await requestGeminiDescription({
            apiKey,
            apiVersion,
            model,
            prompt: refinementPrompt,
          });
        }

        description = sanitizeGeneratedDescription(description);
        if (isDescriptionTooShort(description)) {
          const shortOutputError = new Error('Gemini output too short after refinement');
          shortOutputError.code = 'SHORT_OUTPUT';
          throw shortOutputError;
        }

        if (!description) {
          const emptyOutputError = new Error('Gemini output is empty');
          emptyOutputError.code = 'EMPTY_OUTPUT';
          throw emptyOutputError;
        }

        return res.status(200).json({
          description,
          modelUsed: model,
          fallbackUsed: false,
        });
      } catch (error) {
        lastError = error;
        const providerMessage = getGeminiErrorMessage(error);
        const shortOutput = safeStr(error?.code).toUpperCase() === 'SHORT_OUTPUT';

        if (shortOutput) {
          sawCapacityOrShortOutput = true;
          break;
        }

        if (isGeminiModelUnsupportedError(error)) {
          break;
        }

        if (isGeminiCapacityError(error)) {
          sawCapacityOrShortOutput = true;
          if (attempt < maxRetries) {
            await sleepMs(350 * attempt);
            continue;
          }
          break;
        }

        console.error('generateMaterialDescription unrecoverable:', providerMessage);
        return res.status(500).json({ message: 'Failed to generate product description' });
      }
    }
  }

  if (sawCapacityOrShortOutput) {
    const fallbackDescription = buildLocalDescriptionFallback({ name, category, language });
    return res.status(200).json({
      description: fallbackDescription,
      fallbackUsed: true,
      warning: 'AI provider is temporarily limited, so a local detailed description was generated.',
    });
  }

  console.error('generateMaterialDescription unrecoverable:', getGeminiErrorMessage(lastError));
  return res.status(500).json({ message: 'Failed to generate product description' });
};

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

module.exports = { getMaterialRecommendations, analyzeTechSheet, generateMaterialDescription };
