const mongoose = require('mongoose');
const Product = require('../../../models/Product');

describe('Product model', () => {
  const validPayload = () => ({
    name: 'Ciment 50kg',
    category: 'Beton',
    price: 18,
    stock: 10,
    manufacturer: new mongoose.Types.ObjectId(),
  });

  test('validateSync -> fails when required fields are missing', () => {
    const doc = new Product({});
    const err = doc.validateSync();

    expect(err.errors.name).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.price).toBeDefined();
    expect(err.errors.manufacturer).toBeDefined();
  });

  test('defaults -> status, image and marketplace counters are initialized', () => {
    const doc = new Product(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('active');
    expect(doc.rating).toBe(0);
    expect(doc.numReviews).toBe(0);
    expect(typeof doc.image).toBe('string');
    expect(doc.image.length).toBeGreaterThan(0);
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new Product({ ...validPayload(), status: 'archived' });
    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });

  test('validateSync -> review subdocument requires user and rating', () => {
    const doc = new Product({
      ...validPayload(),
      reviews: [{ comment: 'ok' }],
    });

    const err = doc.validateSync();

    expect(err.errors['reviews.0.user']).toBeDefined();
    expect(err.errors['reviews.0.rating']).toBeDefined();
  });
});
