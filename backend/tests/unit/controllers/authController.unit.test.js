const { createMockReq, createMockRes, chainableQuery } = require('../mocks/http.mock');
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

jest.mock('../../../services/DomainService', () => ({
  ensureDomainForArtisan: jest.fn(),
  buildMiniSiteUrl: jest.fn((slug) => `https://${slug}.bmp.tn`),
}));

jest.mock('../../../models/ArtisanDomain', () => ({
  findOne: jest.fn(),
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

const { User, Artisan } = require('../../../models/User');
const DomainService = require('../../../services/DomainService');
const ArtisanDomain = require('../../../models/ArtisanDomain');
const nodemailer = require('nodemailer');
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

  describe('registerUser -> creation du mini site artisan', () => {
    const registerArtisan = async () => {
      const req = createMockReq({
        body: {
          firstName: 'Hamza',
          lastName: 'Ayachi',
          email: 'hamza@example.com',
          password: 'secret123',
          role: 'artisan',
        },
      });
      const res = createMockRes();
      await authController.registerUser(req, res);
      return res;
    };

    beforeEach(() => {
      User.findOne.mockResolvedValue(null); // aucun compte existant sur cet email
      Artisan.create.mockResolvedValue({
        id: 'artisan-1',
        _id: 'artisan-1',
        firstName: 'Hamza',
        lastName: 'Ayachi',
        email: 'hamza@example.com',
        role: 'artisan',
      });
    });

    it('should create the mini site for a new artisan', async () => {
      DomainService.ensureDomainForArtisan.mockResolvedValue({ slug: 'hamza-ayachi' });

      const res = await registerArtisan();

      expect(DomainService.ensureDomainForArtisan).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'artisan-1' })
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.slug).toBe('hamza-ayachi');
    });

    it('should still register the artisan when the mini site creation fails', async () => {
      // Regle metier : le mini site ne doit JAMAIS faire echouer une inscription.
      DomainService.ensureDomainForArtisan.mockRejectedValue(new Error('Mongo down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await registerArtisan();

      expect(res.statusCode).toBe(201);
      expect(res.body.slug).toBeUndefined();
      expect(res.body.email).toBe('hamza@example.com');
    });

    it('should omit the slug when no mini site could be created', async () => {
      DomainService.ensureDomainForArtisan.mockResolvedValue(null);

      const res = await registerArtisan();

      expect(res.statusCode).toBe(201);
      expect(res.body).not.toHaveProperty('slug');
    });

    it('should not create a mini site for a non-artisan role', async () => {
      const req = createMockReq({
        body: {
          firstName: 'Eya',
          lastName: 'Expert',
          email: 'eya@example.com',
          password: 'secret123',
          role: 'expert',
        },
      });
      const res = createMockRes();

      await authController.registerUser(req, res);

      expect(DomainService.ensureDomainForArtisan).not.toHaveBeenCalled();
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

describe('authController — welcome email announcing the mini site', () => {
  const buildArtisan = (overrides = {}) => ({
    _id: 'artisan-1',
    role: 'artisan',
    email: 'sonia@example.com',
    firstName: 'Sonia',
    isVerified: false,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  /** Recupere le contenu du dernier email envoye via nodemailer. */
  const lastMail = () => {
    const transport = nodemailer.createTransport.mock.results.at(-1)?.value;
    return transport?.sendMail.mock.calls.at(-1)?.[0];
  };

  beforeEach(() => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';
    ArtisanDomain.findOne.mockReturnValue(chainableQuery({ slug: 'sonia-bouzid' }));
  });

  describe('verifyEmail', () => {
    const verify = async (user) => {
      User.findOne.mockResolvedValue(user);
      const req = createMockReq({ body: { token: 'raw-token' }, headers: { host: 'app.bmp.tn' } });
      const res = createMockRes();
      await authController.verifyEmail(req, res);
      return res;
    };

    it('should send the welcome email once the artisan account is verified', async () => {
      const res = await verify(buildArtisan());

      expect(res.statusCode).toBe(200);
      const mail = lastMail();
      expect(mail.to).toBe('sonia@example.com');
      expect(mail.html).toContain('https://sonia-bouzid.bmp.tn');
      expect(mail.html).toContain('already online');
    });

    it('should greet the artisan by first name', async () => {
      await verify(buildArtisan());

      expect(lastMail().html).toContain('Welcome Sonia!');
    });

    it('should not send a mini site email to a non-artisan', async () => {
      await verify(buildArtisan({ role: 'expert' }));

      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
      expect(lastMail()).toBeUndefined();
    });

    it('should still verify the account when the email fails', async () => {
      // Regle metier : un echec d'envoi ne doit jamais bloquer la verification.
      ArtisanDomain.findOne.mockImplementation(() => {
        throw new Error('Mongo down');
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await verify(buildArtisan());

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/verified successfully/i);
    });

    it('should omit the mini site block when the artisan has no domain yet', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(null));

      await verify(buildArtisan());

      const mail = lastMail();
      expect(mail.html).not.toContain('already online');
      expect(mail.html).toContain('Complete my profile');
    });

    it('should return 400 without sending anything for an invalid token', async () => {
      User.findOne.mockResolvedValue(null);
      const req = createMockReq({ body: { token: 'bad' }, headers: {} });
      const res = createMockRes();

      await authController.verifyEmail(req, res);

      expect(res.statusCode).toBe(400);
      expect(lastMail()).toBeUndefined();
    });
  });
});

describe('authController — isFirstLogin flag', () => {
  const login = async (user) => {
    User.findOne.mockReturnValue(createFindOneQuery({ resolvedValue: user }));
    const res = createMockRes();
    await authController.loginUser(createMockReq({ body: validLoginPayload() }), res);
    return res;
  };

  it('should report isFirstLogin true when the user never logged in', async () => {
    const res = await login(buildUser({
      lastLoginAt: null,
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    }));

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isFirstLogin: true }));
  });

  it('should report isFirstLogin false on subsequent logins', async () => {
    const res = await login(buildUser({
      lastLoginAt: new Date('2026-01-01'),
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    }));

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isFirstLogin: false }));
  });

  it('should capture the flag before overwriting lastLoginAt', async () => {
    // Le piege : lastLoginAt est ecrase juste avant la reponse. Si la capture
    // se faisait apres, isFirstLogin serait toujours false.
    const user = buildUser({
      lastLoginAt: null,
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(undefined),
    });

    const res = await login(user);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isFirstLogin: true }));
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });
});
