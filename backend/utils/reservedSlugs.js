const { SPECIALIZATION_SYNONYMS } = require('../services/artisanAiSearchService');

/**
 * reservedSlugs.js — BMP.tn
 * ─────────────────────────
 * Slugs qu'un artisan ne peut pas revendiquer pour son mini site.
 *
 * Quatre familles :
 *   1. Sous-domaines techniques  — collision avec l'infrastructure (api, www, mail…)
 *   2. Marque & produit          — usurpation de la plateforme (bmp, mestra, support…)
 *   3. Institutions & marques TN — usurpation d'un tiers connu (steg, sonede, biat…)
 *   4. Corps de métier           — termes génériques à forte valeur (plombier, electricien…)
 *
 * La comparaison est faite en EXACT match sur le slug normalisé (minuscules).
 * `hamza-electricien-tunis` reste donc disponible même si `tunis` est réservé.
 */

// ─── 1. Sous-domaines techniques & infrastructure ────────────────────────────
const TECHNICAL_SLUGS = [
  'www', 'api', 'app', 'admin', 'administrator', 'root', 'system',
  'mail', 'email', 'webmail', 'smtp', 'imap', 'pop', 'mx', 'autodiscover',
  'ns', 'ns1', 'ns2', 'dns', 'ftp', 'sftp', 'ssh', 'vpn', 'proxy',
  'cdn', 'static', 'assets', 'media', 'files', 'uploads', 'img', 'images',
  'dev', 'test', 'staging', 'preprod', 'prod', 'demo', 'sandbox', 'local',
  'auth', 'login', 'logout', 'signup', 'register', 'oauth', 'sso', 'account',
  'dashboard', 'console', 'panel', 'portal', 'settings', 'config',
  'status', 'health', 'metrics', 'monitor', 'logs', 'debug',
  'blog', 'docs', 'doc', 'help', 'wiki', 'news', 'about', 'contact', 'legal',
  'billing', 'payment', 'payments', 'invoice', 'checkout', 'pay',
  'search', 'chat', 'socket', 'ws', 'graphql', 'webhook', 'webhooks',
  'null', 'undefined', 'none', 'default', 'example', 'sample',
];

// ─── 2. Marque & vocabulaire produit de la plateforme ────────────────────────
const BRAND_SLUGS = [
  'bmp', 'mestra', 'dokan', 'support', 'shop', 'store', 'boutique',
  'artisan', 'artisans', 'expert', 'experts', 'client', 'clients',
  'fabricant', 'fabricants', 'manufacturer', 'marketplace', 'projet', 'projets',
  'devis', 'facture', 'factures', 'abonnement', 'premium', 'pro',
];

// ─── 3. Institutions publiques & marques tunisiennes connues ─────────────────
const TUNISIAN_SLUGS = [
  // Institutions & services publics
  'steg', 'sonede', 'onat', 'ministere', 'gouvernement', 'republique',
  'cnss', 'cnrps', 'cnam', 'douane', 'douanes', 'impots', 'finances',
  'poste', 'laposte', 'municipalite', 'tunisie', 'tunis',
  // Télécoms & internet
  'tunisietelecom', 'tunisie-telecom', 'ooredoo', 'orange', 'topnet',
  'globalnet', 'hexabyte', 'sotetel',
  // Banques & assurances
  'biat', 'bna', 'stb', 'bh', 'uib', 'amenbank', 'attijari', 'zitouna',
  'wifak', 'star', 'gat', 'maghrebia', 'ctama',
  // Grande distribution & agroalimentaire
  'monoprix', 'carrefour', 'geant', 'aziza', 'magasingeneral', 'magasin-general',
  'delice', 'vitalait', 'sotumag',
  // Transport
  'tunisair', 'sncft', 'transtu', 'ctn',
];

// ─── 4. Corps de métier ──────────────────────────────────────────────────────
// Termes génériques à forte valeur commerciale : personne ne doit pouvoir
// s'approprier `plombier` ou `electricien` comme mini site.

/** Normalise un libellé métier en slug : minuscules, sans accents, tirets. */
function slugifyTrade(label) {
  return String(label)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Source de vérité des 14 spécialisations : les clés de SPECIALIZATION_SYNONYMS
// (services/artisanAiSearchService.js), la même liste que le <select> du profil artisan.
// Dérivées automatiquement pour rester synchronisées si la liste évolue.
const CANONICAL_TRADE_SLUGS = Object.keys(SPECIALIZATION_SYNONYMS).map(slugifyTrade);

// Équivalents français / usuels. Écrits explicitement : la liste canonique du projet
// est en anglais, et les variantes FR n'existent dans le code qu'au milieu des
// synonymes de recherche, mélangées à des matériaux (mur, brique, bois…) qui, eux,
// ne sont pas des noms de métier et n'ont pas à être réservés.
const LOCAL_TRADE_SLUGS = [
  'plombier', 'plomberie',
  'electricien', 'electricite', 'electrique',
  'menuisier', 'menuiserie',
  'macon', 'maconnerie',
  'peintre', 'peinture',
  'carreleur', 'carrelage',
  'platrier', 'platrerie', 'enduit',
  'couvreur', 'toiture',
  'etancheite',
  'climatisation', 'climatiseur', 'chauffage',
  'ferronnier', 'ferronnerie', 'metallerie', 'soudeur', 'soudure',
  'aluminium', 'alu',
  'beton', 'betonnage', 'fondation', 'fondations',
  'serrurier', 'serrurerie', 'vitrier', 'vitrerie',
  'jardinier', 'jardinage', 'terrassement', 'renovation', 'construction',
  'batiment', 'travaux', 'chantier', 'bricolage', 'depannage',
];

const TRADE_SLUGS = [
  ...CANONICAL_TRADE_SLUGS,
  ...LOCAL_TRADE_SLUGS.filter((slug) => !CANONICAL_TRADE_SLUGS.includes(slug)),
];

const RESERVED_SLUGS = [
  ...TECHNICAL_SLUGS,
  ...BRAND_SLUGS,
  ...TUNISIAN_SLUGS,
  ...TRADE_SLUGS,
];

// Set pour une recherche en O(1) — le tableau reste exporté pour l'affichage/les tests.
const RESERVED_SLUGS_SET = new Set(RESERVED_SLUGS);

/**
 * Un slug est-il réservé ? Comparaison exacte, insensible à la casse et aux espaces.
 * @param {string} slug
 * @returns {boolean}
 */
function isReservedSlug(slug) {
  if (typeof slug !== 'string') return false;
  return RESERVED_SLUGS_SET.has(slug.trim().toLowerCase());
}

module.exports = {
  RESERVED_SLUGS,
  TECHNICAL_SLUGS,
  BRAND_SLUGS,
  TUNISIAN_SLUGS,
  TRADE_SLUGS,
  CANONICAL_TRADE_SLUGS,
  slugifyTrade,
  isReservedSlug,
};
