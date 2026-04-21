/**
 * conversionService.js — BMP.tn
 * ────────────────────────────────
 * Convertit une surface / volume / longueur artisan
 * en quantité de produit à commander.
 *
 * Logique : quantité = surface × facteur × (1 + marge_sécurité)
 *
 * Toutes les valeurs sont arrondies à l'entier supérieur (Math.ceil).
 */

// ── Marge de sécurité globale (+10%) ─────────────────────────────────────────
const DEFAULT_SAFETY_MARGIN = 0.10;

// ── Mots-clés caractéristiques de chaque catégorie ───────────────────────────
// Utilisés dans le score de compatibilité surface (Phase 2).
const CATEGORY_SURFACE_KEYWORDS = {
  'Maçonnerie':  ['parpaing', 'bloc', 'brique', 'mur', 'cloison', 'alveolaire', 'porteur', 'macon'],
  'Béton':       ['ciment', 'sac', 'mortier', 'beton', 'mpa', 'rapide', 'resistance', 'coulis'],
  'Ferraillage': ['acier', 'barre', 'ha', 'treillis', 'armature', 'fy', 'lamine'],
  'Électricité': ['cable', 'fil', 'gaine', 'section', 'mm2', 'ampere', 'electrique'],
  'Plomberie':   ['tuyau', 'diametre', 'raccord', 'pression', 'sanitaire', 'pvc', 'multicouche'],
  'Menuiserie':  ['bois', 'panneau', 'planche', 'essence', 'massif', 'contreplaque', 'osb', 'mdf'],
  'Isolation':   ['isolant', 'epaisseur', 'thermique', 'acoustique', 'rouleau', 'panneau', 'lambda'],
  'Carrelage':   ['carrelage', 'sol', 'faience', 'gres', 'ceramique', 'format', 'poli', 'rectifie'],
  'Peinture':    ['peinture', 'litre', 'couche', 'mat', 'satin', 'brillant', 'glycero', 'acrylique'],
  'Couverture':  ['tuile', 'ardoise', 'bac', 'chevauchement', 'etancheite', 'couverture'],
  'Outillage':   ['puissance', 'watts', 'rpm', 'garantie', 'perforateur', 'meuleuse'],
  'EPI':         ['protection', 'securite', 'norme', 'certifie', 'harnais', 'casque'],
};

// ── Table de conversion principale ───────────────────────────────────────────
//
// Structure : CONVERSION_TABLE[catégorie][unité] = { factor, label }
//
//   factor : multiplicateur appliqué à la surface/volume/longueur
//   label  : explication affichée à l'artisan
//
// Convention :
//   m²    → surface (carrelage, peinture, maçonnerie…)
//   m³    → volume  (béton, ciment, remblai…)
//   m     → linéaire (câble, tuyau, barre d'acier…)
//   pièce → unité directe (porte, fenêtre, casque…)

const CONVERSION_TABLE = {

  'Maçonnerie': {
    'm²':    { factor: 10,    label: '10 blocs de 20×20×40cm par m² de mur' },
    'm³':    { factor: 100,   label: '~100 blocs par m³ de maçonnerie' },
    'm':     { factor: 5,     label: '5 blocs par mètre linéaire de mur' },
    'pièce': { factor: 1,     label: 'Quantité directe en unités' },
  },

  'Béton': {
    'm²':    { factor: 0.08,  label: 'Dalle de 8 cm : 0,08 m³/m²' },
    'm³':    { factor: 7,     label: '7 sacs de ciment 50 kg par m³ de béton' },
    'm':     { factor: 0.04,  label: 'Estimation linéaire (poteau, longrine)' },
    'pièce': { factor: 1,     label: 'Quantité directe en unités' },
  },

  'Ferraillage': {
    'm²':    { factor: 3,     label: '3 ml de barre HA par m² (espacement 30 cm)' },
    'm³':    { factor: 80,    label: '80 kg de fer par m³ de béton armé' },
    'm':     { factor: 1,     label: 'Barre par mètre linéaire' },
    'pièce': { factor: 1,     label: 'Quantité directe en unités' },
  },

  'Électricité': {
    'm²':    { factor: 3,     label: '3 m de câble par m² de pièce' },
    'm':     { factor: 1,     label: 'Mètre de câble ou gaine' },
    'pièce': { factor: 1,     label: 'Quantité directe en unités' },
  },

  'Plomberie': {
    'm²':    { factor: 2,     label: '2 m de tuyau par m² de pièce' },
    'm':     { factor: 1,     label: 'Mètre de tuyau ou raccord' },
    'pièce': { factor: 1,     label: 'Quantité directe en unités' },
  },

  'Menuiserie': {
    'm²':    { factor: 1,     label: 'Panneau ou planche par m²' },
    'm':     { factor: 1,     label: 'Mètre linéaire (liteaux, tasseaux)' },
    'pièce': { factor: 1,     label: 'Quantité directe (porte, fenêtre…)' },
  },

  'Isolation': {
    'm²':    { factor: 1,     label: '1 m² d\'isolant par m² à couvrir' },
    'm³':    { factor: 1,     label: '1 m³ d\'isolant en vrac' },
    'pièce': { factor: 1,     label: 'Rouleau ou panneau direct' },
  },

  'Carrelage': {
    'm²':    { factor: 1.05,  label: '+5% de casse inclus' },
    'pièce': { factor: 1,     label: 'Quantité directe en carreaux' },
  },

  'Peinture': {
    'm²':    { factor: 0.125, label: '~8 m² par litre (2 couches, 250 ml/m²)' },
    'pièce': { factor: 1,     label: 'Pot ou bidon direct' },
  },

  'Couverture': {
    'm²':    { factor: 1.15,  label: '+15% pour le chevauchement des tuiles' },
    'pièce': { factor: 1,     label: 'Tuile ou ardoise à l\'unité' },
  },

  'Outillage': {
    'pièce': { factor: 1,     label: 'Outil à l\'unité' },
  },

  'EPI': {
    'pièce': { factor: 1,     label: 'Équipement à l\'unité' },
  },
};

// ── Unités disponibles par catégorie ─────────────────────────────────────────
// Ordre préféré affiché dans le select du formulaire.
const UNITS_BY_CATEGORY = {
  'Maçonnerie':  ['m²', 'm', 'm³', 'pièce'],
  'Béton':       ['m³', 'm²', 'm', 'pièce'],
  'Ferraillage': ['m', 'm²', 'm³', 'pièce'],
  'Électricité': ['m', 'm²', 'pièce'],
  'Plomberie':   ['m', 'm²', 'pièce'],
  'Menuiserie':  ['m²', 'm', 'pièce'],
  'Isolation':   ['m²', 'm³', 'pièce'],
  'Carrelage':   ['m²', 'pièce'],
  'Peinture':    ['m²', 'pièce'],
  'Couverture':  ['m²', 'pièce'],
  'Outillage':   ['pièce'],
  'EPI':         ['pièce'],
};

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Calcule la quantité de produit à partir de la surface/volume/longueur.
 *
 * @param {number} surface  - Valeur saisie par l'artisan
 * @param {string} unit     - Unité : 'm²' | 'm³' | 'm' | 'pièce'
 * @param {string} category - Catégorie produit
 * @param {number} [margin] - Marge de sécurité (défaut : 0.10 = +10%)
 * @returns {{
 *   quantity:    number,   // quantité arrondie au supérieur (avec marge)
 *   rawQuantity: number,   // quantité brute avant marge
 *   factor:      number,   // facteur utilisé
 *   label:       string,   // explication du calcul
 *   formula:     string,   // formule lisible (ex: "15 m² × 10 = 150 + 10% = 165")
 * }}
 */
function calculateQuantity(surface, unit, category, margin = DEFAULT_SAFETY_MARGIN, applyMargin = true) {
  const catTable  = CONVERSION_TABLE[category];
  const rule      = catTable?.[unit] || catTable?.['pièce'] || { factor: 1, label: 'Quantité directe' };

  const effectiveMargin = applyMargin ? margin : 0;
  const raw             = surface * rule.factor;
  const withMargin      = raw * (1 + effectiveMargin);
  const quantity        = Math.max(1, Math.ceil(withMargin));

  const marginStr = applyMargin ? ` + ${Math.round(margin * 100)}%` : '';

  return {
    quantity,
    rawQuantity:  Math.ceil(raw),
    factor:       rule.factor,
    label:        rule.label,
    formula:      `${surface} ${unit} × ${rule.factor} = ${Math.ceil(raw)}${marginStr} = ${quantity} unités`,
    applyMargin,
  };
}

/**
 * Retourne les unités disponibles pour une catégorie donnée.
 * Inclut toujours 'pièce' comme fallback.
 *
 * @param {string} category
 * @returns {string[]}
 */
function getUnitsForCategory(category) {
  return UNITS_BY_CATEGORY[category] || ['pièce'];
}

/**
 * Retourne les mots-clés caractéristiques d'une catégorie.
 * Utilisé par scoreCompatibiliteSurface dans le moteur de scoring.
 *
 * @param {string} category
 * @returns {string[]}
 */
function getCategoryKeywords(category) {
  return CATEGORY_SURFACE_KEYWORDS[category] || [];
}

/**
 * Liste toutes les catégories disponibles (ordonnées alphabétiquement).
 * @returns {string[]}
 */
function getAllCategories() {
  return Object.keys(CONVERSION_TABLE).sort();
}

module.exports = {
  calculateQuantity,
  getUnitsForCategory,
  getCategoryKeywords,
  getAllCategories,
  CONVERSION_TABLE,
  CATEGORY_SURFACE_KEYWORDS,
  DEFAULT_SAFETY_MARGIN,
};
