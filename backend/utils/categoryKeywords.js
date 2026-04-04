/**
 * categoryKeywords.js — BMP.tn
 * ─────────────────────────────
 * Dictionnaire sémantique : mots-clés de description de projet → catégorie produit.
 * Utilisé en Phase 0 du moteur de recommandation.
 *
 * Structure de chaque entrée :
 *   keywords        : mots détectés dans la DESCRIPTION DU PROJET (texte artisan)
 *   categoryPatterns: regex pour filtrer les produits en base de données
 */

const CATEGORY_DEFINITIONS = {

  'Maçonnerie': {
    keywords: [
      'mur', 'murs', 'parpaing', 'brique', 'mortier', 'maconnerie', 'maçonnerie',
      'bloc', 'agglo', 'moellon', 'cloison', 'crepissage', 'crepi', 'façade',
      'facade', 'montant', 'jointoyage', 'joint', 'maçon', 'macon',
      'mur porteur', 'mur mitoyen', 'mur exterieur', 'ciment colle',
    ],
    categoryPatterns: [/maç?onnerie/i, /maconnerie/i],
  },

  'Béton': {
    keywords: [
      'beton', 'béton', 'fondation', 'dalle', 'hourdis', 'terrasse',
      'coulage', 'coule', 'coulé', 'semelle', 'radier', 'chainage',
      'coffrage', 'vibration', 'ciment', 'poteau beton', 'poutre beton',
      'plancher', 'chape', 'ragréage', 'ragrage', 'sous-couche beton',
    ],
    categoryPatterns: [/b[eé]ton/i, /ciment/i],
  },

  'Ferraillage': {
    keywords: [
      'fer', 'acier', 'ferraille', 'armature', 'barre', 'treillis',
      'rond a beton', 'rond à béton', 'ha8', 'ha10', 'ha12', 'ha14', 'ha16',
      'ipn', 'ipr', 'hea', 'heb', 'profile acier', 'lamine', 'laminé',
      'structure metallique', 'structure métallique', 'charpente metallique',
    ],
    categoryPatterns: [/ferraillage/i, /acier/i, /m[eé]tal/i, /ferraille/i],
  },

  'Électricité': {
    keywords: [
      'electricite', 'électricité', 'electrique', 'électrique',
      'cable', 'câble', 'fil', 'gaine', 'tableau', 'interrupteur',
      'prise', 'disjoncteur', 'fusible', 'eclairage', 'éclairage',
      'lampe', 'luminaire', 'connecteur', 'installation electrique',
      'basse tension', 'haute tension', 'mise en norme electrique',
      'tableau electrique', 'câblage', 'cablage',
    ],
    categoryPatterns: [/[eé]lectricit[eé]/i, /[eé]lectrique/i],
  },

  'Plomberie': {
    keywords: [
      'plomberie', 'tuyau', 'robinet', 'raccord', 'vanne', 'siphon',
      'evacuation', 'évacuation', 'sanitaire', 'wc', 'toilette',
      'salle de bain', 'douche', 'baignoire', 'lavabo', 'tuyauterie',
      'canalisations', 'assainissement', 'fosse', 'fosse septique',
      'pompe eau', 'chauffe eau', 'chauffe-eau', 'ballon eau chaude',
      'alimentation eau', 'reseau eau',
    ],
    categoryPatterns: [/plomberie/i, /sanitaire/i, /hydraulique/i],
  },

  'Menuiserie': {
    keywords: [
      'bois', 'menuiserie', 'porte', 'fenetre', 'fenêtre', 'volet',
      'huisserie', 'chassis', 'parquet', 'lambris', 'bardage',
      'boiserie', 'placage', 'contreplaque', 'contre-plaqué',
      'panneaux bois', 'osb', 'mdf', 'planche', 'chevron',
      'liteaux', 'tasseaux', 'porte interieure', 'porte exterieure',
    ],
    categoryPatterns: [/menuiserie/i, /bois/i, /charpente bois/i],
  },

  'Isolation': {
    keywords: [
      'isolation', 'isolant', 'laine', 'polystyrene', 'polystyrène',
      'mousse', 'pare-vapeur', 'thermique', 'acoustique', 'phonique',
      'ite', 'sarking', 'soufflage', 'coton', 'fibre', 'membrane isolante',
      'isolation toiture', 'isolation mur', 'isolation sol', 'pont thermique',
    ],
    categoryPatterns: [/isolation/i, /isolant/i, /thermique/i],
  },

  'Carrelage': {
    keywords: [
      'carrelage', 'carreau', 'faience', 'faïence', 'mosaique', 'mosaïque',
      'sol carrelage', 'revêtement sol', 'revetement', 'pose carrelage',
      'colle carrelage', 'joint carrelage', 'gres', 'grès',
      'ceramique', 'céramique', 'pierre naturelle', 'marbre', 'granit',
    ],
    categoryPatterns: [/carrelage/i, /carreau/i, /fa[iï]ence/i, /c[eé]ramique/i],
  },

  'Peinture': {
    keywords: [
      'peinture', 'enduit', 'vernis', 'lasure', 'primaire', 'sous-couche',
      'badigeon', 'teinte', 'couleur', 'finition', 'laque', 'satine',
      'mat', 'brillant', 'glycero', 'glycéro', 'acrylique',
      'peinture interieure', 'peinture exterieure', 'ravalement',
    ],
    categoryPatterns: [/peinture/i, /enduit/i, /vernis/i, /lasure/i],
  },

  'Couverture': {
    keywords: [
      'couverture', 'toiture', 'toit', 'tuile', 'ardoise', 'zinc',
      'bac acier', 'gouttiere', 'gouttière', 'etancheite', 'étanchéité',
      'membrane toiture', 'shingle', 'zinguerie', 'faitage',
      'chevron toiture', 'liteaux toiture', 'couverture terrasse',
    ],
    categoryPatterns: [/couverture/i, /toiture/i, /toit/i],
  },

  'Outillage': {
    keywords: [
      'perforateur', 'meuleuse', 'outil', 'scie', 'marteau', 'niveau',
      'echafaudage', 'échafaudage', 'banche', 'coffrages',
      'melangeur', 'mélangeur', 'malaxeur', 'betonniere', 'bétonière',
      'compacteur', 'vibreur', 'tronconneuse', 'burineur', 'cloueuse',
    ],
    categoryPatterns: [/outillage/i, /outil/i, /mat[eé]riel/i],
  },

  'EPI': {
    keywords: [
      'casque', 'gants', 'lunettes protection', 'securite', 'sécurité',
      'epi', 'protection individuelle', 'gilet', 'chaussure securite',
      'harnais', 'masque', 'bouchon oreille', 'anti-bruit', 'combinaison',
      'equipement protection', 'équipement protection',
    ],
    categoryPatterns: [/epi/i, /s[eé]curit[eé]/i, /protection individuelle/i],
  },

};

// ── Analyse sémantique ────────────────────────────────────────────────────────

/**
 * Normalise une chaîne : minuscule, sans accent, sans ponctuation.
 */
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phase 0 — Analyse sémantique de la description du projet.
 *
 * Lit le texte du projet + la contrainte artisan, compte les mots-clés
 * correspondant à chaque catégorie, et retourne la catégorie gagnante.
 *
 * @param {string} projectText  - Titre + description + catégorie du projet
 * @param {string} [constraint] - Contrainte technique saisie par l'artisan
 * @returns {{
 *   category: string|null,
 *   confidence: number,
 *   matchCount: number,
 *   matchedKeywords: string[],
 *   categoryPatterns: RegExp[],
 *   allScores: object
 * }}
 */
function analyzeProjectDescription(projectText, constraint = '') {
  const combined = norm([projectText, constraint].filter(Boolean).join(' '));

  // Description trop courte → pas de détection
  if (combined.length < 4) {
    return { category: null, confidence: 0, matchCount: 0, matchedKeywords: [], categoryPatterns: [], allScores: {} };
  }

  const allScores = {};
  let bestCategory      = null;
  let bestCount         = 0;
  let bestMatchedKws    = [];
  let bestPatterns      = [];

  for (const [category, def] of Object.entries(CATEGORY_DEFINITIONS)) {
    const matched = def.keywords.filter((kw) => combined.includes(norm(kw)));
    allScores[category] = matched.length;

    if (matched.length > bestCount) {
      bestCount      = matched.length;
      bestCategory   = category;
      bestMatchedKws = matched;
      bestPatterns   = def.categoryPatterns;
    }
  }

  // Au moins 1 mot-clé requis pour valider la détection
  if (bestCount === 0) {
    return { category: null, confidence: 0, matchCount: 0, matchedKeywords: [], categoryPatterns: [], allScores };
  }

  // Confiance : 1 mot = faible, 3+ mots = haute
  const confidence = Math.min(1, bestCount / 3);

  return {
    category:        bestCategory,
    confidence:      parseFloat(confidence.toFixed(2)),
    matchCount:      bestCount,
    matchedKeywords: bestMatchedKws,
    categoryPatterns: bestPatterns,
    allScores,
  };
}

module.exports = { CATEGORY_DEFINITIONS, analyzeProjectDescription, norm };
