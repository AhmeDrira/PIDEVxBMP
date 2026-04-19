const { createMockReq, createMockRes } = require('../mocks/http.mock');

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

const createFindByIdQuery = ({ resolvedValue, rejectedError } = {}) => {
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

describe('authMiddleware (unit)', () => {
  it('should allow valid admin token and inject super admin permissions', async () => {
    // Arrange
    jwt.verify.mockReturnValue({ role: 'admin' });
    const req = createMockReq({
      headers: { authorization: 'Bearer admin-token' },
    });
    const res = createMockRes();
    const next = jest.fn();

    // Act
    await protect(req, res, next);

    // Assert
    expect(jwt.verify).toHaveBeenCalledWith('admin-token', process.env.JWT_SECRET);
    expect(req.user).toEqual(expect.objectContaining({ role: 'admin', isSuperAdmin: true }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should allow valid regular token when user exists', async () => {
    // Arrange
    jwt.verify.mockReturnValue({ id: 'user-1' });
    User.findById.mockReturnValue(
      createFindByIdQuery({ resolvedValue: { _id: 'user-1', role: 'artisan' } })
    );
    const req = createMockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = createMockRes();
    const next = jest.fn();

    // Act
    await protect(req, res, next);

    // Assert
    expect(User.findById).toHaveBeenCalledWith('user-1');
    expect(req.user).toEqual(expect.objectContaining({ _id: 'user-1', role: 'artisan' }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should reject request when token is missing', async () => {
    // Arrange
    const req = createMockReq({ headers: {} });
    const res = createMockRes();
    const next = jest.fn();

    // Act
    await protect(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid or expired JWT token', async () => {
    // Arrange
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const req = createMockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = createMockRes();
    const next = jest.fn();

    // Act
    await protect(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject token when user lookup returns no record', async () => {
    // Arrange
    jwt.verify.mockReturnValue({ id: 'missing-user' });
    User.findById.mockReturnValue(createFindByIdQuery({ resolvedValue: null }));
    const req = createMockReq({ headers: { authorization: 'Bearer user-token' } });
    const res = createMockRes();
    const next = jest.fn();

    // Act
    await protect(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should enforce admin and superAdminOnly guards', () => {
    // Arrange
    const res = createMockRes();
    const next = jest.fn();

    // Act
    admin(createMockReq({ user: { role: 'artisan' } }), res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    // Arrange
    const superRes = createMockRes();
    const superNext = jest.fn();

    // Act
    superAdminOnly(createMockReq({ user: { role: 'admin', adminType: 'super' } }), superRes, superNext);

    // Assert
    expect(superNext).toHaveBeenCalledTimes(1);
  });
});
