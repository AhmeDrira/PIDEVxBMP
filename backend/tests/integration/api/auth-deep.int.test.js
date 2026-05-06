/**
 * Deeper integration tests for authController, focused on branches not covered
 * by tests/integration/api/auth.int.test.js:
 *   - updatePassword
 *   - updateProfile
 *   - request/confirm email change
 *   - subAdminForgotPassword / resetSubAdminPassword / updateSubAdminPermissions
 *   - phone verification + phone reset flow
 *   - checkResetOptions
 *   - admin manufacturer verification (pending / approve / reject)
 *   - admin user management (list / suspend / activate / delete + sub-admin guard)
 */

jest.setTimeout(60000);

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-mail' }),
  })),
}));

jest.mock('axios', () => ({ get: jest.fn() }));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: jest.fn() })),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-test-secret';
process.env.NODE_ENV = 'test';
// Configure SMTP envs so getTransporter() returns a transport (covers the email branches)
process.env.SMTP_HOST = 'smtp.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildAuthApp } = require('../helpers/buildAuthApp');
const {
  signTokenFor,
  signSuperAdminToken,
  createArtisan,
  createManufacturer,
  createAdmin,
  authHeader,
} = require('../helpers/auth.helpers');

const { User, Manufacturer, Admin } = require('../../../models/User');
const Notification = require('../../../models/Notification');

let app;
const superAdminAuth = () => ({ Authorization: `Bearer ${signSuperAdminToken()}` });

beforeAll(async () => {
  await startTestDb();
  app = buildAuthApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

// --- POST /api/auth/update-password (protected) -----------------------------

describe('POST /api/auth/update-password', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/auth/update-password').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields missing', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/update-password')
      .set(authHeader(u))
      .send({ currentPassword: '' });
    expect(res.status).toBe(400);
  });

  it('rejects super-admin tokens (no _id in session)', async () => {
    const res = await request(app)
      .post('/api/auth/update-password')
      .set(superAdminAuth())
      .send({ currentPassword: 'a', newPassword: 'b' });
    expect(res.status).toBe(403);
  });

  it('rejects when current password is wrong', async () => {
    const u = await createArtisan({ email: 'wrong@example.com', password: 'Password123!' });
    const res = await request(app)
      .post('/api/auth/update-password')
      .set(authHeader(u))
      .send({ currentPassword: 'Wrong!', newPassword: 'NewPwd123!' });
    expect(res.status).toBe(400);
  });

  it('updates the password and lets the user log in with it', async () => {
    const u = await createArtisan({ email: 'pwup@example.com', password: 'Password123!' });
    const update = await request(app)
      .post('/api/auth/update-password')
      .set(authHeader(u))
      .send({ currentPassword: 'Password123!', newPassword: 'NewPwd123!' });
    expect(update.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pwup@example.com', password: 'NewPwd123!' });
    expect(login.status).toBe(200);
  });

  it('logs a notification when sub-admin changes their password', async () => {
    const sub = await createAdmin({ adminType: 'sub' });
    const res = await request(app)
      .post('/api/auth/update-password')
      .set(authHeader(sub))
      .send({ currentPassword: 'Password123!', newPassword: 'NewPwd123!' });
    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ type: 'admin_password_change', relatedId: sub._id });
    expect(notif).toBeTruthy();
  });
});

// --- PUT /api/auth/profile --------------------------------------------------

describe('PUT /api/auth/profile', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/auth/profile').send({});
    expect(res.status).toBe(401);
  });

  it('updates a wide range of artisan fields', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(u))
      .send({
        firstName: 'Alice2',
        lastName: 'New',
        phone: '20999111',
        location: 'Tunis',
        domain: 'plomberie',
        bio: 'biography',
        skills: ['s1', 's2'],
        certifications: ['c1'],
        yearsExperience: 7,
      });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Alice2');
    expect(res.body.skills).toEqual(['s1', 's2']);
    expect(res.body.yearsExperience).toBe(7);
  });
});

// --- email change flow ------------------------------------------------------

describe('POST /api/auth/change-email + /api/auth/confirm-email-change', () => {
  it('returns 400 when newEmail is missing', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/change-email')
      .set(authHeader(u))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when newEmail is malformed', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/change-email')
      .set(authHeader(u))
      .send({ newEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newEmail equals current (covered by duplicate check)', async () => {
    // Note: duplicate-check kicks in first (the user IS the existing record),
    // so the message is "already in use" rather than "same as current".
    const u = await createArtisan({ email: 'me@mail.com' });
    const res = await request(app)
      .post('/api/auth/change-email')
      .set(authHeader(u))
      .send({ newEmail: 'me@mail.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newEmail is already in use by someone else', async () => {
    const u = await createArtisan();
    await createArtisan({ email: 'taken@mail.com' });
    const res = await request(app)
      .post('/api/auth/change-email')
      .set(authHeader(u))
      .send({ newEmail: 'taken@mail.com' });
    expect(res.status).toBe(400);
  });

  it('sends a verification code (devCode visible in non-prod) and persists the request', async () => {
    const u = await createArtisan({ email: 'old@mail.com' });

    const startRes = await request(app)
      .post('/api/auth/change-email')
      .set(authHeader(u))
      .send({ newEmail: 'new@mail.com' });
    expect(startRes.status).toBe(200);
    expect(startRes.body._devCode).toMatch(/^\d{6}$/);

    // Persisted state on the user (select:false fields, must be queried explicitly)
    const refreshed = await User.findById(u._id).select(
      '+pendingEmail +emailChangeToken +emailChangeTokenExpires'
    );
    expect(refreshed.pendingEmail).toBe('new@mail.com');
    expect(refreshed.emailChangeToken).toBeTruthy();
    expect(refreshed.emailChangeTokenExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an invalid confirmation code', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/confirm-email-change')
      .set(authHeader(u))
      .send({ code: '000000' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when confirm-email-change has no code', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/confirm-email-change')
      .set(authHeader(u))
      .send({});
    expect(res.status).toBe(400);
  });
});

// --- sub-admin forgot password / reset / permissions ------------------------

describe('Sub-admin password + permissions endpoints', () => {
  it('subAdminForgotPassword: returns 200 generic for non-existing email', async () => {
    const res = await request(app).post('/api/auth/sub-admin/forgot').send({ email: 'ghost@mail.com' });
    expect(res.status).toBe(200);
  });

  it('subAdminForgotPassword: 400 when email missing', async () => {
    const res = await request(app).post('/api/auth/sub-admin/forgot').send({});
    expect(res.status).toBe(400);
  });

  it('subAdminForgotPassword: creates a notification when sub-admin exists', async () => {
    const sub = await createAdmin({ email: 'sub@mail.com', adminType: 'sub' });
    const res = await request(app)
      .post('/api/auth/sub-admin/forgot')
      .send({ email: 'sub@mail.com' });
    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ type: 'sub_admin_password_request', relatedId: sub._id });
    expect(notif).toBeTruthy();
  });

  it('subAdminForgotPassword: ignores non-sub-admin accounts (no notification)', async () => {
    await createArtisan({ email: 'normal@mail.com' });
    const res = await request(app)
      .post('/api/auth/sub-admin/forgot')
      .send({ email: 'normal@mail.com' });
    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ type: 'sub_admin_password_request' });
    expect(notif).toBeNull();
  });

  it('resetSubAdminPassword: 404 when target is not a sub-admin', async () => {
    const someUser = await createArtisan();
    const res = await request(app)
      .post(`/api/auth/admin/subadmins/${someUser._id}/reset-password`)
      .set(superAdminAuth());
    expect(res.status).toBe(404);
  });

  it('resetSubAdminPassword: super-admin can reset a sub-admin password', async () => {
    const sub = await createAdmin({ email: 'rs@mail.com', adminType: 'sub' });
    const res = await request(app)
      .post(`/api/auth/admin/subadmins/${sub._id}/reset-password`)
      .set(superAdminAuth());
    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ type: 'sub_admin_password_sent', relatedId: sub._id });
    expect(notif).toBeTruthy();
  });

  it('resetSubAdminPassword: a non-super-admin (sub-admin token) is forbidden', async () => {
    const sub = await createAdmin({ email: 'sub-pwres@mail.com', adminType: 'sub' });
    const target = await createAdmin({ email: 'tgt@mail.com', adminType: 'sub' });
    const res = await request(app)
      .post(`/api/auth/admin/subadmins/${target._id}/reset-password`)
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });

  it('updateSubAdminPermissions: 404 when target is not sub-admin', async () => {
    const someUser = await createArtisan();
    const res = await request(app)
      .put(`/api/auth/admin/subadmins/${someUser._id}/permissions`)
      .set(superAdminAuth())
      .send({ permissions: { canManageReports: true } });
    expect(res.status).toBe(404);
  });

  it('updateSubAdminPermissions: super-admin updates permissions', async () => {
    const sub = await createAdmin({ email: 'p@mail.com', adminType: 'sub' });
    const res = await request(app)
      .put(`/api/auth/admin/subadmins/${sub._id}/permissions`)
      .set(superAdminAuth())
      .send({ permissions: { canManageReports: true, canVerifyManufacturers: true } });
    expect(res.status).toBe(200);
    expect(res.body.user.permissions.canManageReports).toBe(true);
    expect(res.body.user.permissions.canDeleteUsers).toBe(false);
  });
});

// --- phone verification flow ------------------------------------------------

describe('Phone verification flow', () => {
  it('sendPhoneVerification: 400 without phone', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/phone/send-verification')
      .set(authHeader(u))
      .send({});
    expect(res.status).toBe(400);
  });

  it('sendPhoneVerification: 400 when phone is already verified by another user', async () => {
    await createArtisan({ phone: '20000001', isPhoneVerified: true });
    const me = await createArtisan();
    const res = await request(app)
      .post('/api/auth/phone/send-verification')
      .set(authHeader(me))
      .send({ phone: '20000001' });
    expect(res.status).toBe(400);
  });

  it('sendPhoneVerification persists the verification code on the user', async () => {
    const me = await createArtisan();
    const send = await request(app)
      .post('/api/auth/phone/send-verification')
      .set(authHeader(me))
      .send({ phone: '20000002' });
    expect(send.status).toBe(200);
    expect(send.body._devCode).toMatch(/^\d{6}$/);

    const refreshed = await User.findById(me._id).select(
      '+pendingPhone +phoneVerificationCode +phoneVerificationExpires'
    );
    expect(refreshed.pendingPhone).toBe('20000002');
    expect(refreshed.phoneVerificationCode).toBeTruthy();
    expect(refreshed.phoneVerificationExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyPhone: 400 without code', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/phone/verify')
      .set(authHeader(u))
      .send({});
    expect(res.status).toBe(400);
  });

  it('verifyPhone: rejects wrong code', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/auth/phone/verify')
      .set(authHeader(u))
      .send({ code: '000000' });
    expect(res.status).toBe(400);
  });

  it('forgotPasswordPhone: returns 200 generic when no verified phone matches', async () => {
    const res = await request(app)
      .post('/api/auth/phone/forgot')
      .send({ email: 'nobody@mail.com' });
    expect(res.status).toBe(200);
  });

  it('forgotPasswordPhone: creates a reset code for a verified phone (devCode visible)', async () => {
    await createArtisan({
      email: 'ph@mail.com',
      phone: '20000099',
      isPhoneVerified: true,
    });
    const res = await request(app)
      .post('/api/auth/phone/forgot')
      .send({ email: 'ph@mail.com' });
    expect(res.status).toBe(200);
    expect(res.body._devCode).toMatch(/^\d{6}$/);
  });

  it('resetPasswordPhone: 400 when fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/phone/reset')
      .send({ email: 'x@mail.com' });
    expect(res.status).toBe(400);
  });

  it('resetPasswordPhone: rejects an invalid code', async () => {
    await createArtisan({ email: 'r@mail.com', phone: '20000088', isPhoneVerified: true });
    const res = await request(app)
      .post('/api/auth/phone/reset')
      .send({ email: 'r@mail.com', code: '000000', password: 'NewPwd123!' });
    expect(res.status).toBe(400);
  });

  it('resetPasswordPhone: end-to-end phone reset', async () => {
    const u = await createArtisan({
      email: 'rp@mail.com',
      phone: '20000077',
      isPhoneVerified: true,
    });

    const start = await request(app)
      .post('/api/auth/phone/forgot')
      .send({ email: 'rp@mail.com' });
    expect(start.body._devCode).toMatch(/^\d{6}$/);

    const reset = await request(app)
      .post('/api/auth/phone/reset')
      .send({ email: 'rp@mail.com', code: start.body._devCode, password: 'NewPwd456!' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rp@mail.com', password: 'NewPwd456!' });
    expect(login.status).toBe(200);
    expect(u.email).toBe('rp@mail.com');
  });
});

// --- POST /api/auth/check-reset-options -------------------------------------

describe('POST /api/auth/check-reset-options', () => {
  it('returns 400 when email missing', async () => {
    const res = await request(app).post('/api/auth/check-reset-options').send({});
    expect(res.status).toBe(400);
  });

  it('returns hasVerifiedPhone:false for unknown email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/check-reset-options')
      .send({ email: 'ghost@mail.com' });
    expect(res.status).toBe(200);
    expect(res.body.hasVerifiedPhone).toBe(false);
  });

  it('returns hasVerifiedPhone:true when user has a verified phone', async () => {
    await createArtisan({ email: 'has@mail.com', phone: '20111000', isPhoneVerified: true });
    const res = await request(app)
      .post('/api/auth/check-reset-options')
      .send({ email: 'has@mail.com' });
    expect(res.status).toBe(200);
    expect(res.body.hasVerifiedPhone).toBe(true);
  });
});

// --- Admin manufacturer verification ----------------------------------------

describe('Admin manufacturer verification', () => {
  it('GET /admin/manufacturers/pending requires admin', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .get('/api/auth/admin/manufacturers/pending')
      .set(authHeader(u));
    expect(res.status).toBe(401);
  });

  it('GET /admin/manufacturers/pending returns the list for super-admin', async () => {
    await Manufacturer.create({
      firstName: 'M1', lastName: 'F', email: 'm1@mail.com', password: 'Password123!',
      role: 'manufacturer', isVerified: true, verificationStatus: 'pending',
    });
    await Manufacturer.create({
      firstName: 'M2', lastName: 'F', email: 'm2@mail.com', password: 'Password123!',
      role: 'manufacturer', isVerified: true, verificationStatus: 'approved',
    });

    const res = await request(app)
      .get('/api/auth/admin/manufacturers/pending')
      .set(superAdminAuth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('m1@mail.com');
  });

  it('GET /admin/manufacturers/pending: sub-admin without permission gets 403', async () => {
    const sub = await createAdmin({ adminType: 'sub', permissions: {} });
    const res = await request(app)
      .get('/api/auth/admin/manufacturers/pending')
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });

  it('approveManufacturer: 404 for unknown id', async () => {
    const res = await request(app)
      .post(`/api/auth/admin/manufacturers/${new mongoose.Types.ObjectId()}/approve`)
      .set(superAdminAuth());
    expect(res.status).toBe(404);
  });

  it('approveManufacturer: marks as approved', async () => {
    const m = await Manufacturer.create({
      firstName: 'M', lastName: 'F', email: 'mok@mail.com', password: 'Password123!',
      role: 'manufacturer', isVerified: true, verificationStatus: 'pending',
    });
    const res = await request(app)
      .post(`/api/auth/admin/manufacturers/${m._id}/approve`)
      .set(superAdminAuth());
    expect(res.status).toBe(200);
    const refreshed = await Manufacturer.findById(m._id);
    expect(refreshed.verificationStatus).toBe('approved');
  });

  it('rejectManufacturer: deletes the account and stores reason', async () => {
    const m = await Manufacturer.create({
      firstName: 'M', lastName: 'F', email: 'mrej@mail.com', password: 'Password123!',
      role: 'manufacturer', isVerified: true, verificationStatus: 'pending',
    });
    const res = await request(app)
      .post(`/api/auth/admin/manufacturers/${m._id}/decline`)
      .set(superAdminAuth())
      .send({ reason: 'Bad cert' });
    expect(res.status).toBe(200);
    const remaining = await Manufacturer.findById(m._id);
    expect(remaining).toBeNull();
  });

  it('rejectManufacturer: 404 when manufacturer not found', async () => {
    const res = await request(app)
      .post(`/api/auth/admin/manufacturers/${new mongoose.Types.ObjectId()}/decline`)
      .set(superAdminAuth())
      .send({ reason: 'x' });
    expect(res.status).toBe(404);
  });
});

// --- Admin user management --------------------------------------------------

describe('Admin user management', () => {
  it('GET /admin/users requires admin', async () => {
    const u = await createArtisan();
    const res = await request(app).get('/api/auth/admin/users').set(authHeader(u));
    expect(res.status).toBe(401);
  });

  it('GET /admin/users returns a list for super-admin', async () => {
    await createArtisan({ email: 'u1@mail.com' });
    await createArtisan({ email: 'u2@mail.com' });
    const res = await request(app)
      .get('/api/auth/admin/users')
      .set(superAdminAuth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('suspendUser: 404 for unknown id', async () => {
    const res = await request(app)
      .post(`/api/auth/admin/users/${new mongoose.Types.ObjectId()}/suspend`)
      .set(superAdminAuth());
    expect(res.status).toBe(404);
  });

  it('suspendUser + activateUser flow', async () => {
    const u = await createArtisan();

    const susp = await request(app)
      .post(`/api/auth/admin/users/${u._id}/suspend`)
      .set(superAdminAuth());
    expect(susp.status).toBe(200);
    const after = await User.findById(u._id);
    expect(after.status).toBe('suspended');

    const act = await request(app)
      .post(`/api/auth/admin/users/${u._id}/activate`)
      .set(superAdminAuth());
    expect(act.status).toBe(200);
    const after2 = await User.findById(u._id);
    expect(after2.status).toBe('active');
  });

  it('suspendUser: sub-admin cannot suspend an admin account', async () => {
    const sub = await createAdmin({
      adminType: 'sub',
      permissions: { canSuspendUsers: true },
    });
    const target = await createAdmin({ email: 'tgt-admin@mail.com', adminType: 'sub' });

    const res = await request(app)
      .post(`/api/auth/admin/users/${target._id}/suspend`)
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });

  it('suspendUser: sub-admin without canSuspendUsers gets 403', async () => {
    const sub = await createAdmin({ adminType: 'sub', permissions: {} });
    const u = await createArtisan();
    const res = await request(app)
      .post(`/api/auth/admin/users/${u._id}/suspend`)
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });

  it('activateUser: 404 unknown id', async () => {
    const res = await request(app)
      .post(`/api/auth/admin/users/${new mongoose.Types.ObjectId()}/activate`)
      .set(superAdminAuth());
    expect(res.status).toBe(404);
  });

  it('deleteUser: super-admin can delete a user', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .delete(`/api/auth/admin/users/${u._id}`)
      .set(superAdminAuth());
    expect(res.status).toBe(200);
    expect(await User.findById(u._id)).toBeNull();
  });

  it('deleteUser: 404 on unknown id', async () => {
    const res = await request(app)
      .delete(`/api/auth/admin/users/${new mongoose.Types.ObjectId()}`)
      .set(superAdminAuth());
    expect(res.status).toBe(404);
  });

  it('deleteUser: sub-admin without canDeleteUsers gets 403', async () => {
    const sub = await createAdmin({ adminType: 'sub', permissions: {} });
    const u = await createArtisan();
    const res = await request(app)
      .delete(`/api/auth/admin/users/${u._id}`)
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });

  it('deleteUser: sub-admin cannot delete another admin', async () => {
    const sub = await createAdmin({
      adminType: 'sub',
      permissions: { canDeleteUsers: true },
    });
    const target = await createAdmin({ email: 'tgt-del@mail.com', adminType: 'sub' });

    const res = await request(app)
      .delete(`/api/auth/admin/users/${target._id}`)
      .set(authHeader(sub));
    expect(res.status).toBe(403);
  });
});
