jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/analyticsController', () => ({
  trackMissingProduct: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const { trackMissingProduct } = require('../../../controllers/analyticsController');
const router = require('../../../routes/analyticsRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('analyticsRoutes', () => {
  test('registers missing-product endpoint with auth', () => {
    expect(getRouteHandlers(router, 'POST', '/missing-product')).toEqual([protect, trackMissingProduct]);
  });
});

