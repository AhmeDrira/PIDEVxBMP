process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-test-secret';

afterEach(() => {
  jest.clearAllMocks();
});
