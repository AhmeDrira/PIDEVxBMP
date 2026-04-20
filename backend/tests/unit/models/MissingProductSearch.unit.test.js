const mongoose = require('mongoose');
const MissingProductSearch = require('../../../models/MissingProductSearch');

describe('MissingProductSearch model', () => {
  test('validateSync -> fails when required fields are missing', () => {
    const doc = new MissingProductSearch({});
    const err = doc.validateSync();

    expect(err.errors.user).toBeDefined();
    expect(err.errors.genericName).toBeDefined();
    expect(err.errors.normalizedName).toBeDefined();
  });

  test('defaults -> source and clickedAt are set', () => {
    const doc = new MissingProductSearch({
      user: new mongoose.Types.ObjectId(),
      genericName: 'Parpaing',
      normalizedName: 'parpaing',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.source).toBe('ai-shopper');
    expect(doc.clickedAt).toBeInstanceOf(Date);
  });

  test('schema contains expected indexes', () => {
    const indexes = MissingProductSearch.schema.indexes();
    const hasNormalizedIndex = indexes.some(([fields]) => fields.normalizedName === 1);
    const hasUserTimeIndex = indexes.some(([fields]) => fields.user === 1 && fields.clickedAt === -1);

    expect(hasNormalizedIndex).toBe(true);
    expect(hasUserTimeIndex).toBe(true);
  });
});
