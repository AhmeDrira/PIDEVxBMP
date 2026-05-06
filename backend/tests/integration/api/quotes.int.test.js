/**
 * Integration tests for quoteController via /api/quotes.
 * The AI draft service is mocked so the test stays deterministic and doesn't pull in ML history.
 */

jest.setTimeout(60000);

jest.mock('../../../services/quoteAIDraftService', () => ({
  generateQuoteAIDraft: jest.fn(async () => ({
    suggested: { laborHand: 100, materialsAmount: 200, total: 300 },
    confidence: 0.9,
    description: 'AI generated quote draft',
  })),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.NODE_ENV = 'test';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildQuoteApp } = require('../helpers/buildQuoteApp');
const { createArtisan, authHeader } = require('../helpers/auth.helpers');

const Quote = require('../../../models/Quote');
const Project = require('../../../models/Project');
const Invoice = require('../../../models/Invoice');
// Required so Mongoose registers schemas referenced via .populate('materials')
require('../../../models/Product');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildQuoteApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

const seedProject = async (artisan, overrides = {}) =>
  Project.create({
    title: 'Bathroom Renovation',
    description: 'Demo',
    location: 'Tunis',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 86400000),
    status: 'active',
    artisan: artisan._id,
    progress: 0,
    ...overrides,
  });

const validQuotePayload = (project) => ({
  project: project._id.toString(),
  clientName: 'Mr. Client',
  laborHand: 200,
  materialsAmount: 500,
  description: 'Bathroom renovation work',
  validUntil: new Date(Date.now() + 14 * 86400000).toISOString(),
  paymentTerms: '50% upfront',
  upfrontPercent: 60,
});

// --- POST /api/quotes (create) ----------------------------------------------

describe('POST /api/quotes', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/quotes').send({});
    expect(res.status).toBe(401);
  });

  it('creates a quote with computed amount and unique number', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);

    const res = await request(app).post('/api/quotes').set(authHeader(a)).send(validQuotePayload(project));
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(700);
    expect(res.body.quoteNumber).toMatch(/^QT-\d{4}-\d{4}$/);
    expect(res.body.upfrontPercent).toBe(60);
  });

  it('returns 400 when required fields are missing', async () => {
    const a = await createArtisan();
    const res = await request(app).post('/api/quotes').set(authHeader(a)).send({ clientName: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative labor hand', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const payload = validQuotePayload(project);
    payload.laborHand = -10;
    const res = await request(app).post('/api/quotes').set(authHeader(a)).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/labor/i);
  });

  it('returns 400 for non-finite materials amount', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const payload = validQuotePayload(project);
    payload.materialsAmount = 'banana';
    const res = await request(app).post('/api/quotes').set(authHeader(a)).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/materials/i);
  });

  it('returns 400 when total amount is 0', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const payload = validQuotePayload(project);
    payload.laborHand = 0;
    payload.materialsAmount = 0;
    const res = await request(app).post('/api/quotes').set(authHeader(a)).send(payload);
    expect(res.status).toBe(400);
  });

  it('clamps invalid upfrontPercent to default 50', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const payload = validQuotePayload(project);
    payload.upfrontPercent = 999;
    const res = await request(app).post('/api/quotes').set(authHeader(a)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.upfrontPercent).toBe(50);
  });
});

// --- GET /api/quotes ---------------------------------------------------------

describe('GET /api/quotes', () => {
  it('returns only the artisans own quotes with hasInvoice flag', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(a);
    const otherProject = await seedProject(other);

    const q1 = await Quote.create({
      quoteNumber: 'QT-1', project: project._id, artisan: a._id,
      clientName: 'A', laborHand: 100, materialsAmount: 50, amount: 150,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    await Quote.create({
      quoteNumber: 'QT-2', project: project._id, artisan: a._id,
      clientName: 'B', laborHand: 100, materialsAmount: 50, amount: 150,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    await Quote.create({
      quoteNumber: 'QT-3', project: otherProject._id, artisan: other._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });

    await Invoice.create({
      invoiceNumber: 'INV-1', quote: q1._id, project: project._id, artisan: a._id,
      clientName: 'A', amount: 150, description: 'd',
      issueDate: new Date(), dueDate: new Date(Date.now() + 7 * 86400000), status: 'pending',
    });

    const res = await request(app).get('/api/quotes').set(authHeader(a));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const withInv = res.body.find((q) => q.quoteNumber === 'QT-1');
    const noInv = res.body.find((q) => q.quoteNumber === 'QT-2');
    expect(withInv.hasInvoice).toBe(true);
    expect(noInv.hasInvoice).toBe(false);
  });
});

// --- POST /api/quotes/ai-draft ----------------------------------------------

describe('POST /api/quotes/ai-draft', () => {
  it('returns 400 when projectId is invalid', async () => {
    const a = await createArtisan();
    const res = await request(app).post('/api/quotes/ai-draft').set(authHeader(a)).send({ projectId: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project does not belong to the artisan', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const res = await request(app)
      .post('/api/quotes/ai-draft')
      .set(authHeader(a))
      .send({ projectId: project._id.toString() });
    expect(res.status).toBe(404);
  });

  it('rejects when the project is already completed', async () => {
    const a = await createArtisan();
    const project = await seedProject(a, { status: 'completed', progress: 100 });
    const res = await request(app)
      .post('/api/quotes/ai-draft')
      .set(authHeader(a))
      .send({ projectId: project._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/completed/i);
  });

  it('returns the AI draft for a valid project', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const res = await request(app)
      .post('/api/quotes/ai-draft')
      .set(authHeader(a))
      .send({ projectId: project._id.toString(), clientName: 'Cust' });
    expect(res.status).toBe(200);
    expect(res.body.suggested.total).toBe(300);
  });
});

// --- PUT /api/quotes/:id/status ---------------------------------------------

describe('PUT /api/quotes/:id/status', () => {
  it('rejects invalid quote id', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .put('/api/quotes/not-an-id/status')
      .set(authHeader(a))
      .send({ status: 'approved' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status value', async () => {
    const a = await createArtisan();
    const id = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/quotes/${id}/status`)
      .set(authHeader(a))
      .send({ status: 'gibberish' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the quote does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .put(`/api/quotes/${new mongoose.Types.ObjectId()}/status`)
      .set(authHeader(a))
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the quote owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const q = await Quote.create({
      quoteNumber: 'QT-X', project: project._id, artisan: other._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app)
      .put(`/api/quotes/${q._id}/status`)
      .set(authHeader(a))
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  it('updates the quote status when caller is the owner', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const q = await Quote.create({
      quoteNumber: 'QT-Y', project: project._id, artisan: a._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app)
      .put(`/api/quotes/${q._id}/status`)
      .set(authHeader(a))
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });
});

// --- DELETE /api/quotes/:id --------------------------------------------------

describe('DELETE /api/quotes/:id', () => {
  it('returns 404 when quote does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .delete(`/api/quotes/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(a));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const q = await Quote.create({
      quoteNumber: 'QT-D1', project: project._id, artisan: other._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app).delete(`/api/quotes/${q._id}`).set(authHeader(a));
    expect(res.status).toBe(403);
  });

  it('refuses when quote is linked to an invoice', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const q = await Quote.create({
      quoteNumber: 'QT-D2', project: project._id, artisan: a._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    await Invoice.create({
      invoiceNumber: 'INV-D1', quote: q._id, project: project._id, artisan: a._id,
      clientName: 'C', amount: 2, description: 'd',
      issueDate: new Date(), dueDate: new Date(Date.now() + 7 * 86400000), status: 'pending',
    });
    const res = await request(app).delete(`/api/quotes/${q._id}`).set(authHeader(a));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/linked to invoice/i);
  });

  it('deletes a stand-alone quote', async () => {
    const a = await createArtisan();
    const project = await seedProject(a);
    const q = await Quote.create({
      quoteNumber: 'QT-D3', project: project._id, artisan: a._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app).delete(`/api/quotes/${q._id}`).set(authHeader(a));
    expect(res.status).toBe(200);
    const remaining = await Quote.findById(q._id);
    expect(remaining).toBeNull();
  });
});

// --- GET /api/quotes/:id/pdf (graceful fail) --------------------------------

describe('GET /api/quotes/:id/pdf', () => {
  it('returns 404 when quote does not exist', async () => {
    const a = await createArtisan();
    const res = await request(app)
      .get(`/api/quotes/${new mongoose.Types.ObjectId()}/pdf`)
      .set(authHeader(a));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the quote owner', async () => {
    const a = await createArtisan();
    const other = await createArtisan();
    const project = await seedProject(other);
    const q = await Quote.create({
      quoteNumber: 'QT-PDF', project: project._id, artisan: other._id,
      clientName: 'C', laborHand: 1, materialsAmount: 1, amount: 2,
      description: 'd', validUntil: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app)
      .get(`/api/quotes/${q._id}/pdf`)
      .set(authHeader(a));
    expect(res.status).toBe(403);
  });
});
