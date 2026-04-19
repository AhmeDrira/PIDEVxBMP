const validLoginPayload = (overrides = {}) => ({
  email: 'artisan@example.com',
  password: 'Password123!',
  ...overrides,
});

const validAdminSecretPayload = (overrides = {}) => ({
  secretKey: 'admin-test-secret',
  ...overrides,
});

module.exports = {
  validLoginPayload,
  validAdminSecretPayload,
};
