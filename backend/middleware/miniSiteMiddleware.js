const DomainService = require('../services/DomainService');
const { renderMiniSiteBySlug } = require('../controllers/miniSiteController');

/**
 * miniSiteMiddleware.js — BMP.tn
 * ──────────────────────────────
 * Sert le mini site d'un artisan quand la requête arrive sur son sous-domaine.
 *
 *   hamza-electricien-tunis.bmp.tn/  → mini site de Hamza
 *   app.bmp.tn/ , www.bmp.tn/ , bmp.tn/ → laissés à l'application normale
 *
 * Placé AVANT les routes /api dans app.js. Trois garde-fous pour ne jamais
 * intercepter ce qui ne lui appartient pas :
 *   1. seules les requêtes GET/HEAD sont concernées
 *   2. les préfixes techniques sont laissés passer (voir PASSTHROUGH_PREFIXES)
 *   3. un Host sans slug exploitable (domaine principal, slug réservé, IP…)
 *      appelle next() immédiatement, sans aucun accès base
 */

// Chemins qui doivent continuer de fonctionner y compris sur un sous-domaine :
// l'API, les médias du portfolio, la route d'avatar utilisée par og:image,
// et l'endpoint Prometheus exposé par app.js.
const PASSTHROUGH_PREFIXES = ['/api', '/uploads', '/site', '/metrics'];

const isPassthrough = (path) =>
  PASSTHROUGH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

function miniSiteMiddleware(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (isPassthrough(req.path)) return next();

  const slug = DomainService.extractSlugFromHost(req.headers.host);
  if (!slug) return next();

  // À partir d'ici on est bien sur un sous-domaine de mini site : le reste de
  // l'application n'a plus rien à voir avec cette requête.
  if (req.path !== '/') {
    return res
      .status(404)
      .render('miniSiteNotFound', { slug: null, appUrl: process.env.APP_URL || 'http://localhost:3000' });
  }

  return renderMiniSiteBySlug(req, res, slug).catch(next);
}

module.exports = miniSiteMiddleware;
module.exports.PASSTHROUGH_PREFIXES = PASSTHROUGH_PREFIXES;
