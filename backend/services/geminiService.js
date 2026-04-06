/**
 * geminiService.js — BMP.tn Personal Shopper IA
 * ──────────────────────────────────────────────────────────────────────────────
 * Intégration Gemini 1.5 Flash via @google/generative-ai.
 *
 * Pattern Singleton : le client est instancié une seule fois.
 * Le service construit le prompt système, appelle l'API en mode JSON strict,
 * et parse la réponse.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Singleton ─────────────────────────────────────────────────────────────────

const MODEL_CANDIDATES = Array.from(new Set([
  process.env.GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
].filter(Boolean)));

const API_VERSION_CANDIDATES = Array.from(new Set([
  process.env.GEMINI_API_VERSION,
  'v1',
  'v1beta',
].filter(Boolean)));

const MAX_SERVICE_UNAVAILABLE_RETRIES_PER_MODEL = 2;

let _genAI = null;
let _model = null;
let _selectedModelName = null;
let _selectedApiVersion = null;
let _modelIndex = 0;
let _apiVersionIndex = 0;

function getGenerationConfig(apiVersion) {
  const base = {
    temperature: 0.2,
    maxOutputTokens: 8192,
  };

  // On v1 with this SDK, responseMimeType may be rejected as unknown field.
  if (apiVersion !== 'v1') {
    base.responseMimeType = 'application/json';
  }

  return base;
}

function isModelNotFoundError(error) {
  const msg = String(error?.message || '');
  return Number(error?.status) === 404 && /not found|is not found|ListModels/i.test(msg);
}

function isQuotaError(error) {
  const msg = String(error?.message || '');
  return Number(error?.status) === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg);
}

function isServiceUnavailableError(error) {
  const msg = String(error?.message || '');
  return Number(error?.status) === 503 || /Service Unavailable|UNAVAILABLE|temporarily unavailable/i.test(msg);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyCurrentCandidate() {
  _selectedModelName = MODEL_CANDIDATES[_modelIndex];
  _selectedApiVersion = API_VERSION_CANDIDATES[_apiVersionIndex];

  _model = _genAI.getGenerativeModel(
    { model: _selectedModelName, generationConfig: getGenerationConfig(_selectedApiVersion) },
    { apiVersion: _selectedApiVersion }
  );
}

function resetCandidateSelection() {
  _modelIndex = 0;
  _apiVersionIndex = 0;
  applyCurrentCandidate();
}

function getModel({ reset = false } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY/GOOGLE_API_KEY manquante dans les variables d\'environnement.');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }

  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(apiKey);
  }

  if (reset || !_model) {
    resetCandidateSelection();
  }

  return _model;
}

function switchToNextCandidate() {
  if (_modelIndex + 1 < MODEL_CANDIDATES.length) {
    _modelIndex += 1;
    applyCurrentCandidate();
    return true;
  }

  if (_apiVersionIndex + 1 < API_VERSION_CANDIDATES.length) {
    _apiVersionIndex += 1;
    _modelIndex = 0;
    applyCurrentCandidate();
    return true;
  }

  return false;
}

// ── Mapping catégories ─ aide le pré-filtre RAG ──────────────────────────────

const KEYWORD_TO_CATEGORIES = {
  'salle de bain': ['Plomberie', 'Carrelage', 'Peinture', 'Sanitaire'],
  douche: ['Plomberie', 'Carrelage', 'Sanitaire'],
  cuisine: ['Plomberie', 'Carrelage', 'Électricité', 'Menuiserie'],
  toiture: ['Couverture', 'Isolation', 'Ferraillage'],
  toit: ['Couverture', 'Isolation'],
  terrasse: ['Béton', 'Carrelage', 'Maçonnerie'],
  piscine: ['Béton', 'Plomberie', 'Carrelage'],
  mur: ['Maçonnerie', 'Peinture', 'Isolation'],
  cloison: ['Maçonnerie', 'Isolation', 'Menuiserie'],
  sol: ['Carrelage', 'Béton', 'Isolation'],
  plafond: ['Isolation', 'Peinture', 'Menuiserie'],
  electricite: ['Électricité'],
  electrique: ['Électricité'],
  plomberie: ['Plomberie'],
  peinture: ['Peinture'],
  carrelage: ['Carrelage'],
  beton: ['Béton', 'Ferraillage'],
  fondation: ['Béton', 'Ferraillage', 'Maçonnerie'],
  renovation: ['Maçonnerie', 'Peinture', 'Carrelage', 'Plomberie', 'Électricité'],
  construction: ['Maçonnerie', 'Béton', 'Ferraillage', 'Électricité', 'Plomberie'],
  villa: ['Maçonnerie', 'Béton', 'Ferraillage', 'Électricité', 'Plomberie', 'Carrelage', 'Peinture'],
  appartement: ['Maçonnerie', 'Peinture', 'Carrelage', 'Plomberie', 'Électricité'],
  entrepot: ['Béton', 'Ferraillage', 'Couverture', 'Électricité'],
  isolation: ['Isolation'],
  menuiserie: ['Menuiserie'],
  fenetre: ['Menuiserie'],
  porte: ['Menuiserie'],
  facade: ['Peinture', 'Maçonnerie', 'Isolation'],
  etancheite: ['Couverture', 'Isolation'],
  chantier: ['Outillage', 'EPI'],
};

/**
 * Déduit les catégories MongoDB pertinentes depuis le texte du projet.
 * @param {string} text
 * @returns {string[]}
 */
function inferCategories(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const categories = new Set();

  for (const [keyword, mappedCategories] of Object.entries(KEYWORD_TO_CATEGORIES)) {
    if (normalized.includes(keyword)) {
      mappedCategories.forEach((category) => categories.add(category));
    }
  }

  return [...categories];
}

// ── Construction du prompt ────────────────────────────────────────────────────

function buildPrompt({ projectContext, constraintsContext, catalogueJSON }) {
  return `Tu es l'expert d'achat B2B de BMP.tn. Ta mission est de déduire la liste complète des matériaux nécessaires pour le chantier d'un artisan.
Contexte du projet : ${projectContext}
Contraintes : ${constraintsContext}
Catalogue BMP.tn disponible en stock (JSON) : ${catalogueJSON}

Instructions :
1. Analyse le projet et liste tous les matériaux requis.
2. Sélectionne en priorité les produits pertinents dans le "Catalogue BMP.tn" en respectant le budget global.
3. Pour les matériaux manquants, recommande des produits externes.
4. Calcule OBLIGATOIREMENT une quantité estimée pour chaque matériau à partir de la surface, du type d'ouvrage et des contraintes.
5. Donne une unité claire pour chaque quantité (exemples: pièces, kg, m2, m3, ml, rouleaux, sacs).
6. Le champ quantite_recommandee doit être un nombre strictement positif.

TRÈS IMPORTANT:
Tu dois renvoyer UNIQUEMENT un objet JSON valide, sans texte avant ou après.
AUCUN commentaire (//, /* */) n'est autorisé.
AUCUNE virgule finale (trailing comma) dans les listes ou objets.

Structure stricte requise :
{
  "bmp_materials": [
    {
      "productId": "id",
      "name": "nom",
      "price": 0,
      "quantite_recommandee": 0,
      "unite_mesure": "pieces",
      "ai_justification": "pourquoi ce choix"
    }
  ],
  "external_materials": [
    {
      "generic_name": "nom",
      "estimated_price": 0,
      "quantite_recommandee": 0,
      "unite_mesure": "pieces",
      "suggested_brand": "marque connue",
      "search_keyword": "mots clés pour google"
    }
  ]
}`;
}

function parseJsonFromText(text, finishReason) {
  let cleanText = String(text || '').trim();
  
  // Suppression des blocs markdown
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (_error) {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Gemini n'a pas retourné de JSON valide. Raison de fin: ${finishReason}`);
    }
    
    try {
      // Tentative de purification du JSON malformé (commentaires ou virgules finales)
      let regexCleaned = jsonMatch[0]
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,\s*([\]}])/g, '$1');
        
      return JSON.parse(regexCleaned);
    } catch (regexErr) {
      console.error("Texte original:", text);
      console.error("Raison de terminaison:", finishReason);
      throw new Error("Le format JSON généré par l'IA est corrompu ou incomplet. Veuillez réessayer.");
    }
  }
}

// ── Appel Gemini ──────────────────────────────────────────────────────────────

/**
 * Appelle Gemini 1.5 Flash et retourne la réponse JSON parsée.
 *
 * @param {object} params
 * @param {object} params.project       — données projet (Formulaire 1)
 * @param {object} params.constraints   — contraintes brief IA (Formulaire 2)
 * @param {Array}  params.products      — catalogue local allégé [{ _id, name, brand, price, category }]
 * @returns {Promise<{ bmp_materials: Array, external_materials: Array }>}
 */
async function generateRecommendations({ project, constraints, products }) {
  // Reset candidate cursor on each request to avoid stale model/api state.
  getModel({ reset: true });

  const projectContext = JSON.stringify(project || {}, null, 0);
  const constraintsContext = JSON.stringify(constraints || {}, null, 0);
  const catalogueJSON = JSON.stringify(Array.isArray(products) ? products : [], null, 0);

  const prompt = buildPrompt({ projectContext, constraintsContext, catalogueJSON });

  let result;
  const unavailableRetriesByModel = new Map();
  let sawQuotaError = false;
  let sawServiceUnavailableError = false;

  while (true) {
    try {
      result = await _model.generateContent(prompt);
      break;
    } catch (error) {
      sawQuotaError = sawQuotaError || isQuotaError(error);
      sawServiceUnavailableError = sawServiceUnavailableError || isServiceUnavailableError(error);

      if (isServiceUnavailableError(error)) {
        const currentCandidate = `${_selectedApiVersion || 'unknown'}/${_selectedModelName || 'unknown'}`;
        const usedRetries = unavailableRetriesByModel.get(currentCandidate) || 0;

        if (usedRetries < MAX_SERVICE_UNAVAILABLE_RETRIES_PER_MODEL) {
          unavailableRetriesByModel.set(currentCandidate, usedRetries + 1);
          // Backoff court pour indisponibilites transitoires.
          await wait((usedRetries + 1) * 1200);
          continue;
        }

        if (switchToNextCandidate()) {
          continue;
        }

        const err = new Error(`Service Gemini temporairement indisponible. Modeles testes: ${MODEL_CANDIDATES.join(', ')} | API versions: ${API_VERSION_CANDIDATES.join(', ')}`);
        err.code = 'GEMINI_SERVICE_UNAVAILABLE';
        throw err;
      }

      if (isModelNotFoundError(error) && switchToNextCandidate()) {
        continue;
      }

      if (isQuotaError(error) && switchToNextCandidate()) {
        continue;
      }

      if (isQuotaError(error)) {
        const err = new Error(`Quota Gemini atteint. Modeles testes: ${MODEL_CANDIDATES.join(', ')} | API versions: ${API_VERSION_CANDIDATES.join(', ')}`);
        err.code = 'GEMINI_QUOTA_EXHAUSTED';
        throw err;
      }

      if (isModelNotFoundError(error)) {
        if (sawQuotaError) {
          const err = new Error(`Quota Gemini atteint sur les modeles disponibles. Modeles testes: ${MODEL_CANDIDATES.join(', ')} | API versions: ${API_VERSION_CANDIDATES.join(', ')}`);
          err.code = 'GEMINI_QUOTA_EXHAUSTED';
          throw err;
        }

        if (sawServiceUnavailableError) {
          const err = new Error(`Service Gemini temporairement indisponible sur les modeles disponibles. Modeles testes: ${MODEL_CANDIDATES.join(', ')} | API versions: ${API_VERSION_CANDIDATES.join(', ')}`);
          err.code = 'GEMINI_SERVICE_UNAVAILABLE';
          throw err;
        }

        const err = new Error(`Aucun modele Gemini compatible trouve. Modeles testes: ${MODEL_CANDIDATES.join(', ')} | API versions: ${API_VERSION_CANDIDATES.join(', ')}`);
        err.code = 'GEMINI_MODEL_NOT_FOUND';
        throw err;
      }

      throw error;
    }
  }

  const response = result.response;
  const finishReason = response.candidates?.[0]?.finishReason;
  const text = response.text();

  if (finishReason === 'MAX_TOKENS') {
    console.warn("[aiShopper] L'IA a atteint la limite de tokens en générant la réponse.");
  }

  const parsed = parseJsonFromText(text, finishReason);

  return {
    bmp_materials: Array.isArray(parsed?.bmp_materials) ? parsed.bmp_materials : [],
    external_materials: Array.isArray(parsed?.external_materials) ? parsed.external_materials : [],
  };
}

function getActiveModelName() {
  return _selectedModelName || MODEL_CANDIDATES[0] || null;
}

function getActiveApiVersion() {
  return _selectedApiVersion || API_VERSION_CANDIDATES[0] || null;
}

module.exports = {
  inferCategories,
  generateRecommendations,
  buildPrompt,
  getActiveModelName,
  getActiveApiVersion,
};
