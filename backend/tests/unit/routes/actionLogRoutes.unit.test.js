jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
  admin: jest.fn(),
}));

jest.mock('../../../controllers/actionLogController', () => ({
  listActionLogs: jest.fn(),
  deleteActionLog: jest.fn(),
  deleteManyActionLogs: jest.fn(),
}));

const { protect, admin } = require('../../../middleware/authMiddleware');
const {
  listActionLogs,
  deleteActionLog,
  deleteManyActionLogs,
} = require('../../../controllers/actionLogController');
const router = require('../../../routes/actionLogRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('actionLogRoutes', () => {
  test('registers all admin-protected endpoints', () => {
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, admin, listActionLogs]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, admin, deleteActionLog]);
    expect(getRouteHandlers(router, 'POST', '/bulk-delete')).toEqual([
      protect,
      admin,
      deleteManyActionLogs,
    ]);
  });
});

