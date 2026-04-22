jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/aiShopperController', () => ({
  aiShopper: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const { aiShopper } = require('../../../controllers/aiShopperController');
const router = require('../../../routes/recommendationRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('recommendationRoutes', () => {
  test('registers ai-shopper endpoint behind auth', () => {
    expect(getRouteHandlers(router, 'POST', '/ai-shopper')).toEqual([protect, aiShopper]);
  });
});

