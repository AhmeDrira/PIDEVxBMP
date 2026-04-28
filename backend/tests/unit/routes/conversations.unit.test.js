jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/conversationController', () => ({
  getConversations: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  getConversationStatus: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/conversationController');
const router = require('../../../routes/conversations');
const { getRouteHandlers } = require('./routeTestUtils');

describe('conversations routes', () => {
  test('registers protected CRUD and moderation endpoints', () => {
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getConversations]);
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, controller.createConversation]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, controller.deleteConversation]);
    expect(getRouteHandlers(router, 'POST', '/:id/block')).toEqual([protect, controller.blockUser]);
    expect(getRouteHandlers(router, 'POST', '/:id/unblock')).toEqual([protect, controller.unblockUser]);
    expect(getRouteHandlers(router, 'GET', '/:id/status')).toEqual([
      protect,
      controller.getConversationStatus,
    ]);
  });
});

