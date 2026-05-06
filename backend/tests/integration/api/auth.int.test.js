/**
 * Integration tests for authController via the /api/auth router.
 *
 * Strategy:
 *   - Real Mongo (mongodb-memory-server) → exercises models, hooks, indexes.
 *   - All external services mocked at module level BEFORE requiring routes:
 *       nodemailer, axios (Google userinfo), google-auth-library, express-rate-limit.
 *   - The routes file is required after mocks so the controller picks up mocks.
 *
 * Reuse this file as a template for other controller integration tests:
 *   1. Replicate the jest.mock(...) block (adapt external deps).
 *   2. Build a buildXxxApp.js helper that mounts only the routes you need.
 *   3. Use startTestDb / stopTestDb / clearTestDb for an isolated in-memory DB.
 */

jest.setTimeout(60000);

// Disable rate limiting in tests (otherwise repeated /login hits the limiter).
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

// Stub nodemailer — never actually send mail.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-mail' }),
  })),
}));

// Stub axios so any Google userinfo call is deterministic.
jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');

// Stub google-auth-library OAuth2Client.
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

// Spy on actionLogger to keep the DB clean of audit writes.
jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-test-secret';
process.env.NODE_ENV = 'test';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildAuthApp } = require('../helpers/buildAuthApp');
const { Artisan, Expert, Manufacturer, Admin, User } = require('../../../models/User');
const Notification = require('../../../models/Notification');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildAuthApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
  axios.get.mockReset();
});

const signTokenFor = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

const createArtisan = async (overrides = {}) =>
  Artisan.create({
    firstName: 'Alice',
    lastName: 'Tester',
    email: 'alice@example.com',
    password: 'Password123!',
    role: 'artisan',
    isVerified: true,
    location: '',
    domain: '',
    ...overrides,
  });

describe('POST /api/auth/register', () => {
  it('creates an artisan and returns 201 with public profile fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Reg',
      lastName: 'User',
      email: 'reg@example.com',
      password: 'Password123!',
      role: 'artisan',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'reg@example.com',
      firstName: 'Reg',
      role: 'artisan',
    });
    expect(res.body).not.toHaveProperty('password');

    const created = await User.findOne({ email: 'reg@example.com' });
    expect(created).toBeTruthy();
    expect(created.isVerified).toBe(false);

    const subscriptionNotif = await Notification.findOne({
      type: 'subscription_required',
      recipient: created._id,
    });
    expect(subscriptionNotif).toBeTruthy();
  });

  it('creates a manufacturer awaiting verification and notifies admins', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Mfr',
      lastName: 'Co',
      email: 'mfr@example.com',
      password: 'Password123!',
      role: 'manufacturer',
    });

    expect(res.status).toBe(201);
    const notif = await Notification.findOne({ type: 'manufacturer_registration' });
    expect(notif).toBeTruthy();
  });

  it('rejects when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'partial@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('rejects an admin self-registration attempt', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Hax',
      lastName: 'Admin',
      email: 'hax@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'X',
      lastName: 'Y',
      email: 'xy@example.com',
      password: 'Password123!',
      role: 'wizard',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid role/i);
  });

  it('rejects a duplicate email', async () => {
    await createArtisan({ email: 'dup@example.com' });
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Dup',
      lastName: 'Two',
      email: 'dup@example.com',
      password: 'Password123!',
      role: 'artisan',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already in use/i);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 + token for valid credentials on a verified user', async () => {
    await createArtisan({ email: 'login@example.com', password: 'Password123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.email).toBe('login@example.com');
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 400 when email or password missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    await createArtisan({ email: 'badpw@example.com', password: 'Password123!' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'badpw@example.com', password: 'WrongOne!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password123!' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not verified', async () => {
    await createArtisan({
      email: 'unverified@example.com',
      password: 'Password123!',
      isVerified: false,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unverified@example.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.notVerified).toBe(true);
  });

  it('returns 403 when manufacturer is awaiting verification', async () => {
    await Manufacturer.create({
      firstName: 'M',
      lastName: 'F',
      email: 'pending@example.com',
      password: 'Password123!',
      role: 'manufacturer',
      isVerified: true,
      verificationStatus: 'pending',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pending@example.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.isPendingManufacturer).toBe(true);
  });

  it('returns 403 when account is suspended', async () => {
    await createArtisan({
      email: 'suspended@example.com',
      password: 'Password123!',
      status: 'suspended',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'suspended@example.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
  });
});

describe('POST /api/auth/admin/login', () => {
  it('returns 200 with super-admin payload when secret is correct', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ secretKey: process.env.ADMIN_SECRET_KEY });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'admin',
      isSuperAdmin: true,
      adminType: 'super',
    });
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('returns 400 when secret missing', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ secretKey: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/check-email', () => {
  it('reports available:true for unused email', async () => {
    const res = await request(app)
      .get('/api/auth/check-email')
      .query({ email: 'free@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it('reports available:false for used email (case-insensitive)', async () => {
    await createArtisan({ email: 'taken@example.com' });
    const res = await request(app)
      .get('/api/auth/check-email')
      .query({ email: 'TAKEN@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('returns 400 when email param missing', async () => {
    const res = await request(app).get('/api/auth/check-email');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/check-phone', () => {
  it('reports availability based on stored phone', async () => {
    await createArtisan({ email: 'p1@example.com', phone: '20111222' });
    const taken = await request(app)
      .get('/api/auth/check-phone')
      .query({ phone: '20111222' });
    expect(taken.body.available).toBe(false);

    const free = await request(app)
      .get('/api/auth/check-phone')
      .query({ phone: '99887766' });
    expect(free.body.available).toBe(true);
  });

  it('returns 400 when phone missing', async () => {
    const res = await request(app).get('/api/auth/check-phone');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot', () => {
  it('always returns a generic success message (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if/i);
  });

  it('stores a reset token on the user when email exists', async () => {
    const u = await createArtisan({ email: 'reset-me@example.com' });
    await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'reset-me@example.com' });

    const refreshed = await User.findById(u._id).select('+resetPasswordToken +resetPasswordExpires');
    expect(refreshed.resetPasswordToken).toBeTruthy();
    expect(refreshed.resetPasswordExpires).toBeTruthy();
  });
});

describe('POST /api/auth/reset', () => {
  it('resets the password when token + email are valid', async () => {
    const user = await createArtisan({ email: 'pwreset@example.com' });
    const rawToken = crypto.randomBytes(20).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const res = await request(app)
      .post('/api/auth/reset')
      .send({
        email: 'pwreset@example.com',
        token: rawToken,
        password: 'NewPassword123!',
      });

    expect(res.status).toBe(200);

    // confirm the new password actually works for login
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pwreset@example.com', password: 'NewPassword123!' });
    expect(login.status).toBe(200);
  });

  it('rejects an invalid or expired token', async () => {
    await createArtisan({ email: 'badtoken@example.com' });
    const res = await request(app)
      .post('/api/auth/reset')
      .send({
        email: 'badtoken@example.com',
        token: 'definitely-not-real',
        password: 'Whatever123!',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('marks the user as verified when token matches', async () => {
    const user = await createArtisan({ email: 'verify@example.com', isVerified: false });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.verificationToken = hash;
    user.verificationTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    const refreshed = await User.findById(user._id);
    expect(refreshed.isVerified).toBe(true);
  });

  it('returns 400 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me (protected)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns the current user when token is valid', async () => {
    const u = await createArtisan({ email: 'me@example.com' });
    const token = signTokenFor(u);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });
});

describe('POST /api/auth/google', () => {
  it('returns 400 when credential is missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('creates a new artisan from a fresh Google account', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        email: 'newgoogle@example.com',
        given_name: 'Goog',
        family_name: 'Le',
        name: 'Goog Le',
        picture: 'http://img/p.png',
      },
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-token', role: 'artisan' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.email).toBe('newgoogle@example.com');

    const persisted = await User.findOne({ email: 'newgoogle@example.com' });
    expect(persisted).toBeTruthy();
    expect(persisted.role).toBe('artisan');
  });

  it('logs in an existing user found by email', async () => {
    await createArtisan({ email: 'returning@example.com' });
    axios.get.mockResolvedValueOnce({
      data: { email: 'returning@example.com', name: 'Ret Urn' },
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake-token' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('returning@example.com');
  });

  it('returns 401 when Google rejects the credential', async () => {
    axios.get.mockRejectedValueOnce(new Error('invalid token'));
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'bad' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/admin/subadmins', () => {
  it('rejects without admin secret', async () => {
    const res = await request(app)
      .post('/api/auth/admin/subadmins')
      .send({
        secretKey: 'nope',
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub@example.com',
        password: 'Password123!',
      });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing even with valid secret', async () => {
    const res = await request(app)
      .post('/api/auth/admin/subadmins')
      .send({ secretKey: process.env.ADMIN_SECRET_KEY });
    expect(res.status).toBe(400);
  });

  it('creates a sub-admin and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/admin/subadmins')
      .send({
        secretKey: process.env.ADMIN_SECRET_KEY,
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub@example.com',
        password: 'Password123!',
        permissions: { canManageKnowledge: true },
      });

    expect(res.status).toBe(201);
    expect(res.body.admin.email).toBe('sub@example.com');
    expect(res.body.admin.permissions.canManageKnowledge).toBe(true);
    expect(res.body.admin.permissions.canDeleteUsers).toBe(false);

    const persisted = await User.findOne({ email: 'sub@example.com' });
    expect(persisted.role).toBe('admin');
    expect(persisted.adminType).toBe('sub');
  });

  it('rejects when sub-admin email already exists', async () => {
    await Admin.create({
      firstName: 'Pre',
      lastName: 'Existing',
      email: 'preexist@example.com',
      password: 'Password123!',
      role: 'admin',
      adminType: 'sub',
      isVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/admin/subadmins')
      .send({
        secretKey: process.env.ADMIN_SECRET_KEY,
        firstName: 'Sub',
        lastName: 'Two',
        email: 'preexist@example.com',
        password: 'Password123!',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/face-login', () => {
  it('returns 400 for invalid descriptor shape', async () => {
    const res = await request(app)
      .post('/api/auth/face-login')
      .send({ descriptor: [1, 2, 3] });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no users have a registered face', async () => {
    const res = await request(app)
      .post('/api/auth/face-login')
      .send({ descriptor: new Array(128).fill(0) });
    expect(res.status).toBe(404);
    expect(res.body.noFace).toBe(true);
  });

  it('matches the registered user with a close descriptor', async () => {
    const desc = new Array(128).fill(0).map((_, i) => i / 1000);
    await createArtisan({ email: 'face@example.com', faceDescriptor: desc });

    const res = await request(app)
      .post('/api/auth/face-login')
      .send({ descriptor: desc });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('face@example.com');
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('returns 401 when no user is close enough', async () => {
    const stored = new Array(128).fill(0);
    const probe = new Array(128).fill(1);
    await createArtisan({ email: 'far@example.com', faceDescriptor: stored });

    const res = await request(app)
      .post('/api/auth/face-login')
      .send({ descriptor: probe });
    expect(res.status).toBe(401);
  });
});

describe('Face descriptor (protected)', () => {
  it('returns false when user has no descriptor', async () => {
    const u = await createArtisan({ email: 'nface@example.com' });
    const res = await request(app)
      .get('/api/auth/face-descriptor/status')
      .set('Authorization', `Bearer ${signTokenFor(u)}`);
    expect(res.status).toBe(200);
    expect(res.body.hasFaceDescriptor).toBe(false);
  });

  it('saves and then deletes the descriptor', async () => {
    const u = await createArtisan({ email: 'fset@example.com' });
    const desc = new Array(128).fill(0.1);

    const save = await request(app)
      .post('/api/auth/face-descriptor')
      .set('Authorization', `Bearer ${signTokenFor(u)}`)
      .send({ descriptor: desc });
    expect(save.status).toBe(200);

    const status = await request(app)
      .get('/api/auth/face-descriptor/status')
      .set('Authorization', `Bearer ${signTokenFor(u)}`);
    expect(status.body.hasFaceDescriptor).toBe(true);

    const del = await request(app)
      .delete('/api/auth/face-descriptor')
      .set('Authorization', `Bearer ${signTokenFor(u)}`);
    expect(del.status).toBe(200);
  });

  it('rejects malformed descriptors on save', async () => {
    const u = await createArtisan({ email: 'badf@example.com' });
    const res = await request(app)
      .post('/api/auth/face-descriptor')
      .set('Authorization', `Bearer ${signTokenFor(u)}`)
      .send({ descriptor: [1, 2, 3] });
    expect(res.status).toBe(400);
  });
});
