const fs = require('fs');

/**
 * chromePath.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Localise un binaire Chrome/Edge exploitable par puppeteer-core, qui — a la
 * difference de puppeteer — ne telecharge aucun navigateur.
 *
 * Unique consommateur : la generation du PDF de devis
 * (controllers/quoteController.js).
 */

/**
 * @returns {string|null} chemin du binaire, ou null si aucun n'est installe
 */
function resolveChromeExecutablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

module.exports = { resolveChromeExecutablePath };
