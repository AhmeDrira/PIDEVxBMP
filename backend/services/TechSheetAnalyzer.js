/**
 * TechSheetAnalyzer
 * -----------------
 * Extracts a structured technical profile from a product's PDF tech sheet.
 * Results are cached in MongoDB (TechSheetCache) and invalidated when
 * the product's techSheetUrl changes.
 */

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');
const TechSheetCache = require('../models/TechSheetCache');

// Lazy-require pdf-parse to avoid crashing if package is missing
let pdfParse;
try { pdfParse = require('pdf-parse'); } catch { pdfParse = null; }

// ── Entity extraction patterns ────────────────────────────────────────────────

const PATTERNS = {
  norms: [
    /\bNF\s?(?:EN\s?)?\w[\w-]*/gi,
    /\bISO\s?\d[\d-]*/gi,
    /\bEN\s?\d[\d-]*/gi,
    /\bASTM\s?\w[\w-]*/gi,
    /\bDIN\s?\d[\d-]*/gi,
    /\bBS\s?\d[\d-]*/gi,
    /\bCE\s?\d[\d-]*/gi,
    /\bNFB\w*/gi,
    /\bNFP\w*/gi,
  ],
  certifications: [
    /\b(?:CE|CSTBat|Avis\sTechnique|ATec|ACERMI|CSTB|QPE)\b/gi,
    /certifi[ée](?:s?)\b/gi,
    /homologu[ée](?:s?)\b/gi,
    /\bLabel\s+\w+/gi,
  ],
  resistance: [
    /\d+(?:[.,]\d+)?\s?MPa/gi,
    /\d+(?:[.,]\d+)?\s?N\/mm[²2]/gi,
    /\d+(?:[.,]\d+)?\s?kN/gi,
    /R[ct]\s?\d+/gi,
    /résistance\s+(?:à\s+)?\w+/gi,
    /\bfc\s*=?\s*\d+/gi,
    /\bfyk\s*=?\s*\d+/gi,
  ],
  dimensions: [
    /\d+(?:[.,]\d+)?\s?[×xX]\s?\d+(?:[.,]\d+)?(?:\s?[×xX]\s?\d+(?:[.,]\d+)?)?\s?mm\b/gi,
    /\d+(?:[.,]\d+)?\s?cm\b/gi,
    /\d+(?:[.,]\d+)?\s?m\b(?!\w)/gi,
    /\d+(?:[.,]\d+)?\s?mm\b/gi,
    /épaisseur\s*:?\s*\d+/gi,
    /largeur\s*:?\s*\d+/gi,
    /longueur\s*:?\s*\d+/gi,
  ],
  environment: [
    /ext[ée]rieur/gi,
    /int[ée]rieur/gi,
    /humide?/gi,
    /immerge[ée]?/gi,
    /temp[ée]rature\s*:?\s*-?\d+/gi,
    /classe\s+d['']exposition/gi,
    /\bXC\d\b/gi,
    /\bXS\d\b/gi,
    /\bXF\d\b/gi,
    /\bXA\d\b/gi,
  ],
  safety: [
    /\b[ABM][012s]\b/g,
    /feu\b/gi,
    /incendi/gi,
    /inflam(?:m)?able/gi,
    /non.inflam(?:m)?able/gi,
    /Euroclasse/gi,
    /REACH/gi,
    /CLP\b/gi,
    /SGH\b/gi,
  ],
  materials: [
    /\bb[ée]ton(?:\s+arm[ée])?\b/gi,
    /\bacier\b/gi,
    /\bbois\b/gi,
    /\bPVC\b/gi,
    /\baluminium\b/gi,
    /\bpolystyr[eè]ne\b/gi,
    /\bfibres?\s+de\s+\w+/gi,
    /\bverre\b/gi,
    /\bbriques?\b/gi,
    /\bpl[aâ]tre\b/gi,
    /\bm[oa]rtar?\b/gi,
    /\bciment\b/gi,
    /\bgrès\b/gi,
  ],
};

// Generic domain keywords used for keyword extraction
const DOMAIN_KEYWORDS = [
  'isolation', 'étanchéité', 'drainage', 'fondation', 'toiture', 'façade',
  'cloison', 'plancher', 'dalle', 'poutre', 'poteau', 'mur', 'voile',
  'revêtement', 'carrelage', 'peinture', 'enduit', 'mortier', 'colle',
  'fixation', 'vis', 'boulon', 'cheville', 'rail', 'plaque',
  'tube', 'tuyau', 'câble', 'gaine', 'robinet', 'vanne',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a techSheetUrl to an absolute local file path, or null if remote */
function resolveLocalPath(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return null; // remote
  // Relative path → resolve against backend root
  const backendRoot = path.resolve(__dirname, '..');
  const cleaned = url.replace(/^\/+/, '');
  const candidate = path.join(backendRoot, cleaned);
  return candidate;
}

/** Download a remote URL to a Buffer */
async function fetchRemoteBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(response.data);
}

/** Parse PDF bytes to text using pdf-parse; throws if unavailable */
async function parsePdfBuffer(buffer) {
  if (!pdfParse) throw new Error('pdf-parse not installed');
  const data = await pdfParse(buffer, { max: 0 });
  return data.text || '';
}

/** Extract all regex matches (unique, trimmed) from text */
function extractMatches(text, patterns) {
  const seen = new Set();
  const results = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const val = m[0].trim();
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        results.push(val);
      }
    }
  }
  return results;
}

/** Extract domain keywords present in text */
function extractKeywords(text) {
  const lower = text.toLowerCase();
  return DOMAIN_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Compute extraction confidence [0,1] from text + profile */
function computeConfidence(text, profile) {
  if (!text || text.length < 50) return 0;
  const entityCount = Object.values(profile).flat().length;
  const textScore   = Math.min(1, text.length / 3000);   // full confidence ≥ 3000 chars
  const entityScore = Math.min(1, entityCount / 10);     // full confidence ≥ 10 entities
  return parseFloat((0.5 * textScore + 0.5 * entityScore).toFixed(3));
}

// ── Core analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze a PDF and return a structured technical profile.
 * Does NOT interact with the cache — pure logic.
 */
async function analyzePdf(techSheetUrl) {
  let buffer;
  const localPath = resolveLocalPath(techSheetUrl);

  if (localPath) {
    if (!fs.existsSync(localPath)) {
      throw new Error(`Tech sheet file not found: ${localPath}`);
    }
    buffer = fs.readFileSync(localPath);
  } else {
    buffer = await fetchRemoteBuffer(techSheetUrl);
  }

  const text = await parsePdfBuffer(buffer);

  const profile = {
    norms:          extractMatches(text, PATTERNS.norms),
    certifications: extractMatches(text, PATTERNS.certifications),
    resistance:     extractMatches(text, PATTERNS.resistance),
    dimensions:     extractMatches(text, PATTERNS.dimensions),
    environment:    extractMatches(text, PATTERNS.environment),
    safety:         extractMatches(text, PATTERNS.safety),
    materials:      extractMatches(text, PATTERNS.materials),
    keywords:       extractKeywords(text),
  };

  const confidence = computeConfidence(text, profile);

  return { text, profile, confidence };
}

// ── Cache-aware public API ────────────────────────────────────────────────────

/**
 * Get a cached analysis for a product, or run analysis and cache it.
 *
 * @param {object} product  - Mongoose Product document (needs _id + techSheetUrl)
 * @param {boolean} force   - Force re-analysis even if cache is fresh
 * @returns {object}        - { profile, confidence, success, errorMessage, fromCache }
 */
async function getOrAnalyze(product, force = false) {
  const techSheetUrl = (product.techSheetUrl || '').trim();

  // Check cache
  if (!force) {
    const cached = await TechSheetCache.findOne({ productId: product._id });
    if (cached && cached.techSheetUrl === techSheetUrl && cached.success) {
      return {
        profile:      cached.profile,
        confidence:   cached.confidence,
        success:      true,
        errorMessage: '',
        fromCache:    true,
        extractedText: cached.extractedText,
      };
    }
  }

  // No PDF → return empty profile with low confidence penalty
  if (!techSheetUrl) {
    const empty = {
      productId:    product._id,
      techSheetUrl: '',
      extractedText: '',
      profile:      { norms: [], certifications: [], resistance: [], dimensions: [], environment: [], safety: [], materials: [], keywords: [] },
      confidence:   0,
      success:      false,
      errorMessage: 'No tech sheet URL provided',
    };
    await TechSheetCache.findOneAndUpdate(
      { productId: product._id },
      { ...empty, analyzedAt: new Date() },
      { upsert: true, new: true }
    );
    return { ...empty, fromCache: false };
  }

  // Run analysis
  try {
    const { text, profile, confidence } = await analyzePdf(techSheetUrl);
    const record = {
      productId:    product._id,
      techSheetUrl,
      extractedText: text.slice(0, 20000), // cap stored text at 20k chars
      profile,
      confidence,
      success:      true,
      errorMessage: '',
      analyzedAt:   new Date(),
    };
    await TechSheetCache.findOneAndUpdate(
      { productId: product._id },
      record,
      { upsert: true, new: true }
    );
    return { profile, confidence, success: true, errorMessage: '', fromCache: false, extractedText: text };
  } catch (err) {
    const record = {
      productId:    product._id,
      techSheetUrl,
      extractedText: '',
      profile:      { norms: [], certifications: [], resistance: [], dimensions: [], environment: [], safety: [], materials: [], keywords: [] },
      confidence:   0,
      success:      false,
      errorMessage: err.message,
      analyzedAt:   new Date(),
    };
    await TechSheetCache.findOneAndUpdate(
      { productId: product._id },
      record,
      { upsert: true, new: true }
    );
    return { ...record, fromCache: false };
  }
}

/**
 * Force re-analysis of a product's tech sheet (invalidates cache).
 */
async function forceAnalyze(product) {
  return getOrAnalyze(product, true);
}

module.exports = { getOrAnalyze, forceAnalyze, analyzePdf, extractMatches, computeConfidence };
