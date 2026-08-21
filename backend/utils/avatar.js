/**
 * avatar.js — BMP.tn
 * ──────────────────
 * Avatar de repli pour les artisans sans photo de profil : initiales sur un fond
 * de couleur dérivée d'un hash du nom, donc stable dans le temps et identique
 * partout où l'artisan apparaît.
 */

// Palette volontairement sombre et désaturée : le texte blanc reste lisible
// (contraste AA) sur chacune de ces teintes.
const AVATAR_COLORS = [
  '#1F3A8A', // bleu BMP
  '#0F766E',
  '#9A3412',
  '#6D28D9',
  '#B91C1C',
  '#115E59',
  '#7C2D12',
  '#1E40AF',
  '#4C1D95',
  '#065F46',
  '#9D174D',
  '#374151',
];

/** Hash déterministe (djb2) — même nom, même couleur, à chaque rendu. */
function hashName(name) {
  const value = String(name || '');
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Une ou deux initiales à partir d'un nom complet.
 * Gère les alphabets non latins (arabe…) en prenant simplement le premier
 * caractère de chaque mot.
 * @param {string} fullName
 * @returns {string}
 */
function initialsFrom(fullName) {
  const words = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return '?';
  if (words.length === 1) return [...words[0]].slice(0, 2).join('').toUpperCase();

  return (
    [...words[0]][0] + [...words[words.length - 1]][0]
  ).toUpperCase();
}

/** Couleur de fond dérivée du nom. */
function colorFromName(fullName) {
  return AVATAR_COLORS[hashName(fullName) % AVATAR_COLORS.length];
}

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Avatar SVG carré, prêt à être servi tel quel ou intégré en data-URI.
 * @param {string} fullName
 * @param {number} [size] côté du carré, en pixels
 * @returns {string}
 */
function buildAvatarSvg(fullName, size = 512) {
  const initials = initialsFrom(fullName);
  const background = colorFromName(fullName);
  const fontSize = Math.round(size * (initials.length > 1 ? 0.38 : 0.46));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(fullName)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${background}" stop-opacity="0.75"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="${fontSize}" font-weight="600" fill="#ffffff">${escapeXml(initials)}</text>
</svg>`;
}

/** Le même avatar, encodé en data-URI utilisable dans un attribut src. */
function buildAvatarDataUri(fullName, size = 512) {
  return `data:image/svg+xml;base64,${Buffer.from(buildAvatarSvg(fullName, size), 'utf8').toString('base64')}`;
}

module.exports = {
  AVATAR_COLORS,
  initialsFrom,
  colorFromName,
  buildAvatarSvg,
  buildAvatarDataUri,
};
