const { User } = require('../../../models/User');

const buildValidUser = (overrides = {}) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  password: 'Password123!',
  role: 'artisan',
  ...overrides,
});

const getPasswordHook = () => {
  const saveHooks = User.schema.s.hooks._pres.get('save') || [];
  return saveHooks.find((hook) => {
    const fnText = String(hook.fn || '');
    return fnText.includes('isModified') && fnText.includes('bcrypt');
  })?.fn;
};

describe('User model (unit)', () => {
  it('should hash password via pre-save hook and match hashed password', async () => {
    // Arrange
    const user = new User(buildValidUser({ password: 'MySecret123!' }));
    const plainPassword = user.password;
    const passwordHook = getPasswordHook();

    // Act
    await passwordHook.call(user);

    // Assert
    expect(user.password).not.toBe(plainPassword);
    expect(user.password.length).toBeGreaterThan(20);
    await expect(user.matchPassword('MySecret123!')).resolves.toBe(true);
    await expect(user.matchPassword('wrong-password')).resolves.toBe(false);
  });

  it('should reject invalid email and required fields during validation', () => {
    // Arrange
    const user = new User(buildValidUser({ email: 'not-an-email', firstName: '' }));

    // Act
    const error = user.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.email).toBeDefined();
    expect(error.errors.firstName).toBeDefined();
  });

  it('should apply field transforms such as empty phone to undefined', () => {
    // Arrange
    const user = new User(buildValidUser({ phone: '' }));

    // Act
    const error = user.validateSync();

    // Assert
    expect(error).toBeUndefined();
    expect(user.phone).toBeUndefined();
  });

  it('should enforce role and adminType enum constraints', () => {
    // Arrange
    const invalidRole = new User(buildValidUser({ role: 'owner' }));
    const invalidAdminType = new User(buildValidUser({ role: 'admin', adminType: 'root' }));

    // Act
    const roleError = invalidRole.validateSync();
    const adminTypeError = invalidAdminType.validateSync();

    // Assert
    expect(roleError.errors.role).toBeDefined();
    expect(adminTypeError.errors.adminType).toBeDefined();
  });
});
