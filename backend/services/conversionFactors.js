/**
 * conversionFactors.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Dictionnaire des facteurs de conversion par NOM DE PRODUIT.
 *
 * Ces règles métier permettent de convertir une surface / volume / longueur
 * en quantité de produit à commander.
 *
 * Structure de chaque entrée :
 *   inputUnit  : unité que l'artisan saisit ('m²' | 'm³' | 'm' | 'pièce')
 *   factor     : multiplicateur (surface × factor = quantité brute)
 *   outputUnit : unité de sortie affichée à l'artisan
 *   note       : explication optionnelle du calcul
 *
 * Recherche : la fonction getConversionFactor() effectue un matching
 * par sous-chaîne insensible aux accents / casse.
 * Les clés les plus longues sont testées en premier (correspondance la plus
 * spécifique).
 */

// ── Dictionnaire principal ────────────────────────────────────────────────────

const CONVERSION_FACTORS = {

  // ── Maçonnerie ──────────────────────────────────────────────────────────────
  'Parpaing':         { inputUnit: 'm²',    factor: 10,    outputUnit: 'unités',  note: '10 parpaings 20×20×40 cm par m² de mur' },
  'Brique':           { inputUnit: 'm²',    factor: 50,    outputUnit: 'unités',  note: '50 briques pleines par m² de mur' },
  'Bloc alvéolaire':  { inputUnit: 'm²',    factor: 8,     outputUnit: 'unités',  note: '8 blocs alvéolaires par m²' },
  'Bloc':             { inputUnit: 'm²',    factor: 10,    outputUnit: 'unités',  note: '10 blocs standard par m²' },
  'Agglo':            { inputUnit: 'm²',    factor: 10,    outputUnit: 'unités',  note: '10 agglomérés par m²' },
  'Mortier':          { inputUnit: 'm²',    factor: 0.02,  outputUnit: 'sacs',    note: '1 sac 25 kg pour 50 m² de joint' },
  'Colle carrelage':  { inputUnit: 'm²',    factor: 0.005, outputUnit: 'sacs',    note: '1 sac 25 kg pour 200 m²' },

  // ── Béton ───────────────────────────────────────────────────────────────────
  'Ciment':           { inputUnit: 'm³',    factor: 7,     outputUnit: 'sacs',    note: '7 sacs 50 kg par m³ de béton' },
  'Béton prêt':       { inputUnit: 'm³',    factor: 1,     outputUnit: 'm³',      note: 'Volume commandé directement' },
  'Beton pret':       { inputUnit: 'm³',    factor: 1,     outputUnit: 'm³',      note: 'Volume commandé directement' },
  'Béton':            { inputUnit: 'm³',    factor: 1,     outputUnit: 'm³',      note: 'Volume de béton' },

  // ── Ferraillage ─────────────────────────────────────────────────────────────
  'Barre HA':         { inputUnit: 'm²',    factor: 3,     outputUnit: 'mètres',  note: '3 ml de HA par m² (espacement 30 cm)' },
  'Barre acier':      { inputUnit: 'm²',    factor: 3,     outputUnit: 'mètres',  note: '3 ml par m²' },
  'Treillis':         { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de coupe' },
  'Armature':         { inputUnit: 'm²',    factor: 3,     outputUnit: 'mètres',  note: '3 ml par m²' },

  // ── Électricité ─────────────────────────────────────────────────────────────
  'Câble':            { inputUnit: 'm²',    factor: 3,     outputUnit: 'mètres',  note: '3 m de câble par m² de pièce' },
  'Cable':            { inputUnit: 'm²',    factor: 3,     outputUnit: 'mètres',  note: '3 m de câble par m² de pièce' },
  'Fil électrique':   { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Fil':              { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Gaine':            { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Disjoncteur':      { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Interrupteur':     { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Prise':            { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },

  // ── Plomberie ───────────────────────────────────────────────────────────────
  'Tuyau PER':        { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Tuyau PVC':        { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Tuyau':            { inputUnit: 'm',     factor: 1,     outputUnit: 'mètres',  note: 'Longueur directe' },
  'Raccord':          { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Robinet':          { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },

  // ── Menuiserie ──────────────────────────────────────────────────────────────
  'Panneau OSB':      { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Contre-plaqué':    { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Contreplaqué':     { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'MDF':              { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Panneau':          { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Planche':          { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de coupe' },
  'Lambris':          { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de coupe' },
  'Porte':            { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Fenêtre':          { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Fenetre':          { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },

  // ── Isolation ───────────────────────────────────────────────────────────────
  'Laine de verre':   { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Laine de roche':   { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Laine':            { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de coupe' },
  'Polystyrène':      { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de coupe' },
  'Polystyrene':      { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de coupe' },

  // ── Carrelage ───────────────────────────────────────────────────────────────
  'Carrelage':        { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de casse' },
  'Faïence':          { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de casse' },
  'Faience':          { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de casse' },
  'Grès cérame':      { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de casse' },
  'Gres':             { inputUnit: 'm²',    factor: 1.05,  outputUnit: 'm²',      note: '+5 % de casse' },
  'Mosaïque':         { inputUnit: 'm²',    factor: 1.1,   outputUnit: 'm²',      note: '+10 % de casse' },

  // ── Peinture ────────────────────────────────────────────────────────────────
  'Peinture':         { inputUnit: 'm²',    factor: 0.1,   outputUnit: 'litres',  note: '1 litre couvre ~10 m² (2 couches)' },
  'Enduit':           { inputUnit: 'm²',    factor: 0.003, outputUnit: 'sacs',    note: '1 sac 25 kg couvre ~8 m²' },
  'Primaire':         { inputUnit: 'm²',    factor: 0.1,   outputUnit: 'litres',  note: '1 litre pour ~10 m²' },

  // ── Couverture ──────────────────────────────────────────────────────────────
  'Tuile':            { inputUnit: 'm²',    factor: 16,    outputUnit: 'unités',  note: '16 tuiles par m² (avec chevauchement)' },
  'Ardoise':          { inputUnit: 'm²',    factor: 20,    outputUnit: 'unités',  note: '20 ardoises par m²' },
  'Bac acier':        { inputUnit: 'm²',    factor: 1.15,  outputUnit: 'm²',      note: '+15 % de chevauchement' },

  // ── EPI & Outillage ─────────────────────────────────────────────────────────
  'Casque':           { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Harnais':          { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
  'Gants':            { inputUnit: 'pièce', factor: 1,     outputUnit: 'unités',  note: 'Quantité directe' },
};

// ── Helpers internes ──────────────────────────────────────────────────────────

/**
 * Normalise une chaîne : minuscule, sans accent, sans ponctuation.
 * @param {string} s
 * @returns {string}
 */
function normalise(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clés triées par longueur décroissante pour privilégier la correspondance la
// plus spécifique (ex: 'Laine de verre' avant 'Laine').
const SORTED_KEYS = Object.keys(CONVERSION_FACTORS).sort((a, b) => b.length - a.length);

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Recherche le facteur de conversion pour un nom de produit.
 *
 * Stratégie :
 *   1. Test si la clé normalisée est une sous-chaîne du nom produit normalisé.
 *   2. Clés testées de la plus longue à la plus courte → priorité au match
 *      le plus spécifique.
 *
 * @param {string} productName - Nom complet du produit (ex: "Carrelage grès 60×60 cm")
 * @returns {{ inputUnit, factor, outputUnit, note, matchedKey } | null}
 *   Retourne null si aucun facteur connu.
 */
function getConversionFactor(productName) {
  if (!productName) return null;
  const normName = normalise(productName);

  for (const key of SORTED_KEYS) {
    if (normName.includes(normalise(key))) {
      return { ...CONVERSION_FACTORS[key], matchedKey: key };
    }
  }
  return null;
}

/**
 * Calcule la quantité d'un produit spécifique à partir d'une surface.
 *
 * Si aucun facteur n'est trouvé pour ce produit :
 *   - factor = 1 (pas de conversion)
 *   - isNonStandard = true
 *   - message d'avertissement inclus dans le retour
 *
 * @param {string} productName  - Nom du produit
 * @param {number} surface      - Valeur saisie par l'artisan
 * @param {string} unit         - Unité : 'm²' | 'm³' | 'm' | 'pièce'
 * @param {boolean} applyMargin - Appliquer +10 % de marge de sécurité
 * @returns {{
 *   quantity:     number,   // quantité à commander (arrondie au supérieur)
 *   rawQuantity:  number,   // avant arrondi
 *   factor:       number,
 *   outputUnit:   string,
 *   matchedKey:   string | null,
 *   formula:      string,
 *   note:         string,
 *   isNonStandard: boolean,
 *   warning:      string | null,
 * }}
 */
function calculateProductQuantity(productName, surface, unit, applyMargin = true) {
  const found = getConversionFactor(productName);
  const margin = applyMargin ? 0.10 : 0;

  if (found) {
    const raw        = surface * found.factor;
    const withMargin = raw * (1 + margin);
    const quantity   = Math.max(1, Math.ceil(withMargin));
    const marginStr  = applyMargin ? ` + ${Math.round(margin * 100)}%` : '';

    return {
      quantity,
      rawQuantity:  Math.ceil(raw),
      factor:       found.factor,
      outputUnit:   found.outputUnit,
      matchedKey:   found.matchedKey,
      formula:      `${surface} ${unit} × ${found.factor} = ${Math.ceil(raw)} ${found.outputUnit}${marginStr} = ${quantity} ${found.outputUnit}`,
      note:         found.note,
      isNonStandard: false,
      warning:      null,
    };
  }

  // Pas de facteur connu → fallback factor = 1
  // Spécification: les produits non standards sont traités en "pièce".
  const fallbackInputUnit = 'pièce';
  const raw      = surface * 1;
  const quantity = Math.max(1, Math.ceil(raw * (1 + margin)));
  const marginStr = applyMargin ? ` + ${Math.round(margin * 100)}%` : '';

  return {
    quantity,
    rawQuantity:  Math.ceil(raw),
    factor:       1,
    outputUnit:   'unités',
    matchedKey:   null,
    formula:      `${surface} ${fallbackInputUnit} × 1 (estimation)${marginStr} = ${quantity} unités`,
    note:         'Produit non standard - facteur de conversion non défini',
    isNonStandard: true,
    warning:      'Quantité estimée à vérifier - produit non standard',
  };
}

const conversionFactors = CONVERSION_FACTORS;

module.exports = {
  CONVERSION_FACTORS,
  conversionFactors,
  getConversionFactor,
  calculateProductQuantity,
};
