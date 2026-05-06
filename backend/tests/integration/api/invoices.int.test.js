/**
 * Integration tests for invoiceController via /api/invoices.
 * Stripe is mocked, so payment-session endpoints stay deterministic.
 */

jest.setTimeout(60000);

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

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const stripeFactory = require('stripe');
const stripeCreateMock = stripeFactory.__create;
const stripeRetrieveMock = stripeFactory.__retrieve;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_CURRENCY = 'usd';
process.env.NODE_ENV = 'test';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildInvoiceApp } = require('../helpers/buildInvoiceApp');
const { createArtisan, authHeader } = require('../helpers/auth.helpers');

const Invoice = require('../../../models/Invoice');
const Quote = require('../../../models/Quote');
const Project = require('../../../models/Project');
const Notification = require('../../../models/Notification');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildInvoiceApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
  stripeCreateMock.mockReset();
  stripeRetrieveMock.mockReset();
});

const seedProject = async (artisan) =>
  Project.create({
    title: 'Kitchen Renovation',
    description: 'desc',
    location: 'Sfax',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 86400000),
    artisan: artisan._id,
  });

const seedInvoice = async (artisan, project, overrides = {}) =>
  Invoice.create({
    invoiceNumber: `INV-T-${Math.floor(1000 + Math.random() * 9000)}`,
    project: project._id,
    artisan: artisan._id,
    clientName: 'Mr. Client',
    amount: 1000,
    description: 'work',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 14 * 86400000),
    paidAmount: 0,
    paymentProgress: 0,
    paymentPlan: {
      firstTranchePercent: 50,
      secondTranchePercent: 50,
      firstTrancheAmount: 500,
      secondTrancheAmount: 500,
      firstTranchePaid: false,
      secondTranchePaid: false,
    },
    delivery: { status: 'none', timeline: [] },
    paymentSessions: [],
    status: 'pending',
    ...overrides,
  });

// --- POST /api/invoices ------------------------------------------------------

describe('POST /api/invoices', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/invoices').send({});
    expect(res.status).toBe(401);
  });

  it('creates an invoice with computed payment plan and unique number', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);

    const res = await request(app).post('/api/invoices').set(authHeader(a)).send({
      project: project._id.toString(),
      clientName: 'Mr X',
      amount: 800,
      description: 'description here',
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      upfrontPercent: 40,
    });

    expect(res.status).toBe(201);
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(res.body.paymentPlan.firstTranchePercent).toBe(40);
    expect(res.body.paymentPlan.secondTranchePercent).toBe(60);
    expect(res.body.paymentPlan.firstTrancheAmount).toBe(320);
    expect(res.body.paymentPlan.secondTrancheAmount).toBe(480);
  });

  it('clamps upfrontPercent to [1..99]', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const res = await request(app).post('/api/invoices').set(authHeader(a)).send({
      project: project._id.toString(),
      clientName: 'X',
      amount: 100,
      description: 'd',
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      upfrontPercent: 200,
    });
    expect(res.status).toBe(201);
    expect(res.body.paymentPlan.firstTranchePercent).toBe(99);
  });

  it('returns 400 when fields are missing', async () => {
    const a = await createArtisan();
    const res = await request(app).post('/api/invoices').set(authHeader(a)).send({ clientName: 'X' });
    expect(res.status).toBe(400);
  });
});

// --- GET /api/invoices -------------------------------------------------------

describe('GET /api/invoices', () => {
  it('returns only the artisans own invoices with normalized payment fields', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const projectA = await seedProject(a);
    const projectO = await seedProject(other);

    await seedInvoice(a, projectA);
    await seedInvoice(a, projectA);
    await seedInvoice(other, projectO);

    const res = await request(app).get('/api/invoices').set(authHeader(a));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    res.body.forEach((inv) => {
      expect(inv.paymentPlan.firstTrancheAmount).toBe(500);
      expect(inv.paymentPlan.secondTrancheAmount).toBe(500);
    });
  });
});

// --- PUT /api/invoices/:id/status -------------------------------------------

describe('PUT /api/invoices/:id/status', () => {
  it('returns 404 when invoice does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .put(`/api/invoices/${new mongoose.Types.ObjectId()}/status`)
      .set(authHeader(a))
      .send({ status: 'paid' });
    expect(res.status).toBe(404);
  });

  it('updates the invoice status', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .put(`/api/invoices/${inv._id}/status`)
      .set(authHeader(a))
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });
});

// --- POST /api/invoices/from-quote/:quoteId ---------------------------------

describe('POST /api/invoices/from-quote/:quoteId', () => {
  const seedApprovedQuote = async (artisan, project) =>
    Quote.create({
      quoteNumber: `QT-FROM-${Math.floor(1000 + Math.random() * 9000)}`,
      project: project._id,
      artisan: artisan._id,
      clientName: 'C',
      laborHand: 200,
      materialsAmount: 800,
      amount: 1000,
      description: 'd',
      validUntil: new Date(Date.now() + 14 * 86400000),
      status: 'approved',
      upfrontPercent: 40,
    });

  it('returns 400 when dueDate is missing', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);
    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when quote does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .post(`/api/invoices/from-quote/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(a))
      .send({ dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the quote owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const projectO = await seedProject(other);
    const quote = await seedApprovedQuote(other, projectO);
    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(403);
  });

  it('refuses non-approved quotes', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);
    quote.status = 'pending';
    await quote.save();
    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid dueDate', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);
    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: 'gibberish' });
    expect(res.status).toBe(400);
  });

  it('rejects a dueDate in the past', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);
    const past = new Date(Date.now() - 7 * 86400000);
    const yyyy = past.getFullYear();
    const mm = String(past.getMonth() + 1).padStart(2, '0');
    const dd = String(past.getDate()).padStart(2, '0');
    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: `${yyyy}-${mm}-${dd}` });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/past/i);
  });

  it('creates an invoice tied to the quote and inherits upfrontPercent', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);

    const future = new Date(Date.now() + 30 * 86400000);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');

    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: `${yyyy}-${mm}-${dd}` });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
    expect(res.body.paymentPlan.firstTranchePercent).toBe(40);
    expect(res.body.paymentPlan.firstTrancheAmount).toBe(400);
    expect(res.body.paymentPlan.secondTrancheAmount).toBe(600);
    expect(res.body.quote).toBe(quote._id.toString());
  });

  it('returns 409 when an invoice already exists for the quote', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const quote = await seedApprovedQuote(a, project);
    await seedInvoice(a, project, { quote: quote._id });

    const res = await request(app)
      .post(`/api/invoices/from-quote/${quote._id}`)
      .set(authHeader(a))
      .send({ dueDate: new Date(Date.now() + 86400000).toISOString() });
    expect(res.status).toBe(409);
  });
});

// --- POST /api/invoices/:id/create-payment-session --------------------------

describe('POST /api/invoices/:id/create-payment-session', () => {
  it('returns 404 when invoice does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .post(`/api/invoices/${new mongoose.Types.ObjectId()}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const inv = await seedInvoice(other, project);
    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown phase', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'middle' });
    expect(res.status).toBe(400);
  });

  it('rejects upfront when already paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });
    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/upfront/i);
  });

  it('rejects completion before upfront paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/upfront tranche must be paid/i);
  });

  it('rejects completion when already paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: true,
      },
    });
    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/completion tranche already paid/i);
  });

  it('creates a Stripe session for upfront tranche', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);

    stripeCreateMock.mockResolvedValueOnce({ id: 'cs_inv_1', url: 'https://stripe/cs_inv_1' });

    const res = await request(app)
      .post(`/api/invoices/${inv._id}/create-payment-session`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(500);
    expect(res.body.phase).toBe('upfront');
    expect(stripeCreateMock).toHaveBeenCalledTimes(1);
    const arg = stripeCreateMock.mock.calls[0][0];
    expect(arg.line_items[0].price_data.unit_amount).toBe(50000); // 500 * 100
    expect(arg.metadata.invoiceId).toBe(inv._id.toString());
  });
});

// --- POST /api/invoices/confirm-payment-session -----------------------------

describe('POST /api/invoices/confirm-payment-session', () => {
  it('returns 400 when sessionId missing', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects unpaid stripe session', async () => {
    const a = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({ payment_status: 'unpaid' });
    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_unpaid' });
    expect(res.status).toBe(400);
  });

  it('rejects when stripe metadata is invalid', async () => {
    const a = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { phase: 'upfront' }, // missing invoiceId
    });
    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_meta' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when invoice id from metadata is unknown', async () => {
    const a = await createArtisan();
    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { invoiceId: new mongoose.Types.ObjectId().toString(), phase: 'upfront' },
    });
    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_unknown' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the invoice owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const inv = await seedInvoice(other, project);
    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { invoiceId: inv._id.toString(), phase: 'upfront' },
    });
    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_x' });
    expect(res.status).toBe(403);
  });

  it('confirms upfront tranche, schedules a notification and updates progress to 50', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);

    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { invoiceId: inv._id.toString(), phase: 'upfront' },
    });

    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_up_1' });

    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentPlan.firstTranchePaid).toBe(true);
    expect(refreshed.paidAmount).toBe(500);
    expect(refreshed.paymentProgress).toBe(50);
    expect(refreshed.status).toBe('pending');
    expect(refreshed.paymentSessions).toHaveLength(1);

    const notif = await Notification.findOne({ type: 'invoice_second_tranche_due' });
    expect(notif).toBeTruthy();
  });

  it('confirms completion tranche, marks invoice paid and notifies completion', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paidAmount: 500,
      paymentProgress: 50,
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });

    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { invoiceId: inv._id.toString(), phase: 'completion' },
    });

    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_comp_1' });

    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.status).toBe('paid');
    expect(refreshed.paymentPlan.secondTranchePaid).toBe(true);
    expect(refreshed.paymentProgress).toBe(100);

    const notif = await Notification.findOne({ type: 'invoice_payment_completed' });
    expect(notif).toBeTruthy();
  });

  it('is idempotent on duplicate confirm with the same sessionId', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paymentSessions: [{ sessionId: 'cs_dup', phase: 'upfront', amount: 500, paidAt: new Date() }],
    });

    stripeRetrieveMock.mockResolvedValueOnce({
      payment_status: 'paid',
      metadata: { invoiceId: inv._id.toString(), phase: 'upfront' },
    });

    const res = await request(app)
      .post('/api/invoices/confirm-payment-session')
      .set(authHeader(a))
      .send({ sessionId: 'cs_dup' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already processed/i);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentSessions).toHaveLength(1);
  });
});

// --- PATCH /api/invoices/:id/mark-tranche-paid ------------------------------

describe('PATCH /api/invoices/:id/mark-tranche-paid', () => {
  it('returns 404 when invoice does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .patch(`/api/invoices/${new mongoose.Types.ObjectId()}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const inv = await seedInvoice(other, project);
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid phase', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'middle' });
    expect(res.status).toBe(400);
  });

  it('rejects upfront when already paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(400);
  });

  it('rejects completion before upfront is confirmed', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(400);
  });

  it('marks upfront paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentPlan.firstTranchePaid).toBe(true);
    expect(refreshed.paidAmount).toBe(500);
  });

  it('marks completion paid and the invoice fully paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paidAmount: 500,
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/mark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentPlan.secondTranchePaid).toBe(true);
    expect(refreshed.status).toBe('paid');
    expect(refreshed.paymentProgress).toBe(100);
  });
});

// --- PATCH /api/invoices/:id/unmark-tranche-paid ----------------------------

describe('PATCH /api/invoices/:id/unmark-tranche-paid', () => {
  it('rejects unmark on un-paid upfront', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/unmark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not marked as paid/i);
  });

  it('rejects upfront unmark while completion is already received', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paidAmount: 1000,
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: true,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/unmark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancel completion first/i);
  });

  it('unmarks upfront tranche and decrements paidAmount', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paidAmount: 500,
      paymentProgress: 50,
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/unmark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'upfront' });
    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentPlan.firstTranchePaid).toBe(false);
    expect(refreshed.paidAmount).toBe(0);
    expect(refreshed.status).toBe('pending');
  });

  it('unmarks completion tranche', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paidAmount: 1000,
      paymentProgress: 100,
      status: 'paid',
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: true,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/unmark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(200);
    const refreshed = await Invoice.findById(inv._id);
    expect(refreshed.paymentPlan.secondTranchePaid).toBe(false);
    expect(refreshed.status).toBe('pending');
    expect(refreshed.paidAmount).toBe(500);
  });

  it('rejects unmark completion when not paid', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project, {
      paymentPlan: {
        firstTranchePercent: 50, secondTranchePercent: 50,
        firstTrancheAmount: 500, secondTrancheAmount: 500,
        firstTranchePaid: true, secondTranchePaid: false,
      },
    });
    const res = await request(app)
      .patch(`/api/invoices/${inv._id}/unmark-tranche-paid`)
      .set(authHeader(a))
      .send({ phase: 'completion' });
    expect(res.status).toBe(400);
  });
});

// --- DELETE /api/invoices/:id -----------------------------------------------

describe('DELETE /api/invoices/:id', () => {
  it('returns 404 when invoice does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .delete(`/api/invoices/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(a));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const inv = await seedInvoice(other, project);
    const res = await request(app).delete(`/api/invoices/${inv._id}`).set(authHeader(a));
    expect(res.status).toBe(403);
  });

  it('deletes when caller is the owner', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const inv = await seedInvoice(a, project);
    const res = await request(app).delete(`/api/invoices/${inv._id}`).set(authHeader(a));
    expect(res.status).toBe(200);
    expect(await Invoice.findById(inv._id)).toBeNull();
  });
});

// --- GET /api/invoices/:id/pdf (graceful fail) ------------------------------

describe('GET /api/invoices/:id/pdf', () => {
  it('returns 404 when invoice does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .get(`/api/invoices/${new mongoose.Types.ObjectId()}/pdf`)
      .set(authHeader(a));
    expect(res.status).toBe(404);
  });
});
