const {
  RESERVED_SLUGS,
  TECHNICAL_SLUGS,
  BRAND_SLUGS,
  TUNISIAN_SLUGS,
  TRADE_SLUGS,
  CANONICAL_TRADE_SLUGS,
  slugifyTrade,
  isReservedSlug,
} = require('../../../utils/reservedSlugs');
const { SPECIALIZATION_SYNONYMS } = require('../../../services/artisanAiSearchService');

describe('reservedSlugs utility', () => {
  describe('RESERVED_SLUGS list', () => {
    test('contains every slug explicitly listed in the plan', () => {
      const fromPlan = [
        'www', 'app', 'api', 'admin', 'mestra', 'bmp', 'dokan',
        'support', 'shop', 'steg', 'sonede', 'ministere', 'onat',
      ];

      expect(RESERVED_SLUGS).toEqual(expect.arrayContaining(fromPlan));
    });

    test('is the concatenation of the four groups', () => {
      expect(RESERVED_SLUGS).toEqual([
        ...TECHNICAL_SLUGS,
        ...BRAND_SLUGS,
        ...TUNISIAN_SLUGS,
        ...TRADE_SLUGS,
      ]);
    });

    test('holds no duplicate entry', () => {
      expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length);
    });

    test('every entry is already in canonical slug form', () => {
      const canonical = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      const invalid = RESERVED_SLUGS.filter((slug) => !canonical.test(slug));

      expect(invalid).toEqual([]);
    });

    test('reserves the main application subdomain used by the host router', () => {
      // Étape 9 route sur `app.bmp.tn` : `app` ne doit jamais être attribuable.
      expect(isReservedSlug('app')).toBe(true);
    });
  });

  describe('trade slugs', () => {
    test('slugifyTrade normalises a specialization label', () => {
      expect(slugifyTrade('Electrical Installation')).toBe('electrical-installation');
      expect(slugifyTrade('Métallerie')).toBe('metallerie');
      expect(slugifyTrade('  HVAC  ')).toBe('hvac');
    });

    test('canonical trades are derived from SPECIALIZATION_SYNONYMS, not hardcoded', () => {
      // Source de vérité partagée : si une spécialisation est ajoutée au service,
      // son slug devient réservé automatiquement.
      expect(CANONICAL_TRADE_SLUGS).toEqual(
        Object.keys(SPECIALIZATION_SYNONYMS).map(slugifyTrade)
      );
      expect(CANONICAL_TRADE_SLUGS).toHaveLength(Object.keys(SPECIALIZATION_SYNONYMS).length);
    });

    test('every canonical specialization is reserved', () => {
      Object.keys(SPECIALIZATION_SYNONYMS).forEach((label) => {
        expect(isReservedSlug(slugifyTrade(label))).toBe(true);
      });
    });

    test('common French trade names are reserved', () => {
      ['plombier', 'electricien', 'menuisier', 'macon', 'peintre', 'carreleur']
        .forEach((slug) => expect(isReservedSlug(slug)).toBe(true));
    });

    test('TRADE_SLUGS holds no duplicate between canonical and local entries', () => {
      expect(new Set(TRADE_SLUGS).size).toBe(TRADE_SLUGS.length);
    });

    test('materials and objects are NOT reserved, only trade names', () => {
      // `mur`, `brique`, `bois`… sont des synonymes de recherche, pas des métiers.
      ['mur', 'brique', 'bois', 'pierre', 'porte', 'dalle']
        .forEach((slug) => expect(isReservedSlug(slug)).toBe(false));
    });

    test('a trade name inside a personal slug stays available', () => {
      expect(isReservedSlug('hamza-electricien-tunis')).toBe(false);
      expect(isReservedSlug('plombier-hamza')).toBe(false);
    });
  });

  describe('isReservedSlug', () => {
    test('returns true on an exact match', () => {
      expect(isReservedSlug('admin')).toBe(true);
      expect(isReservedSlug('steg')).toBe(true);
    });

    test('is case-insensitive and ignores surrounding whitespace', () => {
      expect(isReservedSlug('  ADMIN ')).toBe(true);
      expect(isReservedSlug('Steg')).toBe(true);
    });

    test('returns false on a legitimate artisan slug', () => {
      expect(isReservedSlug('hamza-ayachi')).toBe(false);
      expect(isReservedSlug('hamza-electricien-tunis')).toBe(false);
    });

    test('matches whole slugs only, never substrings', () => {
      // `tunis` est réservé, mais un slug qui le contient reste disponible.
      expect(isReservedSlug('tunis')).toBe(true);
      expect(isReservedSlug('hamza-tunis')).toBe(false);
      expect(isReservedSlug('api-plomberie')).toBe(false);
      expect(isReservedSlug('adminis')).toBe(false);
    });

    test('returns false on non-string or empty input', () => {
      expect(isReservedSlug(undefined)).toBe(false);
      expect(isReservedSlug(null)).toBe(false);
      expect(isReservedSlug(42)).toBe(false);
      expect(isReservedSlug('')).toBe(false);
    });
  });
});
