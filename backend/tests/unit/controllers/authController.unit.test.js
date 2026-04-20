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
  logAction: jest.fn(),
}));

jest.mock('../../../models/User', () => {
  const User = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  return {
    User,
    Artisan: { create: jest.fn() },
    Expert: { create: jest.fn() },
    Manufacturer: { create: jest.fn() },
    Admin: { create: jest.fn() },
  };
});

const { User } = require('../../../models/User');
const controller = require('../../../controllers/authController');

describe('authController', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('registerUser -> 400 when required fields are missing', async () => {
    const req = buildReq({ body: { firstName: 'A' } });
    const res = buildRes();

    await controller.registerUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/required fields/i);
  });

  test('loginUser -> 400 when email or password is missing', async () => {
    const req = buildReq({ body: { email: 'x@example.com' } });
    const res = buildRes();

    await controller.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/email and password are required/i);
  });

  test('checkEmail -> 400 when email query param is missing', async () => {
    const req = buildReq({ query: {} });
    const res = buildRes();

    await controller.checkEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.available).toBe(false);
  });

  test('checkEmail -> 200 available true when no user exists', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ query: { email: 'new@example.com' } });
    const res = buildRes();

    await controller.checkEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ available: true });
  });

  test('adminLogin -> 400 when secret key is missing', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('adminLogin -> 500 when ADMIN_SECRET_KEY is not configured', async () => {
    delete process.env.ADMIN_SECRET_KEY;

    const req = buildReq({ body: { secretKey: 'abc' } });
    const res = buildRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('adminLogin -> 401 when secret key is invalid', async () => {
    process.env.ADMIN_SECRET_KEY = 'super-secret';

    const req = buildReq({ body: { secretKey: 'wrong-secret' } });
    const res = buildRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('adminLogin -> 200 with signed token on valid key', async () => {
    process.env.ADMIN_SECRET_KEY = 'super-secret';
    process.env.JWT_SECRET = 'jwt-secret';

    const req = buildReq({ body: { secretKey: 'super-secret' } });
    const res = buildRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.token).toBe('signed-token');
  });

  test('saveFaceDescriptor -> 400 for invalid descriptor', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { descriptor: [0.1, 0.2] } });
    const res = buildRes();

    await controller.saveFaceDescriptor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/invalid face descriptor/i);
  });

  test('getFaceDescriptorStatus -> returns true when descriptor is registered', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ faceDescriptor: new Array(128).fill(0.2) }),
    });

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.getFaceDescriptorStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasFaceDescriptor: true });
  });
});
