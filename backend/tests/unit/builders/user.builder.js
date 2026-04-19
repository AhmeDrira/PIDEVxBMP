const buildUser = (overrides = {}) => {
  const defaultUser = {
    _id: 'user-001',
    id: 'user-001',
    firstName: 'Test',
    lastName: 'User',
    email: 'artisan@example.com',
    role: 'artisan',
    phone: '20123456',
    status: 'active',
    isVerified: true,
    adminType: undefined,
    permissions: undefined,
    profilePhoto: '',
    matchPassword: async () => true,
    save: async () => undefined,
  };

  return {
    ...defaultUser,
    ...overrides,
  };
};

module.exports = {
  buildUser,
};
