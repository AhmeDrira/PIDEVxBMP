const mongoose = require('mongoose');
const TechSheetCache = require('../../../models/TechSheetCache');

describe('TechSheetCache model', () => {
  test('defaults -> empty profile arrays and failure state', () => {
    const doc = new TechSheetCache({ productId: new mongoose.Types.ObjectId() });
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.success).toBe(false);
    expect(doc.confidence).toBe(0);
    expect(Array.isArray(doc.profile.norms)).toBe(true);
    expect(Array.isArray(doc.profile.materials)).toBe(true);
  });

  test('validateSync -> accepts complete nominal payload', () => {
    const doc = new TechSheetCache({
      productId: new mongoose.Types.ObjectId(),
      techSheetUrl: 'https://cdn.example.com/ts.pdf',
      extractedText: 'NF EN 206 CE',
      profile: {
        norms: ['NF EN 206'],
        certifications: ['CE'],
        resistance: ['30 MPa'],
        dimensions: ['200x100 mm'],
        environment: ['exterieur'],
        safety: ['A2'],
        materials: ['beton'],
        keywords: ['fondation'],
      },
      confidence: 0.8,
      success: true,
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.success).toBe(true);
  });

  test('schema has productId unique index', () => {
    const indexes = TechSheetCache.schema.indexes();
    const hasUniqueProduct = indexes.some(
      ([fields, opts]) => fields.productId === 1 && opts.unique === true
    );

    expect(hasUniqueProduct).toBe(true);
  });
});
