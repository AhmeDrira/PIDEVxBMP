const path = require('path');

const mockCertUploadMw = jest.fn();
const mockSingle = jest.fn(() => mockCertUploadMw);
const mockMulter = jest.fn(() => ({ single: mockSingle }));
mockMulter.diskStorage = jest.fn((config) => config);

const mockRateLimit = jest.fn((options) => {
  const middleware = jest.fn();
  middleware.__options = options;
  return middleware;
});

jest.mock('multer', () => mockMulter);
jest.mock('express-rate-limit', () => mockRateLimit);

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
  admin: jest.fn(),
  superAdminOnly: jest.fn(),
}));

jest.mock('../../../controllers/authController', () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  googleLogin: jest.fn(),
  adminLogin: jest.fn(),
  createSubAdmin: jest.fn(),
  getMe: jest.fn(),
  checkEmail: jest.fn(),
  checkPhone: jest.fn(),
  checkResetOptions: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
  updatePassword: jest.fn(),
  subAdminForgotPassword: jest.fn(),
  resetSubAdminPassword: jest.fn(),
  updateSubAdminPermissions: jest.fn(),
  sendPhoneVerification: jest.fn(),
  verifyPhone: jest.fn(),
  forgotPasswordPhone: jest.fn(),
  resetPasswordPhone: jest.fn(),
  updateProfile: jest.fn(),
  requestEmailChange: jest.fn(),
  confirmEmailChange: jest.fn(),
  faceLogin: jest.fn(),
  saveFaceDescriptor: jest.fn(),
  deleteFaceDescriptor: jest.fn(),
  getFaceDescriptorStatus: jest.fn(),
  getPendingManufacturers: jest.fn(),
  approveManufacturer: jest.fn(),
  rejectManufacturer: jest.fn(),
  listUsers: jest.fn(),
  suspendUser: jest.fn(),
  activateUser: jest.fn(),
  deleteUser: jest.fn(),
  getCertificationFile: jest.fn(),
}));

const fs = require('fs');
const authController = require('../../../controllers/authController');
const { protect, admin, superAdminOnly } = require('../../../middleware/authMiddleware');
const router = require('../../../routes/authRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('authRoutes', () => {
  test('configures login and face rate limiters with expected thresholds', () => {
    jest.isolateModules(() => {
      const rateLimit = require('express-rate-limit');
      const routerLocal = require('../../../routes/authRoutes');
      const authControllerLocal = require('../../../controllers/authController');

      expect(rateLimit).toHaveBeenCalledTimes(2);

      const loginLimiter = rateLimit.mock.results[0].value;
      const faceLimiter = rateLimit.mock.results[1].value;

      expect(loginLimiter.__options.max).toBe(10);
      expect(loginLimiter.__options.windowMs).toBe(15 * 60 * 1000);
      expect(faceLimiter.__options.max).toBe(50);
      expect(faceLimiter.__options.windowMs).toBe(15 * 60 * 1000);

      expect(getRouteHandlers(routerLocal, 'POST', '/login')).toEqual([loginLimiter, authControllerLocal.loginUser]);
      expect(getRouteHandlers(routerLocal, 'POST', '/admin/login')).toEqual([
        loginLimiter,
        authControllerLocal.adminLogin,
      ]);
      expect(getRouteHandlers(routerLocal, 'POST', '/admin/subadmins')).toEqual([
        loginLimiter,
        authControllerLocal.createSubAdmin,
      ]);
      expect(getRouteHandlers(routerLocal, 'POST', '/face-login')).toEqual([
        faceLimiter,
        authControllerLocal.faceLogin,
      ]);
    });
  });

  test('configures certification upload storage and register multipart endpoint', () => {
    jest.isolateModules(() => {
      const fsLocal = require('fs');
      const multerLocal = require('multer');
      const routerLocal = require('../../../routes/authRoutes');
      const authControllerLocal = require('../../../controllers/authController');

      expect(multerLocal.diskStorage).toHaveBeenCalledTimes(1);
      expect(multerLocal).toHaveBeenCalledWith({ storage: expect.any(Object) });
      expect(mockSingle).toHaveBeenCalledWith('certificationFile');

      const certStorage = multerLocal.diskStorage.mock.calls[0][0];

      fsLocal.existsSync.mockReturnValue(false);
      const destinationCb = jest.fn();
      certStorage.destination({}, {}, destinationCb);
      expect(fsLocal.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(`${path.sep}uploads${path.sep}certifications`),
        { recursive: true }
      );
      expect(destinationCb).toHaveBeenCalledWith(
        null,
        expect.stringContaining(`${path.sep}uploads${path.sep}certifications`)
      );

      const filenameCb = jest.fn();
      certStorage.filename({}, { originalname: 'doc.pdf' }, filenameCb);
      expect(filenameCb).toHaveBeenCalledWith(null, expect.stringMatching(/^cert-\d+\.pdf$/));

      expect(getRouteHandlers(routerLocal, 'POST', '/register')).toEqual([
        mockCertUploadMw,
        authControllerLocal.registerUser,
      ]);
    });
  });

  test('wires protected, admin and super-admin sensitive endpoints', () => {
    expect(getRouteHandlers(router, 'POST', '/update-password')).toEqual([
      protect,
      authController.updatePassword,
    ]);
    expect(getRouteHandlers(router, 'GET', '/profile')).toEqual([protect, authController.getMe]);
    expect(getRouteHandlers(router, 'PUT', '/profile')).toEqual([protect, authController.updateProfile]);
    expect(getRouteHandlers(router, 'GET', '/me')).toEqual([protect, authController.getMe]);

    expect(getRouteHandlers(router, 'GET', '/admin/manufacturers/pending')).toEqual([
      protect,
      admin,
      authController.getPendingManufacturers,
    ]);
    expect(getRouteHandlers(router, 'POST', '/admin/manufacturers/:id/approve')).toEqual([
      protect,
      admin,
      authController.approveManufacturer,
    ]);
    expect(getRouteHandlers(router, 'POST', '/admin/manufacturers/:id/decline')).toEqual([
      protect,
      admin,
      authController.rejectManufacturer,
    ]);

    expect(getRouteHandlers(router, 'GET', '/admin/users')).toEqual([protect, admin, authController.listUsers]);
    expect(getRouteHandlers(router, 'POST', '/admin/users/:id/suspend')).toEqual([
      protect,
      admin,
      authController.suspendUser,
    ]);
    expect(getRouteHandlers(router, 'POST', '/admin/users/:id/activate')).toEqual([
      protect,
      admin,
      authController.activateUser,
    ]);
    expect(getRouteHandlers(router, 'DELETE', '/admin/users/:id')).toEqual([
      protect,
      admin,
      authController.deleteUser,
    ]);

    expect(getRouteHandlers(router, 'POST', '/admin/subadmins/:id/reset-password')).toEqual([
      protect,
      admin,
      superAdminOnly,
      authController.resetSubAdminPassword,
    ]);
    expect(getRouteHandlers(router, 'PUT', '/admin/subadmins/:id/permissions')).toEqual([
      protect,
      admin,
      superAdminOnly,
      authController.updateSubAdminPermissions,
    ]);
  });
});

