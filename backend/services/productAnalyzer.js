/**
 * productAnalyzer.js
 * ------------------
 * Verifie la coherence semantique produit <-> type de projet.
 */

const {
  projectTypeKeywords,
  normalise,
  containsKeyword,
} = require('./projectAnalyzer');

const GENERIC_TERMS = new Set([
  'produit',
  'materiau',
  'materiaux',
  'construction',
  'qualite',
  'professionnel',
  'standard',
  'usage',
  'general',
  'universel',
  'performance',
  'durable',
]);

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return String(value)
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectProductSources(product, techProfile) {
  const keywordList = asList(product?.keywords);
  const pdfParts = [
    ...(techProfile?.keywords || []),
    ...(techProfile?.materials || []),
    ...(techProfile?.norms || []),
    ...(techProfile?.certifications || []),
    ...(techProfile?.resistance || []),
  ];

  return {
    name: product?.name || '',
    description: product?.description || '',
    keywords: keywordList.join(' '),
    pdf: pdfParts.join(' '),
  };
}

function computeGenericRatio(normalizedText) {
  const tokens = normalizedText.split(' ').filter((w) => w.length >= 3);
  if (!tokens.length) return 0;

  const genericCount = tokens.filter((t) => GENERIC_TERMS.has(t)).length;
  return genericCount / tokens.length;
}

/**
 * Analyse un produit pour un type de projet.
 *
 * Regles:
 * - >= 2 mots-cles du type projet: forte correspondance, bonus +10
 * - 1 mot-cle: correspondance faible, score neutre
 * - 0 mot-cle: produit elimine
 */
function analyzeProductForProjectType({ product, projectType, techProfile }) {
  const expectedKeywords = projectTypeKeywords[projectType] || [];

  // Si type inconnu/non mappe: on ne filtre pas agressivement.
  if (!expectedKeywords.length) {
    return {
      projectType,
      matchCount: 0,
      matchedKeywords: [],
      matchStrength: 'unknown',
      bonus: 0,
      penalty: 0,
      shouldFilter: false,
      sourceHits: { name: [], description: [], keywords: [], pdf: [] },
      genericRatio: 0,
    };
  }

  const sources = collectProductSources(product, techProfile);
  const normalizedBySource = {
    name: normalise(sources.name),
    description: normalise(sources.description),
    keywords: normalise(sources.keywords),
    pdf: normalise(sources.pdf),
  };

  const combinedText = normalise(
    [sources.name, sources.description, sources.keywords, sources.pdf].join(' ')
  );

  const sourceHits = { name: [], description: [], keywords: [], pdf: [] };
  const matchedSet = new Set();

  for (const kw of expectedKeywords) {
    if (!containsKeyword(combinedText, kw)) continue;

    matchedSet.add(kw);
    if (containsKeyword(normalizedBySource.name, kw)) sourceHits.name.push(kw);
    if (containsKeyword(normalizedBySource.description, kw)) sourceHits.description.push(kw);
    if (containsKeyword(normalizedBySource.keywords, kw)) sourceHits.keywords.push(kw);
    if (containsKeyword(normalizedBySource.pdf, kw)) sourceHits.pdf.push(kw);
  }

  const matchedKeywords = Array.from(matchedSet);
  const matchCount = matchedKeywords.length;

  let matchStrength = 'none';
  if (matchCount >= 2) matchStrength = 'strong';
  else if (matchCount === 1) matchStrength = 'weak';

  const genericRatio = computeGenericRatio(combinedText);

  let bonus = 0;
  if (matchStrength === 'strong') bonus = 10;

  // Penalite si description trop generique
  let penalty = 0;
  if (genericRatio >= 0.35) {
    penalty = matchStrength === 'strong' ? 2 : 1;
  }

  return {
    projectType,
    matchCount,
    matchedKeywords,
    matchStrength,
    bonus,
    penalty,
    shouldFilter: matchStrength === 'none',
    sourceHits,
    genericRatio: Number(genericRatio.toFixed(3)),
  };
}

module.exports = {
  GENERIC_TERMS,
  collectProductSources,
  analyzeProductForProjectType,
};
