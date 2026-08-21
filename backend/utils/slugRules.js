/**
 * slugRules.js — BMP.tn
 * ─────────────────────
 * Règles de validation d'un slug de mini site artisan, centralisées ici pour
 * que l'onboarding, l'endpoint /api/check-slug et le DomainService appliquent
 * exactement les mêmes contrôles.
 *
 *   Format      : a-z, 0-9 et tirets uniquement
 *   Tirets      : ni en début, ni en fin, jamais doublés
 *   Longueur    : 3 à 30 caractères
 *   Verrouillage: slug non modifiable une fois `lockedAt` dépassé (30 jours)
 *
 * La disponibilité (slugs réservés + unicité en base) n'est PAS traitée ici :
 * c'est le rôle de DomainService.checkSlugAvailable().
 */

const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 30;

// Suite de groupes alphanumériques séparés par un tiret simple.
// Interdit de fait : tiret initial/final, double tiret, caractère hors [a-z0-9-].
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Codes d'erreur stables — le frontend s'y attache pour afficher son propre message traduit. */
const SLUG_ERRORS = {
  REQUIRED: 'SLUG_REQUIRED',
  INVALID_CHARACTERS: 'SLUG_INVALID_CHARACTERS',
  TOO_SHORT: 'SLUG_TOO_SHORT',
  TOO_LONG: 'SLUG_TOO_LONG',
  LEADING_HYPHEN: 'SLUG_LEADING_HYPHEN',
  TRAILING_HYPHEN: 'SLUG_TRAILING_HYPHEN',
  DOUBLE_HYPHEN: 'SLUG_DOUBLE_HYPHEN',
  INVALID_FORMAT: 'SLUG_INVALID_FORMAT',
  LOCKED: 'SLUG_LOCKED',
};

const SLUG_ERROR_MESSAGES = {
  [SLUG_ERRORS.REQUIRED]: 'Slug is required',
  [SLUG_ERRORS.INVALID_CHARACTERS]: 'Slug may only contain lowercase letters, digits and hyphens',
  [SLUG_ERRORS.TOO_SHORT]: `Slug must be at least ${SLUG_MIN_LENGTH} characters long`,
  [SLUG_ERRORS.TOO_LONG]: `Slug must be at most ${SLUG_MAX_LENGTH} characters long`,
  [SLUG_ERRORS.LEADING_HYPHEN]: 'Slug may not start with a hyphen',
  [SLUG_ERRORS.TRAILING_HYPHEN]: 'Slug may not end with a hyphen',
  [SLUG_ERRORS.DOUBLE_HYPHEN]: 'Slug may not contain two consecutive hyphens',
  [SLUG_ERRORS.INVALID_FORMAT]: 'Slug format is invalid',
  [SLUG_ERRORS.LOCKED]: 'Slug can no longer be changed',
};

/**
 * Met un slug saisi sous sa forme canonique : sans espaces autour, en minuscules.
 * Ne « répare » rien d'autre — une saisie invalide doit être rejetée, pas corrigée
 * en silence (l'artisan doit voir ce qu'il obtient). Aligné sur `lowercase`/`trim`
 * du schéma ArtisanDomain, pour qu'un slug validé ici soit identique en base.
 * @param {*} input
 * @returns {string}
 */
function normalizeSlug(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase();
}

const fail = (slug, error) => ({
  valid: false,
  slug,
  error,
  message: SLUG_ERROR_MESSAGES[error],
});

/**
 * Valide le format et la longueur d'un slug.
 * Les contrôles sont ordonnés du plus explicite au plus général, pour rendre
 * la cause précise plutôt qu'un « format invalide » fourre-tout.
 * @param {*} input
 * @returns {{ valid: boolean, slug: string, error?: string, message?: string }}
 */
function validateSlug(input) {
  const slug = normalizeSlug(input);

  if (!slug) return fail(slug, SLUG_ERRORS.REQUIRED);
  if (/[^a-z0-9-]/.test(slug)) return fail(slug, SLUG_ERRORS.INVALID_CHARACTERS);
  if (slug.startsWith('-')) return fail(slug, SLUG_ERRORS.LEADING_HYPHEN);
  if (slug.endsWith('-')) return fail(slug, SLUG_ERRORS.TRAILING_HYPHEN);
  if (slug.includes('--')) return fail(slug, SLUG_ERRORS.DOUBLE_HYPHEN);
  if (slug.length < SLUG_MIN_LENGTH) return fail(slug, SLUG_ERRORS.TOO_SHORT);
  if (slug.length > SLUG_MAX_LENGTH) return fail(slug, SLUG_ERRORS.TOO_LONG);
  // Filet de sécurité : les contrôles ci-dessus couvrent déjà la regex.
  if (!SLUG_PATTERN.test(slug)) return fail(slug, SLUG_ERRORS.INVALID_FORMAT);

  return { valid: true, slug };
}

/**
 * Le slug d'un mini site existant est-il encore modifiable ?
 * S'appuie sur `lockedAt` porté par le document ArtisanDomain.
 * @param {{ isSlugLocked?: Function, daysUntilLock?: Function, lockedAt?: Date }} artisanDomain
 * @param {Date} [now]
 * @returns {{ editable: boolean, daysRemaining: number|null, error?: string, message?: string }}
 */
function checkSlugEditable(artisanDomain, now = new Date()) {
  if (!artisanDomain) {
    // Pas encore de mini site : le slug est libre de toute contrainte de verrouillage.
    return { editable: true, daysRemaining: null };
  }

  const locked = typeof artisanDomain.isSlugLocked === 'function'
    ? artisanDomain.isSlugLocked(now)
    // `lockedAt` peut arriver en chaîne ISO (payload JSON) : on normalise avant de comparer.
    : Boolean(artisanDomain.lockedAt) && now.getTime() >= new Date(artisanDomain.lockedAt).getTime();

  let daysRemaining = null;
  if (typeof artisanDomain.daysUntilLock === 'function') {
    daysRemaining = artisanDomain.daysUntilLock(now);
  } else if (artisanDomain.lockedAt) {
    // Objet nu (résultat de .lean(), cache…) : on refait le calcul du modèle.
    const remaining = new Date(artisanDomain.lockedAt).getTime() - now.getTime();
    daysRemaining = remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
  }

  if (locked) {
    return {
      editable: false,
      daysRemaining: 0,
      error: SLUG_ERRORS.LOCKED,
      message: SLUG_ERROR_MESSAGES[SLUG_ERRORS.LOCKED],
    };
  }

  return { editable: true, daysRemaining };
}

module.exports = {
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  SLUG_ERRORS,
  SLUG_ERROR_MESSAGES,
  normalizeSlug,
  validateSlug,
  checkSlugEditable,
};
