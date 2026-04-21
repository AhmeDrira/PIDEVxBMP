const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

const mockSendMail = jest.fn().mockResolvedValue(undefined);

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
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
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  return {
    User,
    Artisan: { create: jest.fn() },
    Expert: { create: jest.fn() },
    Manufacturer: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
    Admin: { create: jest.fn() },
  };
});

const axios = require('axios');
const Notification = require('../../../models/Notification');
const { logAction } = require('../../../utils/actionLogger');
const { User, Artisan, Manufacturer, Admin } = require('../../../models/User');
const controller = require('../../../controllers/authController');

const mockSelectResolved = (value) => ({
  select: jest.fn().mockResolvedValue(value),
});

describe('authController deep coverage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'jwt-secret',
      ADMIN_SECRET_KEY: 'super-secret',
      APP_URL: 'http://localhost:3000',
    };

    jest.clearAllMocks();

    User.create.mockReset();
    User.find.mockReset();
    User.findOne.mockReset();
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
    Artisan.create.mockReset();
    Manufacturer.create.mockReset();
    Manufacturer.find.mockReset();
    Manufacturer.findById.mockReset();
    Admin.create.mockReset();
    Notification.create.mockReset();
    logAction.mockReset();
    axios.get.mockReset();
    axios.post.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('registerUser -> 403 when role is admin', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({
      body: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@test.com',
        password: 'Password123!',
        role: 'admin',
      },
    });
    const res = buildRes();

    await controller.registerUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('registerUser -> 201 for standard user role', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 'u1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@test.com',
      role: 'user',
    });

    const req = buildReq({
      body: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@test.com',
        password: 'Password123!',
        role: 'user',
      },
    });
    const res = buildRes();

    await controller.registerUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body._id).toBe('u1');
  });

  test('registerUser -> 201 for artisan and sends verification email', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';

    User.findOne.mockResolvedValue(null);
    Artisan.create.mockResolvedValue({
      _id: 'art1',
      id: 'art1',
      firstName: 'Ali',
      lastName: 'Artisan',
      email: 'artisan@test.com',
      role: 'artisan',
    });

    const req = buildReq({
      body: {
        firstName: 'Ali',
        lastName: 'Artisan',
        email: 'artisan@test.com',
        password: 'Password123!',
        role: 'artisan',
      },
    });
    const res = buildRes();

    await controller.registerUser(req, res);

    expect(Artisan.create).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'subscription_required' }));
    expect(mockSendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('registerUser -> 201 for manufacturer and queues admin notification', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';

    User.findOne.mockResolvedValue(null);
    Manufacturer.create.mockResolvedValue({
      _id: 'm1',
      id: 'm1',
      firstName: 'Mona',
      lastName: 'Manufacturer',
      email: 'manufacturer@test.com',
      role: 'manufacturer',
    });

    const req = buildReq({
      body: {
        firstName: 'Mona',
        lastName: 'Manufacturer',
        email: 'manufacturer@test.com',
        password: 'Password123!',
        role: 'manufacturer',
      },
      file: { filename: 'cert.pdf' },
    });
    const res = buildRes();

    await controller.registerUser(req, res);

    expect(Manufacturer.create).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'manufacturer_registration' }));
    expect(mockSendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('loginUser -> 403 when account is not verified', async () => {
    const mockUser = {
      matchPassword: jest.fn().mockResolvedValue(true),
      isVerified: false,
    };
    User.findOne.mockReturnValue(chainableQuery(mockUser));

    const req = buildReq({ body: { email: 'x@test.com', password: 'Password123!' } });
    const res = buildRes();

    await controller.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.notVerified).toBe(true);
  });

  test('loginUser -> 403 when manufacturer is pending', async () => {
    const mockUser = {
      matchPassword: jest.fn().mockResolvedValue(true),
      isVerified: true,
      role: 'manufacturer',
      verificationStatus: 'pending',
    };
    User.findOne.mockReturnValue(chainableQuery(mockUser));

    const req = buildReq({ body: { email: 'm@test.com', password: 'Password123!' } });
    const res = buildRes();

    await controller.loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.isPendingManufacturer).toBe(true);
  });

  test('loginUser -> 200 for active admin and auto-sets adminType', async () => {
    const mockUser = {
      _id: 'admin1',
      id: 'admin1',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      role: 'admin',
      phone: '',
      profilePhoto: '',
      adminType: undefined,
      permissions: {},
      status: 'active',
      isVerified: true,
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue(chainableQuery(mockUser));

    const req = buildReq({ body: { email: 'admin@test.com', password: 'Password123!' } });
    const res = buildRes();

    await controller.loginUser(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(mockUser.adminType).toBe('sub');
  });

  test('googleLogin -> 400 when credential is missing', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await controller.googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('googleLogin -> 401 when access token is invalid', async () => {
    axios.get.mockRejectedValue({ message: 'bad token' });

    const req = buildReq({ body: { credential: 'bad' } });
    const res = buildRes();

    await controller.googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('googleLogin -> 200 creates new artisan when user does not exist', async () => {
    axios.get.mockResolvedValue({
      data: {
        email: 'google-user@test.com',
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://example.com/picture.jpg',
      },
    });

    User.findOne.mockResolvedValue(null);

    const createdUser = {
      _id: 'g1',
      id: 'g1',
      firstName: 'Google',
      lastName: 'User',
      email: 'google-user@test.com',
      role: 'artisan',
      phone: '',
      profilePhoto: 'https://example.com/picture.jpg',
      adminType: undefined,
      permissions: {},
      status: 'active',
      save: jest.fn().mockResolvedValue(undefined),
    };

    Artisan.create.mockResolvedValue(createdUser);

    const req = buildReq({ body: { credential: 'valid-google-token' } });
    const res = buildRes();

    await controller.googleLogin(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(Artisan.create).toHaveBeenCalled();
  });

  test('googleLogin -> 403 when existing user is suspended', async () => {
    axios.get.mockResolvedValue({ data: { email: 'x@test.com' } });
    User.findOne.mockResolvedValue({
      _id: 'u1',
      role: 'user',
      status: 'suspended',
      save: jest.fn(),
    });

    const req = buildReq({ body: { credential: 'valid-google-token' } });
    const res = buildRes();

    await controller.googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('createSubAdmin -> 401 for invalid admin secret', async () => {
    const req = buildReq({
      body: {
        secretKey: 'invalid-secret',
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub@test.com',
        password: 'Password123!',
      },
    });
    const res = buildRes();

    await controller.createSubAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('createSubAdmin -> 400 when required fields are missing', async () => {
    const req = buildReq({
      body: {
        secretKey: 'super-secret',
        firstName: 'Sub',
      },
    });
    const res = buildRes();

    await controller.createSubAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createSubAdmin -> 400 when email already exists', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });

    const req = buildReq({
      body: {
        secretKey: 'super-secret',
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub@test.com',
        password: 'Password123!',
      },
    });
    const res = buildRes();

    await controller.createSubAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createSubAdmin -> 201 when account is created', async () => {
    User.findOne.mockResolvedValue(null);
    Admin.create.mockResolvedValue({
      _id: 'a2',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      adminType: 'sub',
      permissions: {
        canVerifyManufacturers: false,
        canManageKnowledge: true,
        canSuspendUsers: false,
        canManageReports: true,
        canDeleteUsers: false,
      },
    });

    const req = buildReq({
      body: {
        secretKey: 'super-secret',
        firstName: 'Sub',
        lastName: 'Admin',
        email: 'sub@test.com',
        password: 'Password123!',
        permissions: {
          canManageKnowledge: true,
          canManageReports: true,
        },
      },
    });
    const res = buildRes();

    await controller.createSubAdmin(req, res);

    expect(Admin.create).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('checkPhone -> 400 when phone is missing', async () => {
    const req = buildReq({ query: {} });
    const res = buildRes();

    await controller.checkPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('checkPhone -> 200 available false when phone exists', async () => {
    User.findOne.mockResolvedValue({ _id: 'u1' });

    const req = buildReq({ query: { phone: '+21699111222' } });
    const res = buildRes();

    await controller.checkPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ available: false });
  });

  test('checkResetOptions -> 400 when email is missing', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await controller.checkResetOptions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('checkResetOptions -> 200 with hasVerifiedPhone=true when user has verified phone', async () => {
    User.findOne.mockResolvedValue({ isPhoneVerified: true });

    const req = buildReq({ body: { email: 'x@test.com' } });
    const res = buildRes();

    await controller.checkResetOptions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.hasVerifiedPhone).toBe(true);
  });

  test('forgotPassword -> 200 when user does not exist', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ body: { email: 'missing@test.com' } });
    const res = buildRes();

    await controller.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('forgotPassword -> 200 and saves reset token when user exists', async () => {
    const mockUser = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    const req = buildReq({ body: { email: 'exists@test.com' } });
    const res = buildRes();

    await controller.forgotPassword(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('forgotPassword -> sends reset email through configured transporter', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';

    const mockUser = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    const req = buildReq({ body: { email: 'exists@test.com' } });
    const res = buildRes();

    await controller.forgotPassword(req, res);

    expect(mockSendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('resetPassword -> 400 for invalid token', async () => {
    User.findOne.mockReturnValue(mockSelectResolved(null));

    const req = buildReq({ body: { token: 'bad', password: 'newPass123' } });
    const res = buildRes();

    await controller.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('resetPassword -> 200 for valid token', async () => {
    const mockUser = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue(mockSelectResolved(mockUser));

    const req = buildReq({ body: { token: 'good', password: 'newPass123' } });
    const res = buildRes();

    await controller.resetPassword(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('verifyEmail -> 400 when verification token is invalid', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ body: { token: 'bad-token' } });
    const res = buildRes();

    await controller.verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('verifyEmail -> 200 when verification token is valid', async () => {
    const mockUser = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    const req = buildReq({ body: { token: 'good-token' } });
    const res = buildRes();

    await controller.verifyEmail(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('requestEmailChange -> 400 for invalid email format', async () => {
    const req = buildReq({
      user: { _id: 'u1' },
      body: { newEmail: 'invalid-email' },
    });
    const res = buildRes();

    await controller.requestEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requestEmailChange -> 400 when new email is already used', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });

    const req = buildReq({
      user: { _id: 'u1' },
      body: { newEmail: 'taken@test.com' },
    });
    const res = buildRes();

    await controller.requestEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requestEmailChange -> 404 when current user is missing', async () => {
    User.findOne.mockResolvedValue(null);
    User.findById.mockResolvedValue(null);

    const req = buildReq({
      user: { _id: 'u1' },
      body: { newEmail: 'new@test.com' },
    });
    const res = buildRes();

    await controller.requestEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('requestEmailChange -> 200 on valid request', async () => {
    const mockUser = {
      email: 'old@test.com',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findOne.mockResolvedValue(null);
    User.findById.mockResolvedValue(mockUser);

    const req = buildReq({
      user: { _id: 'u1' },
      body: { newEmail: 'new@test.com' },
    });
    const res = buildRes();

    await controller.requestEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body._devCode).toBeDefined();
    expect(mockUser.save).toHaveBeenCalled();
  });

  test('requestEmailChange -> sends verification email when transporter is configured', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';

    const mockUser = {
      email: 'old@test.com',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findOne.mockResolvedValue(null);
    User.findById.mockResolvedValue(mockUser);

    const req = buildReq({
      user: { _id: 'u1' },
      body: { newEmail: 'transport@test.com' },
    });
    const res = buildRes();

    await controller.requestEmailChange(req, res);

    expect(mockSendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('confirmEmailChange -> 400 when code is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: {} });
    const res = buildRes();

    await controller.confirmEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('confirmEmailChange -> 400 when code is invalid', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, body: { code: '123456' } });
    const res = buildRes();

    await controller.confirmEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('confirmEmailChange -> 200 when code is valid and no conflict exists', async () => {
    const mockUser = {
      _id: 'u1',
      pendingEmail: 'new@test.com',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findOne
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(null);

    const req = buildReq({ user: { _id: 'u1' }, body: { code: '123456' } });
    const res = buildRes();

    await controller.confirmEmailChange(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('confirmEmailChange -> 400 when pending email is taken by another user', async () => {
    const mockUser = {
      _id: 'u1',
      pendingEmail: 'taken@test.com',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findOne
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce({ _id: 'u2' });

    const req = buildReq({ user: { _id: 'u1' }, body: { code: '654321' } });
    const res = buildRes();

    await controller.confirmEmailChange(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('sendPhoneVerification -> 400 when phone is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: {} });
    const res = buildRes();

    await controller.sendPhoneVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('sendPhoneVerification -> 400 when phone is already verified by another user', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', save: jest.fn() });
    User.findOne.mockResolvedValue({ _id: 'u2' });

    const req = buildReq({
      user: { _id: 'u1' },
      body: { phone: '+21699111222' },
    });
    const res = buildRes();

    await controller.sendPhoneVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('sendPhoneVerification -> 200 for valid request', async () => {
    const mockUser = {
      _id: 'u1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(mockUser);
    User.findOne.mockResolvedValue(null);

    const req = buildReq({
      user: { _id: 'u1' },
      body: { phone: '+21699111222' },
    });
    const res = buildRes();

    await controller.sendPhoneVerification(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body._devCode).toBeDefined();
  });

  test('verifyPhone -> 400 for invalid code', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, body: { code: '000000' } });
    const res = buildRes();

    await controller.verifyPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('verifyPhone -> 200 for valid code', async () => {
    const mockUser = {
      pendingPhone: '+21699111222',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    const req = buildReq({ user: { _id: 'u1' }, body: { code: '123456' } });
    const res = buildRes();

    await controller.verifyPhone(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('forgotPasswordPhone -> 200 when no user matches', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ body: { email: 'missing@test.com' } });
    const res = buildRes();

    await controller.forgotPasswordPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('forgotPasswordPhone -> 200 and saves reset code when user exists', async () => {
    const mockUser = {
      phone: '+21699111222',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    const req = buildReq({ body: { email: 'user@test.com' } });
    const res = buildRes();

    await controller.forgotPasswordPhone(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body._devCode).toBeDefined();
  });

  test('resetPasswordPhone -> 400 when required fields are missing', async () => {
    const req = buildReq({ body: { email: 'x@test.com' } });
    const res = buildRes();

    await controller.resetPasswordPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('resetPasswordPhone -> 400 when code is invalid', async () => {
    User.findOne.mockReturnValue(mockSelectResolved(null));

    const req = buildReq({
      body: {
        email: 'x@test.com',
        code: 'bad-code',
        password: 'newPass123',
      },
    });
    const res = buildRes();

    await controller.resetPasswordPhone(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('resetPasswordPhone -> 200 when code is valid', async () => {
    const mockUser = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue(mockSelectResolved(mockUser));

    const req = buildReq({
      body: {
        email: 'x@test.com',
        code: 'good-code',
        password: 'newPass123',
      },
    });
    const res = buildRes();

    await controller.resetPasswordPhone(req, res);

    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updatePassword -> 400 when current/new password is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: {} });
    const res = buildRes();

    await controller.updatePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updatePassword -> 400 when current password is incorrect', async () => {
    const mockUser = {
      matchPassword: jest.fn().mockResolvedValue(false),
    };
    User.findById.mockReturnValue(mockSelectResolved(mockUser));

    const req = buildReq({
      user: { _id: 'u1' },
      body: { currentPassword: 'wrong', newPassword: 'newPass123' },
    });
    const res = buildRes();

    await controller.updatePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updatePassword -> 200 and sends notification for sub-admin', async () => {
    const mockUser = {
      _id: 'u1',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      role: 'admin',
      adminType: 'sub',
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockReturnValue(mockSelectResolved(mockUser));

    const req = buildReq({
      user: { _id: 'u1' },
      body: { currentPassword: 'oldPass123', newPassword: 'newPass123' },
    });
    const res = buildRes();

    await controller.updatePassword(req, res);

    expect(Notification.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateProfile -> 404 when user does not exist', async () => {
    User.findById.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, body: { firstName: 'New' } });
    const res = buildRes();

    await controller.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateProfile -> returns updated profile payload', async () => {
    const savedUser = {
      _id: 'u1',
      firstName: 'New',
      lastName: 'Name',
      email: 'user@test.com',
      role: 'artisan',
      phone: '123',
      profilePhoto: 'photo.png',
      isPhoneVerified: false,
      location: 'Tunis',
      domain: 'Plomberie',
      bio: 'bio',
      specialization: '',
      yearsExperience: 4,
      credentials: '',
      institution: '',
      companyName: '',
      description: '',
      certificationNumber: '',
      skills: ['a'],
      certifications: ['b'],
      save: jest.fn(),
    };

    savedUser.save.mockResolvedValue(savedUser);
    User.findById.mockResolvedValue(savedUser);

    const req = buildReq({
      user: { _id: 'u1' },
      body: { firstName: 'New', yearsExperience: 4, skills: ['a'], certifications: ['b'] },
    });
    const res = buildRes();

    await controller.updateProfile(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test('faceLogin -> 400 for invalid descriptor length', async () => {
    const req = buildReq({ body: { descriptor: [0.1, 0.2] } });
    const res = buildRes();

    await controller.faceLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('faceLogin -> 404 when no registered faces exist', async () => {
    User.find.mockReturnValue(mockSelectResolved([]));

    const req = buildReq({ body: { descriptor: new Array(128).fill(0) } });
    const res = buildRes();

    await controller.faceLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('faceLogin -> 200 for matching active user', async () => {
    const mockUser = {
      _id: 'u1',
      firstName: 'Face',
      lastName: 'User',
      email: 'face@test.com',
      role: 'user',
      status: 'active',
      profilePhoto: '',
      faceDescriptor: new Array(128).fill(0),
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.find.mockReturnValue(mockSelectResolved([mockUser]));

    const req = buildReq({ body: { descriptor: new Array(128).fill(0) } });
    const res = buildRes();

    await controller.faceLogin(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  test('saveFaceDescriptor and deleteFaceDescriptor -> both return success payload', async () => {
    User.findByIdAndUpdate.mockResolvedValue(undefined);

    const saveReq = buildReq({ user: { _id: 'u1' }, body: { descriptor: new Array(128).fill(0.1) } });
    const saveRes = buildRes();
    await controller.saveFaceDescriptor(saveReq, saveRes);
    expect(saveRes.json).toHaveBeenCalledWith({ message: 'Face registered successfully' });

    const deleteReq = buildReq({ user: { _id: 'u1' } });
    const deleteRes = buildRes();
    await controller.deleteFaceDescriptor(deleteReq, deleteRes);
    expect(deleteRes.json).toHaveBeenCalledWith({ message: 'Face removed successfully' });
  });

  test('getPendingManufacturers -> 403 when permission is missing', async () => {
    const req = buildReq({
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'sub',
        permissions: { canVerifyManufacturers: false },
      },
    });
    const res = buildRes();

    await controller.getPendingManufacturers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('getCertificationFile -> 404 when manufacturer or file is missing', async () => {
    User.findById.mockResolvedValue(null);

    const req = buildReq({ params: { id: 'm1' } });
    const res = buildRes();

    await controller.getCertificationFile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('getCertificationFile -> serves binary certification data from DB', async () => {
    const mockData = Buffer.from('dummy-cert-content', 'utf8');
    User.findById.mockResolvedValue({
      role: 'manufacturer',
      certificationFile: {
        data: mockData,
        contentType: 'application/pdf',
        fileName: 'cert.pdf',
      },
    });

    const req = buildReq({ params: { id: 'm1' } });
    const res = buildRes();
    res.set = jest.fn(() => res);

    await controller.getCertificationFile(req, res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send).toHaveBeenCalledWith(mockData);
  });

  test('getPendingManufacturers -> 200 when permission is granted', async () => {
    Manufacturer.find.mockReturnValue(mockSelectResolved([{ _id: 'm1' }]));

    const req = buildReq({
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'sub',
        permissions: { canVerifyManufacturers: true },
      },
    });
    const res = buildRes();

    await controller.getPendingManufacturers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('approveManufacturer -> 404 when manufacturer does not exist', async () => {
    Manufacturer.findById.mockResolvedValue(null);

    const req = buildReq({
      params: { id: 'm1' },
      user: { _id: 'a1', role: 'admin', adminType: 'super' },
    });
    const res = buildRes();

    await controller.approveManufacturer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('approveManufacturer -> 200 for valid manufacturer', async () => {
    const manufacturer = {
      _id: 'm1',
      companyName: 'BuildCo',
      email: 'm@test.com',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Manufacturer.findById.mockResolvedValue(manufacturer);

    const req = buildReq({
      params: { id: 'm1' },
      user: { _id: 'a1', role: 'admin', adminType: 'super' },
    });
    const res = buildRes();

    await controller.approveManufacturer(req, res);

    expect(manufacturer.save).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejectManufacturer -> 200 deletes rejected manufacturer account', async () => {
    const manufacturer = {
      _id: 'm1',
      companyName: 'BuildCo',
      email: 'm@test.com',
      save: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    Manufacturer.findById.mockResolvedValue(manufacturer);

    const req = buildReq({
      params: { id: 'm1' },
      body: { reason: 'Missing documents' },
      user: { _id: 'a1', role: 'admin', adminType: 'super' },
    });
    const res = buildRes();

    await controller.rejectManufacturer(req, res);

    expect(manufacturer.deleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('listUsers -> 200 with user list', async () => {
    User.find.mockReturnValue(mockSelectResolved([{ _id: 'u1' }]));

    const req = buildReq();
    const res = buildRes();

    await controller.listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('suspendUser -> 403 when sub-admin targets admin account', async () => {
    User.findById.mockResolvedValue({ role: 'admin' });

    const req = buildReq({
      params: { id: 'u1' },
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'sub',
        permissions: { canSuspendUsers: true },
      },
    });
    const res = buildRes();

    await controller.suspendUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('suspendUser -> 200 for allowed suspension', async () => {
    const targetUser = {
      _id: 'u1',
      firstName: 'User',
      lastName: 'One',
      email: 'u1@test.com',
      role: 'user',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(targetUser);

    const req = buildReq({
      params: { id: 'u1' },
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'super',
      },
    });
    const res = buildRes();

    await controller.suspendUser(req, res);

    expect(targetUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('activateUser -> 200 for allowed activation', async () => {
    const targetUser = {
      _id: 'u1',
      firstName: 'User',
      lastName: 'One',
      email: 'u1@test.com',
      role: 'user',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(targetUser);

    const req = buildReq({
      params: { id: 'u1' },
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'super',
      },
    });
    const res = buildRes();

    await controller.activateUser(req, res);

    expect(targetUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deleteUser -> 200 for allowed deletion', async () => {
    const targetUser = {
      _id: 'u1',
      firstName: 'User',
      lastName: 'One',
      email: 'u1@test.com',
      role: 'user',
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(targetUser);

    const req = buildReq({
      params: { id: 'u1' },
      user: {
        _id: 'a1',
        role: 'admin',
        adminType: 'super',
      },
    });
    const res = buildRes();

    await controller.deleteUser(req, res);

    expect(targetUser.deleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('subAdminForgotPassword -> 400 when email is missing', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await controller.subAdminForgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('subAdminForgotPassword -> 200 and creates notification for sub-admin', async () => {
    User.findOne.mockResolvedValue({
      _id: 'a2',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      role: 'admin',
      adminType: 'sub',
    });

    const req = buildReq({ body: { email: 'sub@test.com' } });
    const res = buildRes();

    await controller.subAdminForgotPassword(req, res);

    expect(Notification.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('resetSubAdminPassword -> 404 when target sub-admin is not found', async () => {
    User.findById.mockReturnValue(mockSelectResolved(null));

    const req = buildReq({ params: { id: 'missing' }, user: { _id: 'a1' } });
    const res = buildRes();

    await controller.resetSubAdminPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('resetSubAdminPassword -> 200 when temporary password is generated', async () => {
    const subAdmin = {
      _id: 'a2',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      role: 'admin',
      adminType: 'sub',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findById.mockReturnValue(mockSelectResolved(subAdmin));

    const req = buildReq({ params: { id: 'a2' }, user: { _id: 'a1' } });
    const res = buildRes();

    await controller.resetSubAdminPassword(req, res);

    expect(subAdmin.save).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('resetSubAdminPassword -> sends temporary password email when transporter is configured', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';

    const subAdmin = {
      _id: 'a2',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      role: 'admin',
      adminType: 'sub',
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findById.mockReturnValue(mockSelectResolved(subAdmin));

    const req = buildReq({ params: { id: 'a2' }, user: { _id: 'a1' } });
    const res = buildRes();

    await controller.resetSubAdminPassword(req, res);

    expect(mockSendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateSubAdminPermissions -> 200 updates and returns permissions', async () => {
    const subAdmin = {
      _id: 'a2',
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@test.com',
      role: 'admin',
      adminType: 'sub',
      permissions: {},
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findById.mockResolvedValue(subAdmin);

    const req = buildReq({
      params: { id: 'a2' },
      body: {
        permissions: {
          canManageKnowledge: true,
          canManageReports: true,
        },
      },
      user: { _id: 'a1' },
    });
    const res = buildRes();

    await controller.updateSubAdminPermissions(req, res);

    expect(subAdmin.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
