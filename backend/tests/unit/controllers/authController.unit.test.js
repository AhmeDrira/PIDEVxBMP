const { createMockReq, createMockRes } = require('../mocks/http.mock');
const { buildUser } = require('../builders/user.builder');
const { validLoginPayload, validAdminSecretPayload } = require('../fixtures/auth.fixture');

jest.mock('../../../models/User', () => ({
  User: {
    findOne: jest.fn(),
  },
  Artisan: { create: jest.fn() },
  Expert: { create: jest.fn() },
  Manufacturer: { create: jest.fn() },
  Admin: { create: jest.fn() },
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-jwt-token'),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mail-1' }),
  })),
}));

const { User } = require('../../../models/User');
const authController = require('../../../controllers/authController');

const createFindOneQuery = ({ resolvedValue, rejectedError } = {}) => {
  const execution = rejectedError
    ? Promise.reject(rejectedError)
    : Promise.resolve(resolvedValue);

  return {
    select: jest.fn().mockReturnThis(),
    then: execution.then.bind(execution),
    catch: execution.catch.bind(execution),
    finally: execution.finally.bind(execution),
  };
};

describe('authController (unit)', () => {
  describe('loginUser', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const user = buildUser({
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(undefined),
      });
      User.findOne.mockReturnValue(createFindOneQuery({ resolvedValue: user }));
      const req = createMockReq({ body: validLoginPayload() });
      const res = createMockRes();

      // Act
      await authController.loginUser(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalled();
      expect(user.matchPassword).toHaveBeenCalledWith('Password123!');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        email: 'artisan@example.com',
        token: 'signed-jwt-token',
      }));
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    it('should reject invalid inputs when email or password is missing', async () => {
      // Arrange
      const req = createMockReq({ body: { email: '' } });
      const res = createMockRes();

      // Act
      await authController.loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email and password are required' });
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      const user = buildUser({
        matchPassword: jest.fn().mockResolvedValue(false),
      });
      User.findOne.mockReturnValue(createFindOneQuery({ resolvedValue: user }));
      const req = createMockReq({ body: validLoginPayload() });
      const res = createMockRes();

      // Act
      await authController.loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('should return 500 on database/service failure', async () => {
      // Arrange
      User.findOne.mockReturnValue(
        createFindOneQuery({ rejectedError: new Error('db unavailable') })
      );
      const req = createMockReq({ body: validLoginPayload() });
      const res = createMockRes();

      // Act
      await authController.loginUser(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Server error' });
    });
  });

  describe('adminLogin', () => {
    it('should reject request without secret key', async () => {
      // Arrange
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      // Act
      await authController.adminLogin(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Admin secret key is required' });
    });

    it('should reject invalid admin secret key', async () => {
      // Arrange
      const req = createMockReq({ body: validAdminSecretPayload({ secretKey: 'wrong-key' }) });
      const res = createMockRes();

      // Act
      await authController.adminLogin(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid admin secret key' });
    });

    it('should allow super admin login when secret is valid', async () => {
      // Arrange
      const req = createMockReq({ body: validAdminSecretPayload() });
      const res = createMockRes();

      // Act
      await authController.adminLogin(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        role: 'admin',
        token: 'signed-jwt-token',
        isSuperAdmin: true,
      }));
    });
  });
});
