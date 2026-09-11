/**
 * Unités autorisées sur une ligne de devis.
 *
 * ⚠️ Source de vérité : backend/utils/quoteTemplates.js (QUOTE_UNITS), qui sert
 * d'enum au schéma Mongoose. Toute valeur absente de cette liste est rejetée en
 * 400 par POST /api/quotes — les deux listes doivent rester identiques.
 *
 * `ml` = mètre linéaire.
 */
export const QUOTE_UNITS = [
  'ml',
  'unité',
  'heure',
  'm²',
  'sac',
  'sachet',
  'bidon',
  'kit',
  'rouleau',
  'kg',
  'litre',
  'forfait',
  'jours',
  'semaine',
  'aucun',
] as const;

export type QuoteUnit = (typeof QUOTE_UNITS)[number];
