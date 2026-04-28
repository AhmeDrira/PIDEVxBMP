const { buildReq, buildRes } = require('../mocks/http.mock');

jest.mock('../../../models/Product', () => {
  const ProductMock = jest.fn().mockImplementation((payload) => ({
    ...payload,
    _id: 'p-new',
    save: jest.fn().mockResolvedValue({ _id: 'p-new', ...payload }),
  }));

  ProductMock.find = jest.fn();
  ProductMock.findById = jest.fn();
  ProductMock.findOneAndUpdate = jest.fn();
  ProductMock.exists = jest.fn();

  return ProductMock;
});

jest.mock('../../../models/Project', () => ({}));
jest.mock('../../../models/Invoice', () => ({}));
jest.mock('../../../models/ActionLog', () => ({ findOne: jest.fn() }));
jest.mock('../../../models/ProductPayment', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../../../models/Notification', () => ({ create: jest.fn() }));
jest.mock('mongoose', () => ({ Types: { ObjectId: { isValid: jest.fn(() => true) } } }));
jest.mock('../../../models/User', () => ({ User: { findById: jest.fn(), findOne: jest.fn() } }));
jest.mock('../../../utils/actionLogger', () => ({ logAction: jest.fn() }));

const Product = require('../../../models/Product');
const { logAction } = require('../../../utils/actionLogger');
const controller = require('../../../controllers/productController');

describe('productController', () => {
  test('createProduct -> 201 on success', async () => {
    const req = buildReq({
      user: { id: 'm1' },
      body: { name: 'Ciment', category: 'Beton', price: 20, stock: 5, description: '50kg' },
      files: {},
    });
    const res = buildRes();

    await controller.createProduct(req, res);

    expect(Product).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(logAction).toHaveBeenCalled();
  });

  test('createProduct -> 500 when save fails', async () => {
    Product.mockImplementationOnce((payload) => ({
      ...payload,
      save: jest.fn().mockRejectedValue(new Error('save fail')),
    }));

    const req = buildReq({
      user: { id: 'm1' },
      body: { name: 'Ciment', category: 'Beton', price: 20, stock: 5, description: '50kg' },
      files: {},
    });
    const res = buildRes();

    await controller.createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toMatch(/Failed to create product/i);
  });

  test('updateProduct -> 404 when product does not exist', async () => {
    Product.findById.mockResolvedValue(null);

    const req = buildReq({ user: { id: 'm1' }, params: { id: 'p1' }, body: {}, files: {} });
    const res = buildRes();

    await controller.updateProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateProduct -> 401 when ownership check fails', async () => {
    Product.findById.mockResolvedValue({ manufacturer: { toString: () => 'other' } });

    const req = buildReq({ user: { id: 'm1' }, params: { id: 'p1' }, body: {}, files: {} });
    const res = buildRes();

    await controller.updateProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('updateProduct -> 200 when owner updates product', async () => {
    const productDoc = {
      _id: 'p1',
      manufacturer: { toString: () => 'm1' },
      price: 5,
      stock: 3,
      save: jest.fn().mockResolvedValue({ _id: 'p1', name: 'Updated' }),
    };
    Product.findById.mockResolvedValue(productDoc);

    const req = buildReq({
      user: { id: 'm1' },
      params: { id: 'p1' },
      body: { name: 'Updated', category: 'Beton', price: 10, stock: 12, description: 'x' },
      files: {},
    });
    const res = buildRes();

    await controller.updateProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(productDoc.save).toHaveBeenCalled();
  });

  test('createProductReview -> 400 when rating is invalid', async () => {
    Product.findById.mockResolvedValue({ reviews: [] });

    const req = buildReq({
      user: { _id: 'u1' },
      params: { id: 'p1' },
      body: { rating: 7, comment: 'Too high' },
    });
    const res = buildRes();

    await controller.createProductReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createProductReview -> 401 when reviewer is missing', async () => {
    Product.findById.mockResolvedValue({ reviews: [] });

    const req = buildReq({ user: {}, params: { id: 'p1' }, body: { rating: 4 } });
    const res = buildRes();

    await controller.createProductReview(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('createProductReview -> 201 on valid review', async () => {
    const productDoc = {
      reviews: [],
      save: jest.fn().mockResolvedValue(),
    };
    Product.findById.mockResolvedValue(productDoc);

    const req = buildReq({
      user: { _id: 'u1' },
      params: { id: 'p1' },
      body: { rating: 5, comment: 'Excellent' },
    });
    const res = buildRes();

    await controller.createProductReview(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.message).toBe('Review added');
  });
});
