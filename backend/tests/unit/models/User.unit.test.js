const bcrypt = require('bcryptjs');
const { User } = require('../../../models/User');

const runPreSaveHooks = async (doc) => {
  const preSaveHooks = User.schema.s.hooks._pres.get('save') || [];
  for (const hook of preSaveHooks) {
    await hook.fn.call(doc);
  }
};

describe('User model', () => {
  const validPayload = () => ({
    firstName: 'Ali',
    lastName: 'Ben',
    email: 'ali@example.com',
    password: 'secret123',
  });

  test('validateSync -> fails when required base fields are missing', () => {
    const doc = new User({});
    const err = doc.validateSync();

    expect(err.errors.firstName).toBeDefined();
    expect(err.errors.lastName).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  test('defaults -> role and status are initialized', () => {
    const doc = new User(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.role).toBe('user');
    expect(doc.status).toBe('active');
    expect(doc.isVerified).toBe(false);
  });

  test('validateSync -> rejects invalid email format', () => {
    const doc = new User({ ...validPayload(), email: 'not-an-email' });
    const err = doc.validateSync();

    expect(err.errors.email).toBeDefined();
  });

  test('pre-save hook -> hashes password when modified', async () => {
    const doc = new User(validPayload());
    const originalPassword = doc.password;

    await runPreSaveHooks(doc);

    expect(doc.password).not.toBe(originalPassword);
    expect(doc.password.length).toBeGreaterThan(20);
  });

  test('matchPassword -> returns true for valid password hash', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    const doc = new User({ ...validPayload(), password: hash });

    const isMatch = await doc.matchPassword('secret123');

    expect(isMatch).toBe(true);
  });
});
