jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/quoteController', () => ({
  getQuoteTemplates: jest.fn(),
  computeQuoteTemplateLines: jest.fn(),
  readPlanFile: jest.fn(),
  detectTradeFromDescription: jest.fn(),
  mapPlanReadingToTemplate: jest.fn(),
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
    expect(getRouteHandlers(router, 'GET', '/templates')).toEqual([protect, controller.getQuoteTemplates]);
    expect(getRouteHandlers(router, 'POST', '/templates/:id/compute')).toEqual([protect, controller.computeQuoteTemplateLines]);

    // La lecture du plan passe par multer, insere entre `protect` et le controleur.
    const lecture = getRouteHandlers(router, 'POST', '/plan-reading');
    expect(lecture[0]).toBe(protect);
    expect(lecture[lecture.length - 1]).toBe(controller.readPlanFile);
    expect(lecture).toHaveLength(3);

    // La detection de metier ne lit qu'un texte : ni fichier, ni modele.
    expect(getRouteHandlers(router, 'POST', '/detect-trade'))
      .toEqual([protect, controller.detectTradeFromDescription]);

    // La projection, elle, ne recoit aucun fichier : pas de multer.
    expect(getRouteHandlers(router, 'POST', '/templates/:id/map-reading'))
      .toEqual([protect, controller.mapPlanReadingToTemplate]);
    expect(getRouteHandlers(router, 'POST', '/ai-draft')).toEqual([protect, controller.generateQuoteDraft]);
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, controller.createQuote]);
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getQuotes]);
    expect(getRouteHandlers(router, 'GET', '/:id/pdf')).toEqual([protect, controller.downloadQuotePdf]);
    expect(getRouteHandlers(router, 'PUT', '/:id/status')).toEqual([protect, controller.updateQuoteStatus]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, controller.deleteQuote]);
  });
});

