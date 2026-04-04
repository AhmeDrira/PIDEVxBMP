/**
 * Integration tests — Recommendation API
 * Run: npx jest tests/recommendationApi.test.js
 */

const request  = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongod;
let artisanToken;
let otherToken;
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

async function registerAndLogin(email, role = 'artisan') {
  await request(app)
    .post('/api/auth/register')
    .send({ firstName: 'Test', lastName: 'User', email, password: 'Password1!', role });

  // Manually verify the user in DB
  const { User } = require('../models/User');
  await User.findOneAndUpdate({ email }, { isVerified: true });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password1!' });

  return res.body.token;
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

async function createProduct() {
  const Product = require('../models/Product');
  const { User } = require('../models/User');
  const mfr = await User.findOne({ role: 'artisan' }); // reuse artisan as manufacturer stub
  const product = await Product.create({
    name: 'Béton C25 sac 35kg',
    category: 'Béton',
    description: 'Béton résistant fondation extérieur',
    price: 28,
    stock: 100,
    status: 'active',
    manufacturer: mfr._id,
    rating: 4.1,
    numReviews: 20,
  });
  return product._id;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Clear collections
  const { User }   = require('../models/User');
  const Product    = require('../models/Product');
  const Project    = require('../models/Project');
  await User.deleteMany({});
  await Product.deleteMany({});
  await Project.deleteMany({});

  artisanToken = await registerAndLogin('artisan@test.com', 'artisan');
  otherToken   = await registerAndLogin('other@test.com',   'artisan');
  projectId    = await createProject(artisanToken);
  productId    = await createProduct();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/projects/:projectId/material-recommendations', () => {
  test('returns 200 with ranked recommendations', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton fondation', quantity: 10, budget: 1000, deadlineDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.projectId).toBe(projectId);
  });

  test('recommendations are sorted descending by totalScore', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton', quantity: 5, budget: 500 });

    const scores = res.body.recommendations.map((r) => r.totalScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('each recommendation has required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton', quantity: 5, budget: 500 });

    const rec = res.body.recommendations[0];
    if (rec) {
      expect(rec).toHaveProperty('productId');
      expect(rec).toHaveProperty('totalScore');
      expect(rec).toHaveProperty('scoreBreakdown');
      expect(rec).toHaveProperty('reasons');
      expect(rec).toHaveProperty('pdfInsights');
      expect(rec).toHaveProperty('pricingSummary');
      expect(rec).toHaveProperty('stockSummary');
      expect(rec.scoreBreakdown).toHaveProperty('besoin');
      expect(rec.scoreBreakdown).toHaveProperty('budget');
      expect(rec.scoreBreakdown).toHaveProperty('dispoDelai');
      expect(rec.scoreBreakdown).toHaveProperty('fiabilite');
      expect(rec.scoreBreakdown).toHaveProperty('pdf');
    }
  });

  test('401 without authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .send({ nature: 'béton', quantity: 5 });

    expect(res.status).toBe(401);
  });

  test('403 when project belongs to different artisan', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ nature: 'béton', quantity: 5 });

    expect(res.status).toBe(403);
  });

  test('404 for non-existent project', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/projects/${fakeId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton', quantity: 5 });

    expect(res.status).toBe(404);
  });

  test('400 if nature is missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(400);
  });

  test('400 if quantity is zero or missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton', quantity: 0 });

    expect(res.status).toBe(400);
  });

  test('respects maxResults parameter', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-recommendations`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ nature: 'béton', quantity: 5, maxResults: 2 });

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
