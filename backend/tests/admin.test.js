const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let app;
let mongod;
let adminToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.APP_URL = 'http://localhost:3000';
  global.fetch = async () => ({ ok: true, text: async () => 'ok' });
  app = require('../app');
  await request(app).post('/api/auth/admin/create').send({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    phone: '11111111',
    password: 'password123',
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'password123',
  });
  adminToken = login.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

test('manufacturer pending/approve/reject', async () => {
  const reg = await request(app).post('/api/auth/register').send({
    firstName: 'M',
    lastName: 'F',
    email: 'manu@example.com',
    phone: '22222222',
    password: 'password123',
    role: 'manufacturer',
    companyName: 'Co',
  });
  expect(reg.status).toBe(201);
  const list = await request(app).get('/api/auth/admin/manufacturers/pending').set('Authorization', `Bearer ${adminToken}`);
  expect(list.status).toBe(200);
  const id = list.body[0]._id;
  const approve = await request(app).post(`/api/auth/admin/manufacturers/${id}/approve`).set('Authorization', `Bearer ${adminToken}`);
  expect(approve.status).toBe(200);
  const list2 = await request(app).get('/api/auth/admin/manufacturers/pending').set('Authorization', `Bearer ${adminToken}`);
  expect(list2.body.length).toBe(0);
});

test('user list/suspend/activate/delete', async () => {
  const reg = await request(app).post('/api/auth/register').send({
    firstName: 'U',
    lastName: 'S',
    email: 'u@example.com',
    phone: '33333333',
    password: 'password123',
    role: 'artisan',
    location: 'City',
    domain: 'Plumbing',
  });
  expect(reg.status).toBe(201);
  const users = await request(app).get('/api/auth/admin/users').set('Authorization', `Bearer ${adminToken}`);
  expect(users.status).toBe(200);
  const u = users.body.find(x => x.email === 'u@example.com');
  const susp = await request(app).post(`/api/auth/admin/users/${u._id}/suspend`).set('Authorization', `Bearer ${adminToken}`);
  expect(susp.status).toBe(200);
  const act = await request(app).post(`/api/auth/admin/users/${u._id}/activate`).set('Authorization', `Bearer ${adminToken}`);
  expect(act.status).toBe(200);
  const del = await request(app).delete(`/api/auth/admin/users/${u._id}`).set('Authorization', `Bearer ${adminToken}`);
  expect(del.status).toBe(200);
});
