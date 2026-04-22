jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/quoteController', () => ({
  generateQuoteDraft: jest.fn(),
  createQuote: jest.fn(),
  getQuotes: jest.fn(),
  updateQuoteStatus: jest.fn(),
  downloadQuotePdf: jest.fn(),
  deleteQuote: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/quoteController');
const router = require('../../../routes/quoteRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('quoteRoutes', () => {
  test('registers quote endpoints with auth', () => {
    expect(getRouteHandlers(router, 'POST', '/ai-draft')).toEqual([protect, controller.generateQuoteDraft]);
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, controller.createQuote]);
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getQuotes]);
    expect(getRouteHandlers(router, 'GET', '/:id/pdf')).toEqual([protect, controller.downloadQuotePdf]);
    expect(getRouteHandlers(router, 'PUT', '/:id/status')).toEqual([protect, controller.updateQuoteStatus]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, controller.deleteQuote]);
  });
});

