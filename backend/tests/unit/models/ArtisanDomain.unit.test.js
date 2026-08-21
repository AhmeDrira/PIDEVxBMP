const mongoose = require('mongoose');
const ArtisanDomain = require('../../../models/ArtisanDomain');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('ArtisanDomain model', () => {
  test('validateSync -> fails on missing required fields', () => {
    const doc = new ArtisanDomain({});
    const err = doc.validateSync();

    expect(err.errors.artisanId).toBeDefined();
    expect(err.errors.slug).toBeDefined();
  });

  test('validateSync -> accepts nominal domain', () => {
    const doc = new ArtisanDomain({
      artisanId: new mongoose.Types.ObjectId(),
      slug: 'hamza-ayachi',
    });

    expect(doc.validateSync()).toBeUndefined();
  });

  test('applies defaults: verified=false, createdAt, lockedAt at +30 days', () => {
    const before = Date.now();
    const doc = new ArtisanDomain({
      artisanId: new mongoose.Types.ObjectId(),
      slug: 'hamza-ayachi',
    });
    const after = Date.now();

    expect(doc.verified).toBe(false);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.createdAt.getTime()).toBeLessThanOrEqual(after);

    expect(doc.lockedAt).toBeInstanceOf(Date);
    expect(doc.lockedAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
    expect(doc.lockedAt.getTime()).toBeLessThanOrEqual(after + 30 * DAY_MS);
  });

  test('optional fields stay undefined when not provided', () => {
    const doc = new ArtisanDomain({
      artisanId: new mongoose.Types.ObjectId(),
      slug: 'hamza-ayachi',
    });

    expect(doc.customDomain).toBeUndefined();
    expect(doc.tlsStatus).toBeUndefined();
  });

  test('slug and customDomain are lowercased and trimmed', () => {
    const doc = new ArtisanDomain({
      artisanId: new mongoose.Types.ObjectId(),
      slug: '  Hamza-AYACHI  ',
      customDomain: '  WWW.Hamza.TN ',
    });

    expect(doc.slug).toBe('hamza-ayachi');
    expect(doc.customDomain).toBe('www.hamza.tn');
  });

  test('artisanId references the User model (Artisan is a discriminator of User)', () => {
    expect(ArtisanDomain.schema.path('artisanId').options.ref).toBe('User');
  });

  test('schema declares unique indexes on artisanId and slug', () => {
    const indexes = ArtisanDomain.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ artisanId: 1 }, expect.objectContaining({ unique: true })],
        [{ slug: 1 }, expect.objectContaining({ unique: true })],
      ])
    );
  });

  test('customDomain unique index is partial so multiple docs may omit it', () => {
    const entry = ArtisanDomain.schema
      .indexes()
      .find(([fields]) => fields.customDomain === 1);

    expect(entry).toBeDefined();
    expect(entry[1].unique).toBe(true);
    expect(entry[1].partialFilterExpression).toEqual({ customDomain: { $type: 'string' } });
  });

  describe('isSlugLocked / daysUntilLock', () => {
    const build = (lockedAt) => {
      const doc = new ArtisanDomain({
        artisanId: new mongoose.Types.ObjectId(),
        slug: 'hamza-ayachi',
      });
      doc.lockedAt = lockedAt;
      return doc;
    };

    test('not locked while lockedAt is in the future', () => {
      const now = new Date('2026-08-20T12:00:00Z');
      const doc = build(new Date(now.getTime() + 10 * DAY_MS));

      expect(doc.isSlugLocked(now)).toBe(false);
      expect(doc.daysUntilLock(now)).toBe(10);
    });

    test('locked once lockedAt is reached', () => {
      const now = new Date('2026-08-20T12:00:00Z');

      expect(build(now).isSlugLocked(now)).toBe(true);
      expect(build(new Date(now.getTime() - DAY_MS)).isSlugLocked(now)).toBe(true);
    });

    test('daysUntilLock returns 0 once locked', () => {
      const now = new Date('2026-08-20T12:00:00Z');
      const doc = build(new Date(now.getTime() - 5 * DAY_MS));

      expect(doc.daysUntilLock(now)).toBe(0);
    });

    test('daysUntilLock rounds a partial day up', () => {
      const now = new Date('2026-08-20T12:00:00Z');
      const doc = build(new Date(now.getTime() + DAY_MS + 60 * 1000));

      expect(doc.daysUntilLock(now)).toBe(2);
    });

    test('a document without lockedAt is never locked', () => {
      const doc = build(undefined);

      expect(doc.isSlugLocked(new Date())).toBe(false);
      expect(doc.daysUntilLock(new Date())).toBeNull();
    });
  });
});
