const { buildReq, buildRes } = require('../../http.mock');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../../models/User', () => ({
  User: {
    findById: jest.fn(),
  },
}));

const jwt = require('jsonwebtoken');
const { User } = require('../../../models/User');
const { protect, admin, superAdminOnly } = require('../../../middleware/authMiddleware');

const expectStatusBeforeJson = (res, statusCode) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.status).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledTimes(1);
  expect(res.status.mock.invocationCallOrder[0]).toBeLessThan(res.json.mock.invocationCallOrder[0]);
};

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  test('protect -> 401 when no bearer token is provided', async () => {
    const req = buildReq({ headers: {} });
    const res = buildRes();
    const next = jest.fn();

    await protect(req, res, next);

    expectStatusBeforeJson(res, 401);
    expect(res.body.message).toMatch(/no token/i);
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('protect -> 401 when authorization header format is malformed', async () => {
    const req = buildReq({ headers: { authorization: 'Token abc123' } });
    const res = buildRes();
    const next = jest.fn();

    await protect(req, res, next);

    expectStatusBeforeJson(res, 401);
    expect(res.body.message).toMatch(/no token/i);
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('protect -> grants super-admin context for admin token payload', async () => {
    jwt.verify.mockReturnValue({ role: 'admin' });

    const req = buildReq({ headers: { authorization: 'Bearer token123' } });
    const res = buildRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('token123', 'unit-secret');
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.role).toBe('admin');
    expect(req.user.isSuperAdmin).toBe(true);
    expect(req.user.permissions.canDeleteUsers).toBe(true);
  });

  test('protect -> 401 when decoded user does not exist', async () => {
    jwt.verify.mockReturnValue({ id: 'u1' });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const req = buildReq({ headers: { authorization: 'Bearer token123' } });
    const res = buildRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('token123', 'unit-secret');
    expect(User.findById).toHaveBeenCalledWith('u1');
    expectStatusBeforeJson(res, 401);
    expect(res.body.message).toMatch(/user not found/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('protect -> 401 when bearer token is invalid', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const req = buildReq({ headers: { authorization: 'Bearer invalid-token' } });
    const res = buildRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('invalid-token', 'unit-secret');
    expectStatusBeforeJson(res, 401);
    expect(res.body.message).toMatch(/token failed/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('admin -> 401 when user role is not admin', () => {
    const req = buildReq({ user: { role: 'artisan' } });
    const res = buildRes();
    const next = jest.fn();

    admin(req, res, next);

    expectStatusBeforeJson(res, 401);
    expect(res.body.message).toMatch(/admin/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('superAdminOnly -> allows super admin and blocks sub admin', () => {
    const next = jest.fn();

    const reqAllowed = buildReq({ user: { role: 'admin', isSuperAdmin: true, adminType: 'super' } });
    const resAllowed = buildRes();
    superAdminOnly(reqAllowed, resAllowed, next);
    expect(next).toHaveBeenCalledTimes(1);

    const reqDenied = buildReq({ user: { role: 'admin', isSuperAdmin: false, adminType: 'sub' } });
    const resDenied = buildRes();
    superAdminOnly(reqDenied, resDenied, next);

    expectStatusBeforeJson(resDenied, 403);
    expect(resDenied.body.message).toMatch(/super admin/i);
  });
});
