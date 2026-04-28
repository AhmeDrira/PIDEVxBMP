jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
  admin: jest.fn(),
}));

jest.mock('../../../controllers/reportController', () => ({
  createReport: jest.fn(),
  getMyReports: jest.fn(),
  getAdminReports: jest.fn(),
  updateReportStatus: jest.fn(),
}));

const { protect, admin } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/reportController');
const router = require('../../../routes/reportRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('reportRoutes', () => {
  test('registers report endpoints with role-based guards', () => {
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, controller.createReport]);
    expect(getRouteHandlers(router, 'GET', '/me')).toEqual([protect, controller.getMyReports]);
    expect(getRouteHandlers(router, 'GET', '/admin')).toEqual([protect, admin, controller.getAdminReports]);
    expect(getRouteHandlers(router, 'PATCH', '/admin/:id/status')).toEqual([
      protect,
      admin,
      controller.updateReportStatus,
    ]);
  });
});

