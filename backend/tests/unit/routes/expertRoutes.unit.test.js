jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/expertController', () => ({
  getCurrentExpert: jest.fn(),
  updateExpertProfile: jest.fn(),
}));

const { buildReq, buildRes } = require('../../http.mock');
const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/expertController');
const router = require('../../../routes/expertRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('expertRoutes', () => {
  test('wires protected profile routes', () => {
    expect(getRouteHandlers(router, 'GET', '/me')).toEqual([protect, controller.getCurrentExpert]);
    expect(getRouteHandlers(router, 'PUT', '/me')).toEqual([protect, controller.updateExpertProfile]);
  });

  test('GET /test inline handler returns ok payload', () => {
    const handlers = getRouteHandlers(router, 'GET', '/test');
    const req = buildReq();
    const res = buildRes();

    handlers[0](req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'ok' });
  });
});

