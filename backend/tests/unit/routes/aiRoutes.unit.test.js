jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/aiController', () => ({
  projectAutofill: jest.fn(),
  copilotChat: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const { projectAutofill, copilotChat } = require('../../../controllers/aiController');
const router = require('../../../routes/aiRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('aiRoutes', () => {
  test('maps project-autofill and copilot-chat behind auth', () => {
    expect(getRouteHandlers(router, 'POST', '/project-autofill')).toEqual([protect, projectAutofill]);
    expect(getRouteHandlers(router, 'POST', '/copilot-chat')).toEqual([protect, copilotChat]);
  });
});

