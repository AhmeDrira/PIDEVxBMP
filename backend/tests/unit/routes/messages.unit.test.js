jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/messageController', () => ({
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
  deleteMessage: jest.fn(),
  uploadAttachments: jest.fn(),
  toggleReaction: jest.fn(),
  uploadVoice: jest.fn(),
  sendVoiceMessage: jest.fn(),
  generateAIDraftMessage: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/messageController');
const router = require('../../../routes/messages');
const { getRouteHandlers } = require('./routeTestUtils');

describe('messages routes', () => {
  test('registers all message endpoints with expected chain', () => {
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getMessages]);
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([
      protect,
      controller.uploadAttachments,
      controller.sendMessage,
    ]);
    expect(getRouteHandlers(router, 'POST', '/ai-generate')).toEqual([
      protect,
      controller.generateAIDraftMessage,
    ]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, controller.deleteMessage]);
    expect(getRouteHandlers(router, 'POST', '/:id/reaction')).toEqual([protect, controller.toggleReaction]);
    expect(getRouteHandlers(router, 'POST', '/voice')).toEqual([
      protect,
      controller.uploadVoice,
      controller.sendVoiceMessage,
    ]);
  });
});

