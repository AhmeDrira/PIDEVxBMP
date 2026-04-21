const { buildReq, buildRes } = require('../../http.mock');

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue() })),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../models/User', () => {
  const User = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
  };

  return {
    User,
    Artisan: { create: jest.fn() },
    Expert: { create: jest.fn() },
    Manufacturer: {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    },
    Admin: { create: jest.fn() },
  };
});

const { Manufacturer } = require('../../../models/User');
const controller = require('../../../controllers/authController');

describe('authController coverage additions', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('adminLogin -> 401 when secret key length differs from configured secret', async () => {
    process.env.ADMIN_SECRET_KEY = 'super-secret';
    process.env.JWT_SECRET = 'jwt-secret';

    const req = buildReq({ body: { secretKey: 'x' } });
    const res = buildRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('createSubAdmin -> 401 when ADMIN_SECRET_KEY is missing', async () => {
    delete process.env.ADMIN_SECRET_KEY;

    const req = buildReq({
      body: {
        secretKey: 'any-value',
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub-admin@example.com',
        password: 'password123',
      },
    });
    const res = buildRes();

    await controller.createSubAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('getPendingManufacturers -> 403 when requester has no admin permission context', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();

    await controller.getPendingManufacturers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Manufacturer.find).not.toHaveBeenCalled();
  });

  test('getPendingManufacturers -> 200 for super admin', async () => {
    Manufacturer.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'm1', companyName: 'ACME' }]),
    });

    const req = buildReq({ user: { _id: 'a1', role: 'admin', adminType: 'super' } });
    const res = buildRes();

    await controller.getPendingManufacturers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('getPendingManufacturers -> 200 for sub-admin with explicit permission', async () => {
    Manufacturer.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'm2', companyName: 'BuildCo' }]),
    });

    const req = buildReq({
      user: {
        _id: 'a2',
        role: 'admin',
        adminType: 'sub',
        permissions: { canVerifyManufacturers: true },
      },
    });
    const res = buildRes();

    await controller.getPendingManufacturers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
