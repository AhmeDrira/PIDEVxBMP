/**
 * Integration tests — Recommendation API
 * Run: npx jest tests/recommendationApi.test.js
 *
 * Endpoint contract (current):
 *   POST /api/projects/:projectId/material-recommendations
 *   Body: { surface, unit, category, budget, ...optional }
 *   Response: { projectId, recommendations: [{ productId, scores: {...}, pdfInsights, pricingSummary, stockSummary, ... }] }
 */

const request  = require('supertest');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongod;
let artisanToken;
let otherToken;
let artisanId;
let projectId;
let productId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.APP_URL = 'http://localhost:3000';
  global.fetch = async () => ({ ok: true, text: async () => 'ok' });
  app = require('../app');
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// Bypass /api/auth/register + /api/auth/login (the latter is rate-limited at
// 10 req / 15 min per IP — beforeEach would burn that quota by test #5).
// We create the user directly and sign a JWT that matches what the real
// loginUser controller would have produced.
async function createArtisanAndSignToken(email) {
  const { Artisan } = require('../models/User');
  const user = await Artisan.create({
    firstName: 'Test',
    lastName: 'User',
    email,
    password: 'Password1!',
    role: 'artisan',
    isVerified: true,
    location: '',
    domain: '',
  });
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });
  return { user, token };
}

async function createProject(token) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Test Project',
      description: 'Foundation work',
      location: 'Tunis',
      budget: 5000,
      startDate: '2026-05-01',
      endDate: '2026-09-01',
    });
  return res.body._id;
}

async function createProduct(manufacturerId) {
  const Product = require('../models/Product');
  const product = await Product.create({
    name: 'Béton C25 sac 35kg',
    category: 'Béton',
    description: 'Béton résistant fondation extérieur',
    price: 28,
    stock: 100,
    status: 'active',
    manufacturer: manufacturerId,
    rating: 4.1,
    numReviews: 20,
  });
  return product._id;
}

// Default valid body for the new contract
const validBody = (overrides = {}) => ({
  surface: 10,
  unit: 'm²',
  category: 'Béton',
  budget: 5000,
  ...overrides,
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Clear collections
  const { User } = require('../models/User');
  const Product  = require('../models/Product');
  const Project  = require('../models/Project');
  await User.deleteMany({});
  await Product.deleteMany({});
  await Project.deleteMany({});

  const artisan = await createArtisanAndSignToken('artisan@test.com');
  const other   = await createArtisanAndSignToken('other@test.com');
  artisanToken = artisan.token;
  otherToken   = other.token;
  artisanId    = artisan.user._id;
  projectId    = await createProject(artisanToken);
  productId    = await createProduct(artisanId);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/projects/:projectId/material-recommendations', () => {
  test('returns 200 with ranked recommendations', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.projectId).toBe(projectId);
  });

  test('recommendations are sorted descending by ranking score', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody({ surface: 5, budget: 500 }));

    expect(res.status).toBe(200);
    const recs = res.body.recommendations || [];
    const scores = recs.map((r) => (r.scores?.rankingTotal ?? r.scores?.total));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('each recommendation has required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody({ surface: 5, budget: 500 }));

    expect(res.status).toBe(200);
    const rec = (res.body.recommendations || [])[0];
    if (rec) {
      expect(rec).toHaveProperty('productId');
      expect(rec).toHaveProperty('scores');
      expect(rec).toHaveProperty('pdfInsights');
      expect(rec).toHaveProperty('pricingSummary');
      expect(rec).toHaveProperty('stockSummary');
      expect(rec).toHaveProperty('explainableAI');
      expect(rec.scores).toHaveProperty('total');
      expect(rec.scores).toHaveProperty('compatibilite');
      expect(rec.scores).toHaveProperty('budget');
      expect(rec.scores).toHaveProperty('contrainte');
      expect(rec.scores).toHaveProperty('fiabilite');
      expect(rec.scores).toHaveProperty('pdf');
    }
  });

  test('401 without authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .send(validBody());

    expect(res.status).toBe(401);
  });

  test('403 when project belongs to different artisan', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send(validBody());

    expect(res.status).toBe(403);
  });

  test('404 for non-existent project', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/projects/${fakeId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody());

    expect(res.status).toBe(404);
  });

  test('400 if category is missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody({ category: undefined }));

    expect(res.status).toBe(400);
  });

  test('400 if surface is zero or missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody({ surface: 0 }));

    expect(res.status).toBe(400);
  });

  test('respects maxResults parameter', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send(validBody({ maxResults: 2 }));

    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(2);
  });

  test('existing project Add Material flow still works (non-regression)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ materials: [productId.toString()] });

    expect(res.status).toBe(200);
    expect(res.body.materials).toBeDefined();
  });
});
