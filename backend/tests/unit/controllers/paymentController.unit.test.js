const { buildReq, buildRes } = require('../../http.mock');

jest.mock('../../../models/Product', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/User', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../../../models/SubscriptionPayment', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/ProductPayment', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const { User } = require('../../../models/User');
const SubscriptionPayment = require('../../../models/SubscriptionPayment');
const ProductPayment = require('../../../models/ProductPayment');
const controller = require('../../../controllers/paymentController');

describe('paymentController', () => {
  test('createCheckoutSession -> 403 for unauthorized role', async () => {
    const req = buildReq({
      user: { _id: 'u1', role: 'manufacturer' },
      body: { items: [{ productId: 'p1', quantity: 1 }] },
    });
    const res = buildRes();

    await controller.createCheckoutSession(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('createCheckoutSession -> 500 when stripe key is missing', async () => {
    const req = buildReq({
      user: { _id: 'u1', role: 'artisan' },
      body: { items: [{ productId: 'p1', quantity: 1 }] },
    });
    const res = buildRes();

    await controller.createCheckoutSession(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toMatch(/Stripe secret key is missing/i);
  });

  test('createSubscriptionSession -> 500 when stripe key is missing', async () => {
    const req = buildReq({
      user: { _id: 'u1', role: 'artisan' },
      body: { planId: 'monthly', price: 29.9, name: 'Pro', duration: '1 month' },
    });
    const res = buildRes();

    await controller.createSubscriptionSession(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('verifyCheckout -> 400 when sessionId is missing', async () => {
    const req = buildReq({ query: {} });
    const res = buildRes();

    await controller.verifyCheckout(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/session id is required/i);
  });

  test('getSubscriptionHistory -> 401 without authenticated user', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();

    await controller.getSubscriptionHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('cancelSubscription -> 400 when no active subscription exists', async () => {
    User.findById.mockResolvedValue({
      _id: 'u1',
      subscription: { status: 'inactive', planId: 'monthly' },
    });

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.cancelSubscription(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/No active subscription found/i);
  });

  test('getProductPayments -> 200 returns sorted payments', async () => {
    const payments = [{ _id: 'pay1' }, { _id: 'pay2' }];
    const chain = {
      populate: jest.fn(() => chain),
      sort: jest.fn().mockResolvedValue(payments),
    };
    ProductPayment.find.mockReturnValue(chain);

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.getProductPayments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual(payments);
  });

  test('downloadSubscriptionReceiptPdf -> 401 without user', async () => {
    const req = buildReq({ user: null, params: { id: 'sub1' } });
    const res = buildRes();

    await controller.downloadSubscriptionReceiptPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('getSubscriptionHistory -> 500 when query fails', async () => {
    SubscriptionPayment.find.mockImplementation(() => {
      throw new Error('db failure');
    });

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.getSubscriptionHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
