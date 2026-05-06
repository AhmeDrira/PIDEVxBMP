/**
 * Integration tests for productController via /api/products.
 *
 * External services mocked at module level (BEFORE app/route require):
 *   - stripe (checkout sessions)
 *   - nodemailer
 *   - axios (recommendation controller pulls it for AI calls)
 *   - actionLogger (no-op, but spied)
 */

jest.setTimeout(60000);

// --- External service mocks ---------------------------------------------------

jest.mock('stripe', () => {
  const mockCreate = jest.fn();
  const mockRetrieve = jest.fn();
  const factory = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreate,
        retrieve: mockRetrieve,
      },
    },
  }));
  factory.__create = mockCreate;
  factory.__retrieve = mockRetrieve;
  return factory;
});

const stripeFactory = require('stripe');
const stripeCreateMock = stripeFactory.__create;
const stripeRetrieveMock = stripeFactory.__retrieve;

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-mail' }),
  })),
}));

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

// --- Imports after mocks ------------------------------------------------------

const request = require('supertest');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_CURRENCY = 'usd';
process.env.NODE_ENV = 'test';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildProductApp } = require('../helpers/buildProductApp');
const {
  signTokenFor,
  createArtisan,
  createExpert,
  createManufacturer,
  authHeader,
} = require('../helpers/auth.helpers');

const Product = require('../../../models/Product');
const ProductPayment = require('../../../models/ProductPayment');
const Notification = require('../../../models/Notification');
const ActionLog = require('../../../models/ActionLog');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildProductApp();
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
    name: 'Concrete Mix',
    category: 'cement',
    price: 50,
    stock: 20,
    description: 'High-grade concrete',
    manufacturer: manufacturer._id,
    ...overrides,
  });

// --- /api/products (GET) -----------------------------------------------------

describe('GET /api/products', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('returns only the manufacturers own products', async () => {
    const m1 = await createManufacturer();
    const m2 = await createManufacturer();
    await seedProduct(m1, { name: 'P-M1-A' });
    await seedProduct(m1, { name: 'P-M1-B' });
    await seedProduct(m2, { name: 'P-M2-A' });

    const res = await request(app).get('/api/products').set(authHeader(m1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((p) => p.name).sort()).toEqual(['P-M1-A', 'P-M1-B']);
  });
});

// --- /api/products (POST: create) ---------------------------------------------

describe('POST /api/products', () => {
  it('creates a product with status driven by stock', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products')
      .set(authHeader(m))
      .send({
        name: 'Tile',
        category: 'tile',
        price: 12,
        stock: 5,
        description: 'Ceramic tile',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Tile');
    expect(res.body.status).toBe('low-stock');

    const persisted = await Product.findById(res.body._id);
    expect(persisted.manufacturer.toString()).toBe(m._id.toString());
  });

  it('marks a product as out-of-stock when stock is 0', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products')
      .set(authHeader(m))
      .send({ name: 'X', category: 'cat', price: 10, stock: 0, description: '' });
    expect(res.body.status).toBe('out-of-stock');
  });

  it('returns 500 when required fields are missing (model validation)', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products')
      .set(authHeader(m))
      .send({ description: 'missing required fields' });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to create product/i);
  });
});

// --- /api/products/:id (PUT: update) ----------------------------------------

describe('PUT /api/products/:id', () => {
  it('updates the product when caller is the owner', async () => {
    const m = await createManufacturer();
    const product = await seedProduct(m, { name: 'old', stock: 30 });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set(authHeader(m))
      .send({ name: 'new', category: 'paint', price: 99, stock: 5, description: 'updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('new');
    expect(res.body.status).toBe('low-stock');
    expect(res.body.price).toBe(99);
  });

  it('returns 404 when product does not exist', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .put(`/api/products/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(m))
      .send({ name: 'x', category: 'x', price: 1, stock: 1, description: '' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when caller is not the owner', async () => {
    const m1 = await createManufacturer();
    const m2 = await createManufacturer();
    const product = await seedProduct(m1);

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set(authHeader(m2))
      .send({ name: 'x', category: 'x', price: 1, stock: 1, description: '' });
    expect(res.status).toBe(401);
  });
});

// --- /api/products/:id (DELETE) ----------------------------------------------

describe('DELETE /api/products/:id', () => {
  it('deletes the product when caller is the owner', async () => {
    const m = await createManufacturer();
    const product = await seedProduct(m);

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set(authHeader(m));

    expect(res.status).toBe(200);
    const remaining = await Product.findById(product._id);
    expect(remaining).toBeNull();
  });

  it('returns 404 when product does not exist', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .delete(`/api/products/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(m));
    expect(res.status).toBe(404);
  });

  it('returns 401 when caller is not the owner', async () => {
    const m1 = await createManufacturer();
    const m2 = await createManufacturer();
    const product = await seedProduct(m1);

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set(authHeader(m2));
    expect(res.status).toBe(401);
  });
});

// --- /api/products/marketplace -----------------------------------------------

describe('GET /api/products/marketplace', () => {
  it('returns all products with manufacturer info and review flag', async () => {
    const m = await createManufacturer({ companyName: 'Acme Bricks' });
    const buyer = await createArtisan();
    const reviewer = await createArtisan();

    await seedProduct(m, { name: 'P1', reviews: [{ user: reviewer._id, rating: 5, comment: 'good' }], rating: 5, numReviews: 1 });
    await seedProduct(m, { name: 'P2' });

    const res = await request(app).get('/api/products/marketplace').set(authHeader(buyer));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].manufacturer).toBeTruthy();

    const reviewerView = await request(app).get('/api/products/marketplace').set(authHeader(reviewer));
    const p1 = reviewerView.body.find((p) => p.name === 'P1');
    expect(p1.currentUserHasReviewed).toBe(true);
  });
});

// --- /api/products/ensure-static ----------------------------------------------

describe('POST /api/products/ensure-static', () => {
  it('creates a static product when missing and returns it', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products/ensure-static')
      .set(authHeader(m))
      .send({ name: 'Static-1', category: 'cement', price: 25, stock: 100 });

    expect(res.status).toBe(200);
    expect(res.body.isStaticProduct).toBe(true);
    expect(res.body.name).toBe('Static-1');
  });

  it('updates an existing static product instead of creating a duplicate', async () => {
    const m = await createManufacturer();
    await request(app)
      .post('/api/products/ensure-static')
      .set(authHeader(m))
      .send({ name: 'Static-2', category: 'paint', price: 25, stock: 5 });
    const second = await request(app)
      .post('/api/products/ensure-static')
      .set(authHeader(m))
      .send({ name: 'Static-2', category: 'paint', price: 30, stock: 50 });

    expect(second.status).toBe(200);
    expect(second.body.price).toBe(30);
    const all = await Product.find({ name: 'Static-2', category: 'paint' });
    expect(all).toHaveLength(1);
  });

  it('returns 400 when required data is missing', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products/ensure-static')
      .set(authHeader(m))
      .send({ name: 'no-price' });
    expect(res.status).toBe(400);
  });
});

// --- /api/products/:id/reviews ------------------------------------------------

describe('POST /api/products/:id/reviews', () => {
  it('adds a review and recomputes rating/numReviews', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set(authHeader(buyer))
      .send({ rating: 4, comment: 'nice' });

    expect(res.status).toBe(201);
    const refreshed = await Product.findById(product._id);
    expect(refreshed.numReviews).toBe(1);
    expect(refreshed.rating).toBe(4);
  });

  it('rejects rating outside 1..5', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set(authHeader(buyer))
      .send({ rating: 7 });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate review by the same user', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, {
      reviews: [{ user: buyer._id, rating: 4, comment: 'first' }],
      rating: 4,
      numReviews: 1,
    });

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set(authHeader(buyer))
      .send({ rating: 5 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the product does not exist', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post(`/api/products/${new mongoose.Types.ObjectId()}/reviews`)
      .set(authHeader(buyer))
      .send({ rating: 3 });
    expect(res.status).toBe(404);
  });
});

// --- /api/products/checkout (no Stripe) --------------------------------------

describe('POST /api/products/checkout', () => {
  it('forbids manufacturers from checking out (only artisan/expert)', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products/checkout')
      .set(authHeader(m))
      .send({ items: [{ productId: 'x', quantity: 1, name: 'X', category: 'c', price: 10 }] });
    expect(res.status).toBe(403);
  });

  it('returns 400 when cart is empty', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/products/checkout')
      .set(authHeader(buyer))
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty/i);
  });

  it('completes checkout, decrements stock and creates a ProductPayment', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, { stock: 10, price: 20 });

    const res = await request(app)
      .post('/api/products/checkout')
      .set(authHeader(buyer))
      .send({
        items: [{
          productId: product._id.toString(),
          quantity: 3,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(1);
    expect(res.body.totalAmount).toBe(20 * 3 + 15);

    const after = await Product.findById(product._id);
    expect(after.stock).toBe(7);

    const payment = await ProductPayment.findOne({ user: buyer._id });
    expect(payment).toBeTruthy();
    expect(payment.status).toBe('paid');
    expect(payment.items).toHaveLength(1);

    const notif = await Notification.findOne({ type: 'new_order' });
    expect(notif).toBeTruthy();
  });

  it('returns 400 when stock is insufficient', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, { stock: 1 });

    const res = await request(app)
      .post('/api/products/checkout')
      .set(authHeader(buyer))
      .send({
        items: [{ productId: product._id.toString(), quantity: 5, name: product.name, category: product.category, price: product.price }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not enough stock/i);
  });
});

// --- /api/products/checkout/create-session ----------------------------------

describe('POST /api/products/checkout/create-session', () => {
  it('forbids non-buyer roles', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .post('/api/products/checkout/create-session')
      .set(authHeader(m))
      .send({ items: [] });
    expect(res.status).toBe(403);
  });

  it('returns 400 when cart is empty', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/products/checkout/create-session')
      .set(authHeader(buyer))
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('creates a Stripe session and forwards the URL/id', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, { stock: 10, price: 20 });

    stripeCreateMock.mockResolvedValueOnce({ id: 'cs_test_1', url: 'https://stripe/checkout/cs_test_1' });

    const res = await request(app)
      .post('/api/products/checkout/create-session')
      .set(authHeader(buyer))
      .send({
        items: [{
          productId: product._id.toString(),
          quantity: 2,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('cs_test_1');
    expect(stripeCreateMock).toHaveBeenCalledTimes(1);
    const call = stripeCreateMock.mock.calls[0][0];
    expect(call.mode).toBe('payment');
    expect(call.line_items.length).toBeGreaterThan(0);
  });

  it('returns 400 when stock too low', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, { stock: 1 });

    const res = await request(app)
      .post('/api/products/checkout/create-session')
      .set(authHeader(buyer))
      .send({
        items: [{
          productId: product._id.toString(),
          quantity: 5,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });

    expect(res.status).toBe(400);
    expect(stripeCreateMock).not.toHaveBeenCalled();
  });
});

// --- /api/products/checkout/confirm-session ---------------------------------

describe('POST /api/products/checkout/confirm-session', () => {
  it('returns 400 when sessionId is missing', async () => {
    const buyer = await createArtisan();
    const res = await request(app)
      .post('/api/products/checkout/confirm-session')
      .set(authHeader(buyer))
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('confirms a paid session, decrements stock, creates ProductPayment', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m, { stock: 10, price: 20 });

    // 20 (price) * 100 (minor) * 2 + 15 (shipping) * 100 = 5500
    stripeRetrieveMock.mockResolvedValueOnce({
      id: 'cs_x',
      payment_status: 'paid',
      amount_total: 5500,
    });

    const res = await request(app)
      .post('/api/products/checkout/confirm-session')
      .set(authHeader(buyer))
      .send({
        sessionId: 'cs_x',
        items: [{
          productId: product._id.toString(),
          quantity: 2,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });

    expect(res.status).toBe(200);
    expect(stripeRetrieveMock).toHaveBeenCalledWith('cs_x');
    const payment = await ProductPayment.findOne({ stripeSessionId: 'cs_x' });
    expect(payment).toBeTruthy();
    expect(payment.status).toBe('paid');
  });

  it('rejects a session whose payment_status is not paid', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m);
    stripeRetrieveMock.mockResolvedValueOnce({ id: 'cs_unpaid', payment_status: 'unpaid', amount_total: 0 });

    const res = await request(app)
      .post('/api/products/checkout/confirm-session')
      .set(authHeader(buyer))
      .send({
        sessionId: 'cs_unpaid',
        items: [{
          productId: product._id.toString(),
          quantity: 1,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount mismatches expected total', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m, { price: 20, stock: 10 });

    // expected = 20*100*1 + 15*100 = 3500. We respond 9999.
    stripeRetrieveMock.mockResolvedValueOnce({ id: 'cs_mm', payment_status: 'paid', amount_total: 9999 });
    const res = await request(app)
      .post('/api/products/checkout/confirm-session')
      .set(authHeader(buyer))
      .send({
        sessionId: 'cs_mm',
        items: [{
          productId: product._id.toString(),
          quantity: 1,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mismatch/i);
  });

  it('treats a duplicate confirm (same sessionId) as already processed', async () => {
    const buyer = await createArtisan();
    const m = await createManufacturer();
    const product = await seedProduct(m, { price: 20, stock: 10 });

    // Pre-create a ProductPayment for this session
    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 1, price: 20 }],
      totalAmount: 35,
      stripeSessionId: 'cs_dup',
      status: 'paid',
    });

    const res = await request(app)
      .post('/api/products/checkout/confirm-session')
      .set(authHeader(buyer))
      .send({
        sessionId: 'cs_dup',
        items: [{
          productId: product._id.toString(),
          quantity: 1,
          name: product.name,
          category: product.category,
          price: product.price,
        }],
      });
    expect(res.status).toBe(200);
    expect(res.body.alreadyProcessed).toBe(true);
    expect(stripeRetrieveMock).not.toHaveBeenCalled();
  });
});

// --- /api/products/orders & /api/products/orders/:id/status -----------------

describe('Manufacturer orders endpoints', () => {
  it('lists only the orders that include the manufacturer items', async () => {
    const m1 = await createManufacturer();
    const m2 = await createManufacturer();
    const buyer = await createExpert();

    const product1 = await seedProduct(m1, { name: 'A' });
    const product2 = await seedProduct(m2, { name: 'B' });

    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product1._id, manufacturerId: m1._id, name: 'A', quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });
    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product2._id, manufacturerId: m2._id, name: 'B', quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app).get('/api/products/orders').set(authHeader(m1));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].products).toContain('A');
  });

  it('updates an order status (and notifies the buyer)', async () => {
    const m = await createManufacturer();
    const buyer = await createExpert();
    const product = await seedProduct(m);

    const order = await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app)
      .put(`/api/products/orders/${order._id}/status`)
      .set(authHeader(m))
      .send({ status: 'shipped' });

    expect(res.status).toBe(200);
    const refreshed = await ProductPayment.findById(order._id);
    expect(refreshed.status).toBe('shipped');
    expect(refreshed.deliveryTimeline).toHaveLength(1);

    const notif = await Notification.findOne({ type: 'order_status_update', recipient: buyer._id });
    expect(notif).toBeTruthy();
  });

  it('rejects an invalid status value', async () => {
    const m = await createManufacturer();
    const order = await ProductPayment.create({
      user: m._id,
      items: [{ productId: new mongoose.Types.ObjectId(), manufacturerId: m._id, name: 'x', quantity: 1, price: 1 }],
      totalAmount: 16,
      status: 'paid',
    });
    const res = await request(app)
      .put(`/api/products/orders/${order._id}/status`)
      .set(authHeader(m))
      .send({ status: 'wat' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when order does not exist', async () => {
    const m = await createManufacturer();
    const res = await request(app)
      .put(`/api/products/orders/${new mongoose.Types.ObjectId()}/status`)
      .set(authHeader(m))
      .send({ status: 'shipped' });
    expect(res.status).toBe(404);
  });

  it('forbids a manufacturer from updating an order without their items', async () => {
    const m1 = await createManufacturer();
    const m2 = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m2);

    const order = await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m2._id, name: 'B', quantity: 1, price: 5 }],
      totalAmount: 20,
      status: 'paid',
    });

    const res = await request(app)
      .put(`/api/products/orders/${order._id}/status`)
      .set(authHeader(m1))
      .send({ status: 'shipped' });
    expect(res.status).toBe(403);
  });
});

// --- /api/products/analytics --------------------------------------------------

describe('GET /api/products/analytics', () => {
  it('aggregates revenue, orders and top products for the manufacturer', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const productA = await seedProduct(m, { name: 'A', price: 10 });
    const productB = await seedProduct(m, { name: 'B', price: 20 });

    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: productA._id, manufacturerId: m._id, name: 'A', quantity: 2, price: 10 }],
      totalAmount: 35,
      status: 'paid',
    });
    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: productB._id, manufacturerId: m._id, name: 'B', quantity: 1, price: 20 }],
      totalAmount: 35,
      status: 'paid',
    });

    const res = await request(app).get('/api/products/analytics').set(authHeader(m));
    expect(res.status).toBe(200);
    expect(res.body.stats.totalOrders).toBe(2);
    expect(res.body.stats.totalRevenue).toBe(40);
    expect(res.body.stats.activeProducts).toBe(2);
    expect(res.body.topProducts).toHaveLength(2);
    expect(res.body.monthlyData).toHaveLength(6);
  });
});

// --- /api/products/my-orders --------------------------------------------------

describe('Buyer order endpoints', () => {
  it('lists the buyers own orders', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m);
    await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app).get('/api/products/my-orders').set(authHeader(buyer));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalAmount).toBe(25);
  });

  it('returns 404 when fetching another users order', async () => {
    const m = await createManufacturer();
    const me = await createArtisan();
    const other = await createArtisan();
    const product = await seedProduct(m);
    const order = await ProductPayment.create({
      user: other._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 1, price: 10 }],
      totalAmount: 25,
      status: 'paid',
    });

    const res = await request(app).get(`/api/products/my-orders/${order._id}`).set(authHeader(me));
    expect(res.status).toBe(404);
  });

  it('returns the order details for the owner', async () => {
    const m = await createManufacturer();
    const buyer = await createArtisan();
    const product = await seedProduct(m);
    const order = await ProductPayment.create({
      user: buyer._id,
      items: [{ productId: product._id, manufacturerId: m._id, name: product.name, quantity: 2, price: 10 }],
      totalAmount: 35,
      status: 'paid',
    });

    const res = await request(app).get(`/api/products/my-orders/${order._id}`).set(authHeader(buyer));
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe(35);
    expect(res.body.items).toHaveLength(1);
  });
});
