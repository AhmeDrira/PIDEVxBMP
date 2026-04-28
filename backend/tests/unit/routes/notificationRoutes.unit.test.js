jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
  admin: jest.fn(),
}));

jest.mock('../../../controllers/notificationController', () => ({
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  deleteAll: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/notificationController');
const router = require('../../../routes/notificationRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('notificationRoutes', () => {
  test('registers notification endpoints under auth', () => {
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getNotifications]);
    expect(getRouteHandlers(router, 'GET', '/unread-count')).toEqual([protect, controller.getUnreadCount]);
    expect(getRouteHandlers(router, 'PUT', '/read-all')).toEqual([protect, controller.markAllRead]);
    expect(getRouteHandlers(router, 'DELETE', '/')).toEqual([protect, controller.deleteAll]);
    expect(getRouteHandlers(router, 'PUT', '/:id/read')).toEqual([protect, controller.markRead]);
  });
});

