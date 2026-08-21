const crypto = require('crypto');
const ArtisanDomain = require('../models/ArtisanDomain');
const { isReservedSlug } = require('../utils/reservedSlugs');
const {
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_ERRORS,
  SLUG_ERROR_MESSAGES,
  validateSlug,
} = require('../utils/slugRules');

/**
 * DomainService.js — BMP.tn
 * ─────────────────────────
 * Fabrique, contrôle et résout les slugs des mini sites artisans.
 *
 *   generateSlug(prenom, metier, ville) → suggestion (pur, sans accès base)
 *   checkSlugAvailable(slug)            → réservé ? déjà pris ? + alternative
 *   resolveArtisan(hostHeader)          → artisan derrière un sous-domaine
 */

// Domaine racine des mini sites, ex. « mestra.tn ». Si non défini, on retombe sur
// une heuristique générique (toute forme `sous-domaine.domaine.tld`).
const getBaseDomain = () => (process.env.MINI_SITE_BASE_DOMAIN || '').trim().toLowerCase();

const RESERVED_REASON = 'SLUG_RESERVED';
const TAKEN_REASON = 'SLUG_TAKEN';
const REASON_MESSAGES = {
  [RESERVED_REASON]: 'This slug is reserved',
  [TAKEN_REASON]: 'This slug is already taken',
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Suffixe aléatoire court, pour départager deux artisans homonymes. */
const randomSuffix = (length = 4) =>
  crypto.randomBytes(8).toString('hex').slice(0, length);

/**
 * Normalise un fragment libre (prénom, métier, ville) en morceau de slug :
 * accents retirés, minuscules, tout le reste devient un tiret.
 */
function slugifyPart(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Tronque sans laisser de tiret orphelin en fin de chaîne. */
function truncateSlug(slug, max = SLUG_MAX_LENGTH) {
  if (slug.length <= max) return slug;
  return slug.slice(0, max).replace(/-+$/g, '');
}

/** Colle un suffixe en rognant la racine si besoin, pour tenir dans SLUG_MAX_LENGTH. */
function withSuffix(base, suffix) {
  const room = SLUG_MAX_LENGTH - suffix.length - 1;
  return `${truncateSlug(base, room)}-${suffix}`;
}

/**
 * Suggestion de slug à partir des données de profil.
 * Fonction pure : elle ne dit pas si le slug est libre (voir checkSlugAvailable).
 * Les fragments vides sont ignorés — à l'inscription, `domain` et `location` sont
 * encore vides, on retombe donc naturellement sur le seul nom.
 * @param {string} prenom
 * @param {string} [metier]
 * @param {string} [ville]
 * @returns {string} un slug toujours valide au sens de validateSlug()
 */
function generateSlug(prenom, metier, ville) {
  const parts = [prenom, metier, ville].map(slugifyPart).filter(Boolean);
  let slug = truncateSlug(parts.join('-'));

  // Nom trop court, vide, ou entièrement non latin (arabe…) : on garantit un slug valide.
  if (slug.length < SLUG_MIN_LENGTH) {
    slug = withSuffix(slug || 'artisan', randomSuffix());
  }

  return slug;
}

/**
 * Cherche une variante libre de `base` : base-2, base-3, … puis suffixe aléatoire.
 * Un seul aller-retour en base : on récupère les slugs déjà pris qui commencent
 * par la racine, plutôt que de tester les candidats un par un.
 */
async function suggestAlternative(base) {
  const root = truncateSlug(base, SLUG_MAX_LENGTH - 4);
  const rows = await ArtisanDomain.find({ slug: new RegExp(`^${escapeRegex(root)}`) })
    .select('slug')
    .lean();
  const taken = new Set((rows || []).map((row) => row.slug));

  for (let index = 2; index <= 99; index += 1) {
    const candidate = withSuffix(root, String(index));
    if (!taken.has(candidate) && !isReservedSlug(candidate)) {
      return candidate;
    }
  }

  return withSuffix(root, randomSuffix());
}

/**
 * Un slug est-il attribuable ? Contrôle le format, puis la liste réservée,
 * puis l'unicité en base — dans cet ordre, pour renvoyer la raison la plus précise.
 * @param {string} input
 * @param {{ excludeArtisanId?: string }} [options] artisan autorisé à « reprendre » son propre slug
 * @returns {Promise<{ available: boolean, slug: string, reason?: string, message?: string, suggestion?: string }>}
 */
async function checkSlugAvailable(input, options = {}) {
  const validation = validateSlug(input);
  if (!validation.valid) {
    return {
      available: false,
      slug: validation.slug,
      reason: validation.error,
      message: validation.message,
    };
  }

  const { slug } = validation;

  if (isReservedSlug(slug)) {
    return {
      available: false,
      slug,
      reason: RESERVED_REASON,
      message: REASON_MESSAGES[RESERVED_REASON],
      suggestion: await suggestAlternative(slug),
    };
  }

  const existing = await ArtisanDomain.findOne({ slug }).select('artisanId').lean();
  const ownedByCaller =
    existing &&
    options.excludeArtisanId &&
    String(existing.artisanId) === String(options.excludeArtisanId);

  if (existing && !ownedByCaller) {
    return {
      available: false,
      slug,
      reason: TAKEN_REASON,
      message: REASON_MESSAGES[TAKEN_REASON],
      suggestion: await suggestAlternative(slug),
    };
  }

  return { available: true, slug };
}

/** Le Host de la requête désigne-t-il une machine locale ? */
function isLocalHost(requestHost) {
  const host = String(requestHost || '').split(':')[0].toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
}

/**
 * URL publique du mini site.
 *
 * MINI_SITE_BASE_DOMAIN vaut `bmp.tn` : en production le lien est donc
 * `https://slug.bmp.tn`. Mais ce lien n'est pas joignable depuis un poste de dev —
 * on privilégie alors l'adresse `*.localhost` de l'Étape 10, pour que le lien
 * affiché dans le profil artisan reste cliquable pendant le développement.
 *
 * @param {string} slug
 * @param {string} [requestHost] valeur de req.headers.host, si disponible
 * @returns {string}
 */
function buildMiniSiteUrl(slug, requestHost) {
  if (isLocalHost(requestHost)) {
    // Toujours le port du backend, jamais celui de la requête : en dev le front
    // tourne sur 3000 (Vite) mais c'est bien Express qui rend les mini sites.
    return `http://${slug}.localhost:${process.env.PORT || 5000}`;
  }

  const baseDomain = getBaseDomain();
  if (baseDomain) return `https://${slug}.${baseDomain}`;

  return `http://${slug}.localhost:${process.env.PORT || 5000}`;
}

// Nombre de tentatives de création face à une collision de slug (course entre
// deux inscriptions simultanées : l'index unique tranche, on réessaie).
const MAX_CREATE_ATTEMPTS = 5;

/**
 * Garantit qu'un artisan possède son mini site. Idempotent : si l'ArtisanDomain
 * existe déjà, il est renvoyé tel quel sans rien modifier — ce qui rend la fonction
 * utilisable aussi bien à l'inscription que pour rattraper les artisans existants.
 *
 * Le slug de départ suit le plan (`prenom-metier-ville`) quand le profil est
 * renseigné ; à l'inscription `domain` et `location` sont vides, on retombe donc
 * sur `prenom-nom`, plus discriminant qu'un prénom seul.
 *
 * @param {object} artisan document User de rôle 'artisan'
 * @returns {Promise<object|null>} l'ArtisanDomain, ou null si l'entrée est inexploitable
 */
async function ensureDomainForArtisan(artisan) {
  if (!artisan || !artisan._id || artisan.role !== 'artisan') return null;

  const existing = await ArtisanDomain.findOne({ artisanId: artisan._id });
  if (existing) return existing;

  const hasProfile = Boolean(artisan.domain || artisan.location);
  let candidate = hasProfile
    ? generateSlug(artisan.firstName, artisan.domain, artisan.location)
    : generateSlug(artisan.firstName, artisan.lastName);

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const check = await checkSlugAvailable(candidate);
    if (!check.available) {
      candidate = check.suggestion || withSuffix(candidate, randomSuffix());
    }

    try {
      return await ArtisanDomain.create({ artisanId: artisan._id, slug: candidate });
    } catch (error) {
      if (!error || error.code !== 11000) throw error;

      // Un autre process a créé le mini site de cet artisan entre-temps.
      if (error.keyPattern && error.keyPattern.artisanId) {
        return ArtisanDomain.findOne({ artisanId: artisan._id });
      }

      // Slug pris dans l'intervalle : on repart sur une variante aléatoire.
      candidate = withSuffix(candidate, randomSuffix());
    }
  }

  return null;
}

/**
 * Extrait le slug d'un header Host.
 *   hamza-electricien-tunis.mestra.tn  → 'hamza-electricien-tunis'
 *   hamza.localhost:5000               → 'hamza'          (tests locaux, Étape 10)
 *   app.bmp.tn | mestra.tn | localhost → null             (pas un mini site)
 * @param {string} hostHeader
 * @returns {string|null}
 */
function extractSlugFromHost(hostHeader) {
  if (typeof hostHeader !== 'string') return null;

  const raw = hostHeader.trim().toLowerCase();
  if (!raw || raw.startsWith('[')) return null; // littéral IPv6 : pas de sous-domaine

  const host = raw.split(':')[0];
  if (!host || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IPv4 : idem

  const labels = host.split('.').filter(Boolean);
  const isLocalhost = labels.length === 2 && labels[1] === 'localhost';
  const baseDomain = getBaseDomain();

  let candidate = null;
  if (isLocalhost) {
    // `*.localhost` reste accepté même en présence d'un domaine configuré (dev).
    [candidate] = labels;
  } else if (baseDomain) {
    const suffix = `.${baseDomain}`;
    if (!host.endsWith(suffix)) return null;
    const head = host.slice(0, -suffix.length);
    if (!head || head.includes('.')) return null; // un seul niveau de sous-domaine
    candidate = head;
  } else if (labels.length >= 3) {
    [candidate] = labels;
  } else {
    return null;
  }

  const validation = validateSlug(candidate);
  if (!validation.valid) return null;
  if (isReservedSlug(validation.slug)) return null; // couvre `www`, `api`, `app`…

  return validation.slug;
}

/**
 * Résout le mini site correspondant à un slug.
 * Un artisan suspendu, supprimé, ou qui n'est plus artisan n'a pas de mini site public.
 * @param {string} slug
 * @returns {Promise<{ artisan: object, domain: object }|null>}
 */
async function resolveBySlug(slug) {
  const validation = validateSlug(slug);
  if (!validation.valid) return null;

  const domain = await ArtisanDomain.findOne({ slug: validation.slug }).populate('artisanId');
  const artisan = domain && domain.artisanId;
  if (!artisan) return null;
  if (artisan.role !== 'artisan' || artisan.status !== 'active') return null;

  return { artisan, domain };
}

/**
 * Résout l'artisan derrière un header Host, ou null.
 * @param {string} hostHeader
 * @returns {Promise<object|null>}
 */
async function resolveArtisan(hostHeader) {
  const slug = extractSlugFromHost(hostHeader);
  if (!slug) return null;

  const resolved = await resolveBySlug(slug);
  return resolved ? resolved.artisan : null;
}

/**
 * Lien WhatsApp « cliquer pour discuter » à partir d'un téléphone saisi librement.
 * Renvoie null si le numéro est absent ou inexploitable — le CTA sera alors masqué,
 * `phone` n'étant pas obligatoire à l'inscription (voir authController.registerUser).
 * @param {string} phone
 * @returns {string|null}
 */
function buildWhatsAppUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;

  // 8 chiffres = numéro tunisien local, on préfixe l'indicatif pays.
  const international = digits.length === 8 ? `216${digits}` : digits;
  return `https://wa.me/${international}`;
}

/**
 * Données publiques d'un mini site : uniquement ce qui peut être exposé sans
 * authentification. Tout le reste du document User (email, mot de passe,
 * descripteur facial, abonnement, statut…) est volontairement écarté.
 * @param {object} artisan
 * @param {object} domain
 * @param {{ reviews?: Array, requestHost?: string }} [extras]
 */
function buildPublicProfile(artisan, domain, extras = {}) {
  const reviews = Array.isArray(extras.reviews) ? extras.reviews : [];
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount) * 10) / 10
    : 0;

  const firstName = artisan.firstName || '';
  const lastName = artisan.lastName || '';

  return {
    slug: domain.slug,
    url: buildMiniSiteUrl(domain.slug, extras.requestHost),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    domain: artisan.domain || '',          // métier
    location: artisan.location || '',      // zone d'intervention
    bio: artisan.bio || '',                // description
    profilePhoto: artisan.profilePhoto || '',
    yearsExperience: artisan.yearsExperience ?? null,
    skills: Array.isArray(artisan.skills) ? artisan.skills : [],
    certifications: Array.isArray(artisan.certifications) ? artisan.certifications : [],
    phone: artisan.phone || '',
    whatsappUrl: buildWhatsAppUrl(artisan.phone),
    portfolio: (artisan.portfolio || []).map((item) => ({
      title: item.title,
      description: item.description,
      location: item.location || '',
      completedDate: item.completedDate || null,
      media: (item.media || []).map((m) => ({ type: m.type, url: m.url })),
    })),
    reviews: {
      count: reviewCount,
      rating,
      items: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment || '',
        createdAt: review.createdAt,
        author: review.expert
          ? `${review.expert.firstName || ''} ${review.expert.lastName || ''}`.trim()
          : '',
      })),
    },
  };
}

module.exports = {
  generateSlug,
  checkSlugAvailable,
  ensureDomainForArtisan,
  buildMiniSiteUrl,
  buildWhatsAppUrl,
  buildPublicProfile,
  resolveBySlug,
  resolveArtisan,
  extractSlugFromHost,
  suggestAlternative,
  slugifyPart,
  truncateSlug,
  withSuffix,
  SLUG_ERRORS,
  SLUG_ERROR_MESSAGES,
  REASON_MESSAGES,
  RESERVED_REASON,
  TAKEN_REASON,
};
