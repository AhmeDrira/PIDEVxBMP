/**
 * tradeDetection.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Determine le metier concerne a partir de la description libre que l'artisan
 * saisit (« Carrelage salle de bain, pose diagonale »).
 *
 * ⚠ AUCUN APPEL A L'IA, VOLONTAIREMENT. Classer un texte court sur deux
 * categories est une tache de correspondance de mots-cles : un appel modele
 * couterait une requete de quota, ajouterait plusieurs secondes de latence et
 * introduirait un alea la ou une regle deterministe suffit et se teste.
 *
 * La description ne sert QU'A choisir le metier. Elle ne pre-remplit aucun
 * champ du formulaire — ni les `number`, ni surtout les `select` (type de pose,
 * etat du support), qui restent manuels comme decide pour la lecture de plan.
 *
 * En cas de doute — aucun mot-cle, ou des mots-cles de PLUSIEURS metiers — on
 * ne tranche pas : on renvoie null et l'appelant retombe sur la galerie de
 * metiers. Deviner serait pire que demander.
 */

/**
 * Racines de mots par metier. On travaille sur des RACINES, pas des mots
 * entiers : « carrelage », « carreleur », « carreler » et « carreaux »
 * partagent « carrel »/« carreau », et l'artisan ecrit vite.
 *
 * Le texte est normalise sans accents avant comparaison : « faience » attrape
 * donc aussi « faïence ».
 */
const TRADE_KEYWORDS = {
  'carreleur-salle-de-bain-8m2': [
    'carrel',      // carrelage, carreleur, carreler
    'carreau',     // carreaux
    'faience',     // faïence
    'ceram',       // céramique
    'gres',        // grès cérame
    'mosaique',    // mosaïque
    'joint de carrelage',
    'plinthe',
  ],
  'peintre-piece-25m2': [
    'peintur',     // peinture, peinturer
    'peindre',
    'peint',       // repeint, repeindre conjugue
    'enduit',
    'sous-couche',
    'sous couche',
    'appret',      // apprêt
    'laque',
    'badigeon',
  ],
};

/** Minuscules, sans accents, espaces normalises. */
const normalise = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Determine le metier decrit par un texte libre.
 *
 * @param {string} description
 * @returns {{templateId: string|null, motsCles: string[], raison: string}}
 *   `templateId` vaut null quand rien n'a ete reconnu ou que plusieurs metiers
 *   sont evoques ; `raison` explique lequel des deux cas s'est produit.
 */
function detectTrade(description) {
  const texte = normalise(description);

  if (!texte) {
    return { templateId: null, motsCles: [], raison: 'description vide' };
  }

  // Metiers effectivement evoques, avec les mots qui les ont declenches.
  const trouves = Object.entries(TRADE_KEYWORDS)
    .map(([templateId, racines]) => ({
      templateId,
      motsCles: racines.filter((racine) => texte.includes(normalise(racine))),
    }))
    .filter((entree) => entree.motsCles.length > 0);

  if (trouves.length === 0) {
    return { templateId: null, motsCles: [], raison: 'aucun mot-clé reconnu' };
  }

  if (trouves.length > 1) {
    // « Carrelage et peinture de la salle de bain » : deux metiers, deux
    // devis. On ne choisit pas a la place de l'artisan.
    return {
      templateId: null,
      motsCles: trouves.flatMap((t) => t.motsCles),
      raison: 'plusieurs métiers évoqués',
    };
  }

  return {
    templateId: trouves[0].templateId,
    motsCles: trouves[0].motsCles,
    raison: 'métier reconnu',
  };
}

module.exports = {
  detectTrade,
  TRADE_KEYWORDS,
};
