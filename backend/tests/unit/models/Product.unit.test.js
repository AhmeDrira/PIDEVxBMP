const mongoose = require('mongoose');
const Product = require('../../../models/Product');

const buildValidProduct = (overrides = {}) => ({
  name: 'Portland Cement',
  category: 'Beton',
  price: 18,
  stock: 120,
  manufacturer: new mongoose.Types.ObjectId(),
  ...overrides,
});

describe('Product model (unit)', () => {
  it('should validate a correct payload and set schema defaults', () => {
    // Arrange
    const product = new Product(buildValidProduct());

    // Act
    const error = product.validateSync();

    // Assert
    expect(error).toBeUndefined();
    expect(product.status).toBe('active');
    expect(product.rating).toBe(0);
    expect(product.numReviews).toBe(0);
    expect(product.image).toBeTruthy();
  });

  it('should reject invalid enum values such as status', () => {
    // Arrange
    const product = new Product(buildValidProduct({ status: 'deleted' }));

    // Act
    const error = product.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.status).toBeDefined();
  });

  it('should surface validation failures for required fields', () => {
    // Arrange
    const product = new Product({});

    // Act
    const error = product.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.category).toBeDefined();
    expect(error.errors.price).toBeDefined();
    expect(error.errors.manufacturer).toBeDefined();
  });

  it('should reject malformed review subdocuments for security and integrity', () => {
    // Arrange
    const product = new Product(
      buildValidProduct({
        reviews: [{ rating: 5, comment: 'ok' }],
      })
    );

    // Act
    const error = product.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors['reviews.0.user']).toBeDefined();
  });
});
