const { initialsFrom, colorFromName } = require('./avatar');

/**
 * shareCard.js — BMP.tn
 * ─────────────────────
 * Image d'aperçu de partage (og:image) d'un mini site artisan.
 *
 * Format 1200×630, le ratio attendu par WhatsApp, Facebook et LinkedIn.
 * Générée en SVG puis convertie en PNG par sharp : une data-URI base64 ne peut
 * pas servir d'og:image, et les réseaux sociaux ne rendent pas le SVG.
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Coupe un texte trop long pour la largeur disponible.
 * Approximation volontairement grossière : sans mesure de fonte côté serveur,
 * on se base sur une largeur moyenne de glyphe (~0.55 em pour cette graisse).
 */
const fit = (text, fontSize, maxWidth) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const maxChars = Math.floor(maxWidth / (fontSize * 0.55));
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
};

/**
 * Carte de partage d'un artisan.
 * @param {{ fullName: string, domain?: string, location?: string, slug?: string }} profile
 * @returns {string} le SVG de la carte
 */
function buildShareCardSvg(profile = {}) {
  const fullName = profile.fullName || 'Artisan';
  const initials = initialsFrom(fullName);
  const accent = colorFromName(fullName);

  // Colonne de texte : à droite du médaillon, avec une marge droite confortable.
  const textX = 470;
  const textWidth = CARD_WIDTH - textX - 90;

  const name = fit(fullName, 68, textWidth);
  const trade = fit(profile.domain, 40, textWidth);
  const location = fit(profile.location, 32, textWidth);

  // Le bloc est centré verticalement : sa hauteur dépend des lignes présentes.
  const lines = 1 + (trade ? 1 : 0) + (location ? 1 : 0);
  let cursor = CARD_HEIGHT / 2 - (lines - 1) * 34 - 10;

  const nameY = cursor;
  cursor += trade ? 72 : 0;
  const tradeY = cursor;
  cursor += location ? (trade ? 52 : 72) : 0;
  const locationY = cursor;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1220"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <linearGradient id="medal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#0B1220"/>
    </linearGradient>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <circle cx="1120" cy="90" r="220" fill="#ffffff" opacity="0.04"/>
  <circle cx="150" cy="580" r="180" fill="#ffffff" opacity="0.04"/>

  <!-- Médaillon aux initiales -->
  <circle cx="270" cy="315" r="140" fill="url(#medal)" stroke="#ffffff" stroke-opacity="0.85" stroke-width="6"/>
  <text x="270" y="315" dy="0.35em" text-anchor="middle"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="110" font-weight="600" fill="#ffffff">${escapeXml(initials)}</text>

  <!-- Identité -->
  <text x="${textX}" y="${nameY}" dy="0.35em"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="68" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
  ${trade ? `<text x="${textX}" y="${tradeY}" dy="0.35em"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="40" font-weight="600" fill="#ffffff" opacity="0.92">${escapeXml(trade)}</text>` : ''}
  ${location ? `<text x="${textX}" y="${locationY}" dy="0.35em"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="32" fill="#ffffff" opacity="0.75">${escapeXml(location)}</text>` : ''}

  <!-- Pied : adresse du mini site -->
  <rect x="0" y="${CARD_HEIGHT - 76}" width="${CARD_WIDTH}" height="76" fill="#000000" opacity="0.28"/>
  <text x="90" y="${CARD_HEIGHT - 38}" dy="0.35em"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="600" fill="#ffffff" opacity="0.9">${escapeXml(profile.host || 'bmp.tn')}</text>
  <text x="${CARD_WIDTH - 90}" y="${CARD_HEIGHT - 38}" dy="0.35em" text-anchor="end"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="24" font-weight="700" fill="#ffffff" opacity="0.65">BMP</text>
</svg>`;
}

module.exports = {
  CARD_WIDTH,
  CARD_HEIGHT,
  buildShareCardSvg,
};
