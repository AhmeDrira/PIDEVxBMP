const mongoose = require('mongoose');
const {
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  SLUG_ERRORS,
  SLUG_ERROR_MESSAGES,
  normalizeSlug,
  validateSlug,
  checkSlugEditable,
} = require('../../../utils/slugRules');
const ArtisanDomain = require('../../../models/ArtisanDomain');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('slugRules utility', () => {
  describe('constants', () => {
    test('length bounds match the plan (3 to 30)', () => {
      expect(SLUG_MIN_LENGTH).toBe(3);
      expect(SLUG_MAX_LENGTH).toBe(30);
    });

    test('every error code has a message', () => {
      Object.values(SLUG_ERRORS).forEach((code) => {
        expect(typeof SLUG_ERROR_MESSAGES[code]).toBe('string');
        expect(SLUG_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      });
    });
  });

  describe('normalizeSlug', () => {
    test('trims and lowercases', () => {
      expect(normalizeSlug('  Hamza-AYACHI  ')).toBe('hamza-ayachi');
    });

    test('does not repair an invalid slug', () => {
      // Une saisie invalide doit être rejetée, pas corrigée en silence.
      expect(normalizeSlug('hamza ayachi')).toBe('hamza ayachi');
      expect(normalizeSlug('--hamza--')).toBe('--hamza--');
    });

    test('returns an empty string on non-string input', () => {
      expect(normalizeSlug(undefined)).toBe('');
      expect(normalizeSlug(null)).toBe('');
      expect(normalizeSlug(42)).toBe('');
      expect(normalizeSlug({})).toBe('');
    });
  });

  describe('validateSlug -> accepted', () => {
    test.each([
      ['hamza-ayachi'],
      ['hamza-electricien-tunis'],
      ['abc'],
      ['hamza2'],
      ['123'],
      ['a-1-b-2'],
      ['a'.repeat(SLUG_MAX_LENGTH)],
    ])('accepts %s', (slug) => {
      expect(validateSlug(slug)).toEqual({ valid: true, slug });
    });

    test('returns the normalized slug, not the raw input', () => {
      expect(validateSlug('  Hamza-AYACHI ')).toEqual({ valid: true, slug: 'hamza-ayachi' });
    });
  });

  describe('validateSlug -> rejected', () => {
    test.each([
      ['', SLUG_ERRORS.REQUIRED],
      ['   ', SLUG_ERRORS.REQUIRED],
      [undefined, SLUG_ERRORS.REQUIRED],
      [null, SLUG_ERRORS.REQUIRED],
      [42, SLUG_ERRORS.REQUIRED],
      ['ab', SLUG_ERRORS.TOO_SHORT],
      ['a'.repeat(SLUG_MAX_LENGTH + 1), SLUG_ERRORS.TOO_LONG],
      ['-hamza', SLUG_ERRORS.LEADING_HYPHEN],
      ['hamza-', SLUG_ERRORS.TRAILING_HYPHEN],
      ['hamza--ayachi', SLUG_ERRORS.DOUBLE_HYPHEN],
      ['hamza ayachi', SLUG_ERRORS.INVALID_CHARACTERS],
      ['hamza_ayachi', SLUG_ERRORS.INVALID_CHARACTERS],
      ['hamza.ayachi', SLUG_ERRORS.INVALID_CHARACTERS],
      ['hamza@ayachi', SLUG_ERRORS.INVALID_CHARACTERS],
      ['électricien', SLUG_ERRORS.INVALID_CHARACTERS],
      ['حمزة', SLUG_ERRORS.INVALID_CHARACTERS],
    ])('rejects %p with %s', (input, expectedError) => {
      const result = validateSlug(input);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(expectedError);
      expect(result.message).toBe(SLUG_ERROR_MESSAGES[expectedError]);
    });

    test('uppercase input is normalized, never rejected on case alone', () => {
      expect(validateSlug('HAMZA').valid).toBe(true);
    });

    test('reports the hyphen cause before the length cause', () => {
      // `--` est trop court ET mal formé : le message le plus parlant gagne.
      expect(validateSlug('--').error).toBe(SLUG_ERRORS.LEADING_HYPHEN);
    });

    test('a slug rejected by the rules never matches the pattern', () => {
      ['-hamza', 'hamza-', 'hamza--ayachi', 'hamza_ayachi', 'hamza ayachi']
        .forEach((slug) => expect(SLUG_PATTERN.test(slug)).toBe(false));
    });

    test('does not reserve availability checks (that is DomainService job)', () => {
      // `admin` est réservé, mais son FORMAT est valide : la distinction compte
      // pour que /api/check-slug puisse renvoyer une raison précise.
      expect(validateSlug('admin')).toEqual({ valid: true, slug: 'admin' });
    });
  });

  describe('checkSlugEditable', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    const buildDomain = (lockedAt) => {
      const doc = new ArtisanDomain({
        artisanId: new mongoose.Types.ObjectId(),
        slug: 'hamza-ayachi',
      });
      doc.lockedAt = lockedAt;
      return doc;
    };

    test('a brand new artisan without a mini site is editable', () => {
      expect(checkSlugEditable(null, now)).toEqual({ editable: true, daysRemaining: null });
      expect(checkSlugEditable(undefined, now)).toEqual({ editable: true, daysRemaining: null });
    });

    test('editable inside the 30-day window, with days remaining', () => {
      const result = checkSlugEditable(buildDomain(new Date(now.getTime() + 12 * DAY_MS)), now);

      expect(result.editable).toBe(true);
      expect(result.daysRemaining).toBe(12);
      expect(result.error).toBeUndefined();
    });

    test('a freshly created domain is editable for 30 days', () => {
      const doc = new ArtisanDomain({
        artisanId: new mongoose.Types.ObjectId(),
        slug: 'hamza-ayachi',
      });
      const result = checkSlugEditable(doc);

      expect(result.editable).toBe(true);
      expect(result.daysRemaining).toBe(30);
    });

    test('locked once lockedAt is passed', () => {
      const result = checkSlugEditable(buildDomain(new Date(now.getTime() - DAY_MS)), now);

      expect(result.editable).toBe(false);
      expect(result.daysRemaining).toBe(0);
      expect(result.error).toBe(SLUG_ERRORS.LOCKED);
      expect(result.message).toBe(SLUG_ERROR_MESSAGES[SLUG_ERRORS.LOCKED]);
    });

    test('works on a plain object, not only on a mongoose document', () => {
      // Utile si le document arrive via .lean() ou d'un cache.
      expect(checkSlugEditable({ lockedAt: new Date(now.getTime() - DAY_MS) }, now).editable).toBe(false);
      expect(checkSlugEditable({ lockedAt: new Date(now.getTime() + DAY_MS) }, now).editable).toBe(true);
    });

    test('computes daysRemaining on a plain object too', () => {
      expect(checkSlugEditable({ lockedAt: new Date(now.getTime() + 7 * DAY_MS) }, now).daysRemaining).toBe(7);
      expect(checkSlugEditable({ lockedAt: new Date(now.getTime() - DAY_MS) }, now).daysRemaining).toBe(0);
      expect(checkSlugEditable({}, now).daysRemaining).toBeNull();
    });

    test('accepts an ISO date string, as returned by a JSON payload', () => {
      const future = new Date(now.getTime() + 3 * DAY_MS).toISOString();
      const past = new Date(now.getTime() - 3 * DAY_MS).toISOString();

      expect(checkSlugEditable({ lockedAt: future }, now)).toEqual({
        editable: true,
        daysRemaining: 3,
      });
      expect(checkSlugEditable({ lockedAt: past }, now).editable).toBe(false);
    });
  });
});
