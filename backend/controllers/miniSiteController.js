const Review = require('../models/Review');
const DomainService = require('../services/DomainService');
const { buildAvatarSvg, buildAvatarDataUri } = require('../utils/avatar');
const { buildShareCardSvg } = require('../utils/shareCard');

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

/** Origine réelle de la requête, pour produire des URLs absolues (og:image, canonical). */
const originOf = (req) => `${req.protocol}://${req.get('host')}`;

/** Coupe proprement à la limite conseillée pour un aperçu de partage. */
const truncate = (text, max = 160) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

/**
 * Phrase de description utilisée par og:description : la bio si elle existe,
 * sinon une phrase reconstruite depuis le métier et la zone d'intervention.
 */
function buildDescription(profile) {
  if (profile.bio) return truncate(profile.bio);

  const trade = profile.domain || 'Artisan';
  const zone = profile.location ? ` — ${profile.location}` : '';
  const experience = profile.yearsExperience
    ? ` · ${profile.yearsExperience} ans d'expérience`
    : '';

  return truncate(`${trade}${zone}${experience}`);
}

/** Repères chiffrés du bandeau : on n'affiche que ceux qui ont une valeur. */
function buildStats(profile) {
  const stats = [];

  if (profile.yearsExperience) {
    stats.push({ value: profile.yearsExperience, label: "ans d'expérience" });
  }
  if (profile.portfolio.length) {
    stats.push({ value: profile.portfolio.length, label: 'réalisations' });
  }
  if (profile.reviews.count) {
    stats.push({ value: profile.reviews.rating, label: `avis (${profile.reviews.count})` });
  }

  return stats;
}

/**
 * Rend le mini site d'un artisan. Utilisé par la route de prévisualisation
 * /site/:slug et, à l'Étape 9, par le routage par sous-domaine.
 * @param {string} slug
 */
async function renderMiniSiteBySlug(req, res, slug) {
  const resolved = await DomainService.resolveBySlug(slug);

  if (!resolved) {
    return res.status(404).render('miniSiteNotFound', { slug, appUrl: APP_URL() });
  }

  const { artisan, domain } = resolved;
  const reviews = await Review.find({ artisan: artisan._id })
    .populate('expert', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();

  const profile = DomainService.buildPublicProfile(artisan, domain, {
    reviews,
    requestHost: req.headers.host,
  });
  const origin = originOf(req);
  const avatarPath = `/site/${profile.slug}/avatar.svg`;

  return res.render('miniSite', {
    profile: {
      ...profile,
      // Le <img> de la page accepte le base64 sans problème.
      avatar: profile.profilePhoto || buildAvatarDataUri(profile.fullName, 224),
    },
    stats: buildStats(profile),
    meta: {
      title: profile.domain ? `${profile.fullName} — ${profile.domain}` : profile.fullName,
      description: buildDescription(profile),
      url: profile.url,
      host: profile.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      // og:image doit être une URL absolue vers une image matricielle : ni la photo
      // stockée en base64, ni un SVG ne sont rendus par WhatsApp / Facebook.
      image: `${origin}/site/${profile.slug}/share.png`,
      imageWidth: 1200,
      imageHeight: 630,
      avatarPath,
      appUrl: APP_URL(),
    },
  });
}

// @desc    Mini site public d'un artisan (prévisualisation par chemin)
// @route   GET /site/:slug
// @access  Public
exports.previewMiniSite = async (req, res) => {
  try {
    return await renderMiniSiteBySlug(req, res, req.params.slug);
  } catch (error) {
    console.error('Mini site render failed:', error);
    return res.status(500).send('Server error');
  }
};

// @desc    Avatar à initiales d'un artisan (og:image, favicon)
// @route   GET /site/:slug/avatar.svg
// @access  Public
exports.getAvatar = async (req, res) => {
  try {
    const resolved = await DomainService.resolveBySlug(req.params.slug);
    if (!resolved) return res.status(404).send('Not found');

    const { artisan } = resolved;
    const fullName = `${artisan.firstName || ''} ${artisan.lastName || ''}`.trim();

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buildAvatarSvg(fullName));
  } catch (error) {
    return res.status(500).send('Server error');
  }
};

// @desc    Carte de partage (og:image) d'un artisan, en PNG 1200x630
// @route   GET /site/:slug/share.png
// @access  Public
exports.getShareCard = async (req, res) => {
  try {
    const resolved = await DomainService.resolveBySlug(req.params.slug);
    if (!resolved) return res.status(404).send('Not found');

    const { artisan, domain } = resolved;
    const url = DomainService.buildMiniSiteUrl(domain.slug, req.headers.host);

    const svg = buildShareCardSvg({
      fullName: `${artisan.firstName || ''} ${artisan.lastName || ''}`.trim(),
      domain: artisan.domain,
      location: artisan.location,
      host: url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    });

    // sharp est chargé ici et non en tête de fichier : c'est un module natif
    // lourd, inutile de le charger pour les requêtes qui ne rendent pas d'image.
    const sharp = require('sharp');
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(png);
  } catch (error) {
    console.error('Share card generation failed:', error);
    return res.status(500).send('Server error');
  }
};

exports.renderMiniSiteBySlug = renderMiniSiteBySlug;
exports.buildDescription = buildDescription;
exports.buildStats = buildStats;
