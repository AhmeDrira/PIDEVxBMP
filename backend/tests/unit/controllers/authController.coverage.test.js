const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { User } = require('../../../models/User');

describe('AuthController - Tests de couverture', () => {
  let app;
  let mongod;

  beforeAll(async () => {
    jest.setTimeout(60000);

    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-auth-tests';
    process.env.APP_URL = 'http://localhost:3000';

    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();

    app = require('../../../app');
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('POST /api/auth/register - 400 si email deja utilise', async () => {
    await User.create({
      firstName: 'Existing',
      lastName: 'User',
      email: 'existing@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'New',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123',
        role: 'user',
      });

    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - 401 si mot de passe incorrect', async () => {
    await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      isVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - 401 si email inexistant', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/verify-email - 400 si token invalide', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
  });

  test('POST /api/auth/forgot - 200 si email existe', async () => {
    await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'reset@example.com',
      password: 'password123',
      isVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'reset@example.com' });

    expect(res.status).toBe(200);
  });

  test('POST /api/auth/forgot - 200 si email inexistant', async () => {
    const res = await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
  });

  test('POST /api/auth/reset - 400 si token invalide', async () => {
    const res = await request(app)
      .post('/api/auth/reset')
      .send({
        token: 'invalid-token',
        password: 'newpassword123',
      });

    expect(res.status).toBe(400);
  });

  test('GET /api/auth/check-email - 200 avec email disponible', async () => {
    const res = await request(app)
      .get('/api/auth/check-email')
      .query({ email: 'new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  test('GET /api/auth/check-email - 400 si email manquant', async () => {
    const res = await request(app)
      .get('/api/auth/check-email');

    expect(res.status).toBe(400);
  });
});