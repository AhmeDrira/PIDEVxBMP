const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let app;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.ADMIN_SECRET_KEY = 'adminsecret';
  process.env.APP_URL = 'http://localhost:3000';
  global.fetch = async () => ({ ok: true, text: async () => 'ok' });
  app = require('../app');
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

test('register artisan and login', async () => {
  const reg = await request(app).post('/api/auth/register').send({
    firstName: 'A',
    lastName: 'B',
    email: 'a@example.com',
    phone: '12345678',
    password: 'password123',
    role: 'artisan',
    location: 'City',
    domain: 'Plumbing',
  });
  expect(reg.status).toBe(201);
  const login = await request(app).post('/api/auth/login').send({
    email: 'a@example.com',
    password: 'password123',
  });
  expect(login.status).toBe(200);
  expect(login.body.token).toBeTruthy();
});

test('admin secret login and access me', async () => {
  const login = await request(app).post('/api/auth/admin/login').send({
    secretKey: 'adminsecret',
  });
  expect(login.status).toBe(200);
  const token = login.body.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(me.status).toBe(200);
  expect(me.body.role).toBe('admin');
});

test('forgot and reset password', async () => {
  await request(app).post('/api/auth/register').send({
    firstName: 'U',
    lastName: 'S',
    email: 'user@example.com',
    phone: '12345678',
    password: 'oldpass123',
    role: 'expert',
    domain: 'Structural',
  });
  const forgot = await request(app).post('/api/auth/forgot').send({ email: 'user@example.com' });
  expect(forgot.status).toBe(200);
  const { User } = require('../models/User');
  const user = await User.findOne({ email: 'user@example.com' }).select('+resetPasswordToken +resetPasswordExpires');
  expect(user.resetPasswordToken).toBeTruthy();
  const plain = 'mocktoken';
  const crypto = require('crypto');
  user.resetPasswordToken = crypto.createHash('sha256').update(plain).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const reset = await request(app).post('/api/auth/reset').send({ token: plain, password: 'newpass123' });
  expect(reset.status).toBe(200);
  const login = await request(app).post('/api/auth/login').send({
    email: 'user@example.com',
    password: 'newpass123',
  });
  expect(login.status).toBe(200);
});
