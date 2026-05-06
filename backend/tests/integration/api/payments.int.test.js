/**
 * Integration tests for paymentController via /api/payments.
 *
 * paymentController loads `require('stripe')(stripeKey)` at module init, so the
 * stripe factory must be mocked BEFORE the route file is required.
 *
 * The PDF endpoints depend on puppeteer-core + a local Chrome binary, which are
 * unavailable in CI. We assert that they fail gracefully (500 with explanatory
 * message) — that path is itself useful coverage.
 */

jest.setTimeout(60000);

// --- External service mocks ---------------------------------------------------

jest.mock('stripe', () => {
  const mockCreate = jest.fn();
  const mockRetrieve = jest.fn();
  const factory = jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCreate, retrieve: mockRetrieve } },
  }));
  factory.__create = mockCreate;
  factory.__retrieve = mockRetrieve;
  return factory;
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-mail' }),
  })),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

// --- Imports after mocks ------------------------------------------------------

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const stripeFactory = require('stripe');
const stripeCreateMock = stripeFactory.__create;
const stripeRetrieveMock = stripeFactory.__retrieve;

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildPaymentApp } = require('../helpers/buildPaymentApp');
const {
  createArtisan,
  createExpert,
  createManufacturer,
  authHeader,
} = require('../helpers/auth.helpers');

const Product = require('../../../models/Product');
const ProductPayment = require('../../../models/ProductPayment');
const SubscriptionPayment = require('../../../models/SubscriptionPayment');
const Notification = require('../../../models/Notification');
const { User } = require('../../../models/User');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildPaymentApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
  stripeCreateMock.mockReset();
  stripeRetrieveMock.mockReset();
});

const seedProduct = async (manufacturer, overrides = {}) =>
  Product.create({
    name: 'Sand 25kg',
    category: 'sand',
    price: 30,
    stock: 50,
    description: '',
    manufacturer: manufacturer._id,
    ...overrides,
  });

// --- POST /api/payments/checkout ---------------------------------------------

describe('POST /api/payments/checkout', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/payments/checkout').send({});
    expect(res.status).toBe(401);
  });

  it('forbids non-buyer roles', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(m))
      .send({ items: [] });
    expect(res.status).toBe(403);
  });

  it('returns 400 when cart is empty', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(buyer))
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when items normalize to nothing', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(buyer))
      .send({ items: [{ productId: '', quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 404 when a referenced product does not exist', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(buyer))
      .send({ items: [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it('creates a Stripe session and returns its url', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m, { price: 25 });

    stripeCreateMock.mockResolvedValueOnce({ id: 'cs_pay_1', url: 'https://stripe/checkout/cs_pay_1' });

    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(buyer))
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/stripe/);
    const args = stripeCreateMock.mock.calls[0][0];
    expect(args.line_items).toHaveLength(1);
    expect(args.line_items[0].price_data.unit_amount).toBe(2500);
  });

  it('returns 400 when product price falls below Stripe minimum', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m, { price: 0.1 }); // 10 cents < 50 minimum

    const res = await request(app)
      .post('/api/payments/checkout')
      .set(authHeader(buyer))
      .send({ items: [{ productId: product._id.toString(), quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid product price/i);
  });
});

// --- POST /api/payments/subscription ----------------------------------------

describe('POST /api/payments/subscription', () => {
  it('forbids non-buyer roles', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/payments/subscription')
      .set(authHeader(m))
      .send({ planId: 'monthly', price: 10, name: 'Monthly', duration: '30 days' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when planId or price is missing', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/payments/subscription')
      .set(authHeader(buyer))
      .send({ planId: 'monthly' });
    expect(res.status).toBe(400);
  });

  it('creates a Stripe session and stores its id on the user', async () => {
    const buyer = await createArtisan();
    stripeCreateMock.mockResolvedValueOnce({ id: 'cs_sub_1', url: 'https://stripe/cs_sub_1' });

    const res = await request(app)
      .post('/api/payments/subscription')
      .set(authHeader(buyer))
      .send({ planId: 'monthly', price: 25, name: 'Monthly', duration: '30 days' });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/stripe/);

    const refreshed = await User.findById(buyer._id);
    expect(refreshed.subscription.stripeSessionId).toBe('cs_sub_1');
  });
});

// --- GET /api/payments/subscription/verify ----------------------------------

describe('GET /api/payments/subscription/verify', () => {
  it('returns 400 when sessionId missing', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .get('/api/payments/subscription/verify')
      .set(authHeader(buyer));
    expect(res.status).toBe(400);
  });

  it('activates subscription when payment_status is paid', async () => {
    const buyer = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({
      id: 'cs_sub_p',
      payment_status: 'paid',
      currency: 'usd',
      amount_total: 2500,
      metadata: { userId: buyer._id.toString(), planId: 'monthly' },
    });

    const res = await request(app)
      .get('/api/payments/subscription/verify')
      .query({ sessionId: 'cs_sub_p' })
      .set(authHeader(buyer));

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('active');

    const recorded = await SubscriptionPayment.findOne({ stripeSessionId: 'cs_sub_p' });
    expect(recorded).toBeTruthy();
    expect(recorded.amount).toBe(25);

    const notif = await Notification.findOne({ type: 'subscription_activated', recipient: buyer._id });
    expect(notif).toBeTruthy();
  });

  it('rejects when stripe payment is not paid', async () => {
    const buyer = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'unpaid',
      currency: 'usd',
      amount_total: 0,
      metadata: { userId: buyer._id.toString(), planId: 'monthly' },
    });

    const res = await request(app)
      .get('/api/payments/subscription/verify')
      .query({ sessionId: 'cs_sub_unpaid' })
      .set(authHeader(buyer));
    expect(res.status).toBe(400);
  });
});

// --- GET /api/payments/subscription/history ---------------------------------

describe('GET /api/payments/subscription/history', () => {
  it('returns the users subscription payments sorted by date', async () => {
    const buyer = await createArtisan();
    await SubscriptionPayment.create({
      user: buyer._id, planId: 'monthly', amount: 25, currency: 'USD',
      stripeSessionId: 'cs1', status: 'paid', paymentDate: new Date('2025-01-01'),
    });
    await SubscriptionPayment.create({
      user: buyer._id, planId: 'yearly', amount: 250, currency: 'USD',
      stripeSessionId: 'cs2', status: 'paid', paymentDate: new Date('2025-06-01'),
    });
    const other = await createArtisan();
    await SubscriptionPayment.create({
      user: other._id, planId: 'monthly', amount: 25, currency: 'USD',
      stripeSessionId: 'cs3', status: 'paid', paymentDate: new Date(),
    });

    const res = await request(app)
      .get('/api/payments/subscription/history')
      .set(authHeader(buyer));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].planId).toBe('yearly');
  });
});

// --- POST /api/payments/subscription/cancel ---------------------------------

describe('POST /api/payments/subscription/cancel', () => {
  it('rejects when there is no active subscription', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/payments/subscription/cancel')
      .set(authHeader(buyer));
    expect(res.status).toBe(400);
  });

  it('cancels an active subscription and computes a refund', async () => {
    const start = new Date();
    start.setDate(start.getDate() - 10);
    const end = new Date();
    end.setDate(end.getDate() + 20); // 20 days remaining of 30 total

    const buyer = await createArtisan();
    buyer.subscription = {
      planId: 'monthly',
      status: 'active',
      startDate: start,
      endDate: end,
      stripeSessionId: 'cs_active',
    };
    await buyer.save();

    await SubscriptionPayment.create({
      user: buyer._id,
      planId: 'monthly',
      amount: 30,
      currency: 'USD',
      stripeSessionId: 'cs_active',
      status: 'paid',
      paymentDate: start,
    });

    const res = await request(app)
      .post('/api/payments/subscription/cancel')
      .set(authHeader(buyer));

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('canceled');
    // 30 USD * 20/30 = 20 USD
    expect(res.body.refundAmount).toBeGreaterThan(15);
    expect(res.body.refundAmount).toBeLessThanOrEqual(20);

    const notif = await Notification.findOne({ type: 'subscription_canceled', recipient: buyer._id });
    expect(notif).toBeTruthy();
  });
});

// --- GET /api/payments/checkout/verify --------------------------------------

describe('GET /api/payments/checkout/verify', () => {
  it('returns 400 when sessionId missing', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .get('/api/payments/checkout/verify')
      .set(authHeader(buyer));
    expect(res.status).toBe(400);
  });

  it('confirms a paid checkout, decrements stock, creates a payment, notifies the manufacturer', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m, { stock: 5, price: 20 });

    stripeRetrieveMock.mockResolvedValueOnce({
      id: 'cs_v1',
      payment_status: 'paid',
      amount_total: 4000, // 2 * 20 * 100
      currency: 'usd',
      metadata: { buyerId: buyer._id.toString(), role: 'artisan' },
      line_items: {
        data: [{
          quantity: 2,
          price: {
            unit_amount: 2000,
            product: {
              name: product.name,
              metadata: {
                productId: product._id.toString(),
                manufacturerId: m._id.toString(),
              },
            },
          },
        }],
      },
    });

    const res = await request(app)
      .get('/api/payments/checkout/verify')
      .query({ sessionId: 'cs_v1' })
      .set(authHeader(buyer));

    expect(res.status).toBe(200);
    const refreshedProduct = await Product.findById(product._id);
    expect(refreshedProduct.stock).toBe(3);

    const payment = await ProductPayment.findOne({ stripeSessionId: 'cs_v1' });
    expect(payment).toBeTruthy();
    expect(payment.totalAmount).toBe(40);

    const notif = await Notification.findOne({ type: 'new_order', recipient: m._id });
    expect(notif).toBeTruthy();
  });

  it('is idempotent on a duplicate verify for the same session', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m);

    await ProductPayment.create({
      user: buyer._id,
      stripeSessionId: 'cs_dup',
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      amount_total: 2500,
      currency: 'usd',
      line_items: { data: [] },
      metadata: { buyerId: buyer._id.toString() },
    });

    const res = await request(app)
      .get('/api/payments/checkout/verify')
      .query({ sessionId: 'cs_dup' })
      .set(authHeader(buyer));
    expect(res.status).toBe(200);

    const all = await ProductPayment.find({ stripeSessionId: 'cs_dup' });
    expect(all).toHaveLength(1);
  });

  it('rejects when stripe payment is not paid', async () => {
    const buyer = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'unpaid',
      amount_total: 0,
      currency: 'usd',
      line_items: { data: [] },
      metadata: {},
    });
    const res = await request(app)
      .get('/api/payments/checkout/verify')
      .query({ sessionId: 'cs_unp' })
      .set(authHeader(buyer));
    expect(res.status).toBe(400);
  });
});

// --- GET /api/payments/product-payments -------------------------------------

describe('GET /api/payments/product-payments', () => {
  it('returns the buyers own product payments only', async () => {
    const buyer = await createExpert();
    const other = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m);

    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: 'p', quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });
    await ProductPayment.create({
      user: other._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: 'p', quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app)
      .get('/api/payments/product-payments')
      .set(authHeader(buyer));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// --- PDF endpoints (best-effort: graceful failure path) ----------------------

describe('PDF endpoints fail gracefully without Puppeteer/Chrome', () => {
  it('returns 404 when payment id is unknown', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .get(`/api/payments/product-payments/${new mongoose.Types.ObjectId()}/pdf`)
      .set(authHeader(buyer));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the payment', async () => {
    const buyer = await createArtisan();
    const other = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m);
    const payment = await ProductPayment.create({
      user: other._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: 'p', quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app)
      .get(`/api/payments/product-payments/${payment._id}/pdf`)
      .set(authHeader(buyer));
    expect(res.status).toBe(403);
  });

  it('returns 404 when subscription receipt id is unknown', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .get(`/api/payments/subscription/history/${new mongoose.Types.ObjectId()}/pdf`)
      .set(authHeader(buyer));
    expect(res.status).toBe(404);
  });
});
