/**
 * projectAnalyzer.js
 * ------------------
 * Analyse le titre + la description du projet pour detecter le type majoritaire.
 */

const projectTypeKeywords = {
  'Maconnerie': ['parpaing', 'brique', 'mortier', 'ciment', 'bloc', 'chaux', 'enduit'],
  'Electricite': ['cable', 'disjoncteur', 'prise', 'interrupteur', 'gaine', 'tableau'],
  'Plomberie': ['tuyau', 'robinet', 'lavabo', 'wc', 'flexible', 'raccord', 'per'],
  'Menuiserie': ['bois', 'porte', 'fenetre', 'charpente', 'panneau', 'osb'],
  'Beton & Ciment': ['beton', 'ciment', 'dalle', 'fondation', 'chape'],
  'Ferraillage': ['acier', 'fer', 'treillis', 'armature', 'ha'],
  'Peinture': ['peinture', 'sous couche', 'vernis', 'lasure'],
  'Outillage': ['perforateur', 'meuleuse', 'visseuse', 'marteau', 'perceuse'],
  'EPI': ['casque', 'gants', 'lunettes', 'harnais', 'chaussures'],
};

const categoryToProjectType = {
  'Maconnerie': 'Maconnerie',
  'Electricite': 'Electricite',
  'Plomberie': 'Plomberie',
  'Menuiserie': 'Menuiserie',
  'Beton': 'Beton & Ciment',
  'Beton & Ciment': 'Beton & Ciment',
  'Ferraillage': 'Ferraillage',
  'Peinture': 'Peinture',
  'Outillage': 'Outillage',
  'EPI': 'EPI',
};

function normalise(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(normalizedText, keyword) {
  const kw = normalise(keyword);
  if (!kw) return false;

  if (kw.includes(' ')) {
    return normalizedText.includes(kw);
  }

  const re = new RegExp(`(^|\\s)${escapeRegex(kw)}(\\s|$)`);
  return re.test(normalizedText);
}

function mapCategoryToProjectType(category) {
  const normalizedCategory = normalise(category);
  for (const [rawCategory, mappedType] of Object.entries(categoryToProjectType)) {
    if (normalise(rawCategory) === normalizedCategory) {
      return mappedType;
    }
  }
  return null;
}

/**
 * Detecte le type de projet majoritaire depuis le titre + description.
 * Si aucun mot-cle n'est detecte, fallback sur la categorie demandee.
 */
function detectProjectType({ title = '', description = '', fallbackCategory = '' } = {}) {
  const rawText = `${title || ''} ${description || ''}`.trim();
  const normalizedText = normalise(rawText);

  const scoreByType = {};
  const keywordsByType = {};

  for (const [type, keywords] of Object.entries(projectTypeKeywords)) {
    const matched = keywords.filter((kw) => containsKeyword(normalizedText, kw));
    scoreByType[type] = matched.length;
    keywordsByType[type] = matched;
  }

  const rankedTypes = Object.entries(scoreByType)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => ({ type, score, matchedKeywords: keywordsByType[type] || [] }));

  let primaryType = rankedTypes[0]?.type || null;
  const fallbackType = mapCategoryToProjectType(fallbackCategory);

  if (rankedTypes.length > 1 && rankedTypes[0].score === rankedTypes[1].score && fallbackType) {
    const tieScore = rankedTypes[0].score;
    const fallbackInTie = rankedTypes.find((r) => r.type === fallbackType && r.score === tieScore);
    if (fallbackInTie) {
      primaryType = fallbackType;
    }
  }

  if (!primaryType && fallbackType) {
    primaryType = fallbackType;
  }

  const matchedKeywords = primaryType ? (keywordsByType[primaryType] || []) : [];
  const maxKeywordsForType = primaryType ? (projectTypeKeywords[primaryType]?.length || 1) : 1;
  const primaryScore = primaryType ? (scoreByType[primaryType] || 0) : 0;
  const confidence = primaryType ? Math.min(1, primaryScore / maxKeywordsForType) : 0;

  return {
    primaryType,
    confidence: Number(confidence.toFixed(3)),
    rankedTypes,
    scoreByType,
    matchedKeywords,
    usedFallback: primaryScore === 0 && !!primaryType,
    text: rawText,
  };
}

module.exports = {
  projectTypeKeywords,
  categoryToProjectType,
  normalise,
  containsKeyword,
  mapCategoryToProjectType,
  detectProjectType,
};
