const mongoose = require('mongoose');
const Review = require('../../../models/Review');

describe('Review model', () => {
  test('validateSync -> fails on missing required fields', () => {
    const doc = new Review({});
    const err = doc.validateSync();

    expect(err.errors.artisan).toBeDefined();
    expect(err.errors.expert).toBeDefined();
    expect(err.errors.rating).toBeDefined();
  });

  test('validateSync -> accepts nominal review', () => {
    const doc = new Review({
      artisan: new mongoose.Types.ObjectId(),
      expert: new mongoose.Types.ObjectId(),
      rating: 4,
      comment: 'Great work',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
  });

  test('validateSync -> rejects rating out of bounds', () => {
    const doc = new Review({
      artisan: new mongoose.Types.ObjectId(),
      expert: new mongoose.Types.ObjectId(),
      rating: 6,
    });

    const err = doc.validateSync();

    expect(err.errors.rating).toBeDefined();
  });

  test('schema defines unique index on artisan+expert', () => {
    const indexes = Review.schema.indexes();
    const hasUniquePair = indexes.some(
      ([fields, opts]) => fields.artisan === 1 && fields.expert === 1 && opts.unique === true
    );

    expect(hasUniquePair).toBe(true);
  });
});
