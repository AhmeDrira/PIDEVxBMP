const jwt = require('jsonwebtoken');
const { Artisan, Expert, Manufacturer, Admin } = require('../../../models/User');

const ensureSecret = () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
  process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-test-secret';
};

const signTokenFor = (user) => {
  ensureSecret();
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const signSuperAdminToken = () => {
  ensureSecret();
  return jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const baseUserDefaults = (overrides = {}) => ({
  password: 'Password123!',
  isVerified: true,
  ...overrides,
});

const createArtisan = async (overrides = {}) =>
  Artisan.create({
    firstName: 'Art',
    lastName: 'User',
    email: `artisan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    location: '',
    domain: '',
    role: 'artisan',
    ...baseUserDefaults(overrides),
  });

const createExpert = async (overrides = {}) =>
  Expert.create({
    firstName: 'Ex',
    lastName: 'Pert',
    email: `expert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'expert',
    ...baseUserDefaults(overrides),
  });

const createManufacturer = async (overrides = {}) =>
  Manufacturer.create({
    firstName: 'Manu',
    lastName: 'Facturer',
    email: `manuf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'manufacturer',
    verificationStatus: 'approved',
    ...baseUserDefaults(overrides),
  });

const createAdmin = async (overrides = {}) =>
  Admin.create({
    firstName: 'Adm',
    lastName: 'In',
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
    adminType: 'sub',
    ...baseUserDefaults(overrides),
  });

const authHeader = (user) => ({ Authorization: `Bearer ${signTokenFor(user)}` });

module.exports = {
  signTokenFor,
  signSuperAdminToken,
  createArtisan,
  createExpert,
  createManufacturer,
  createAdmin,
  authHeader,
};
