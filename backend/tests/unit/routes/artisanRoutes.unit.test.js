const path = require('path');

const mockPortfolioUploadMw = jest.fn();
const mockArray = jest.fn(() => mockPortfolioUploadMw);
const mockMulter = jest.fn(() => ({ array: mockArray }));
mockMulter.diskStorage = jest.fn((config) => config);

jest.mock('multer', () => mockMulter);

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/artisanController', () => ({
  getAllArtisans: jest.fn(),
  getArtisanById: jest.fn(),
  searchArtisans: jest.fn(),
  getMyPortfolio: jest.fn(),
  addPortfolioItem: jest.fn(),
  addPortfolioItemFromProject: jest.fn(),
  updatePortfolioItem: jest.fn(),
  deletePortfolioItem: jest.fn(),
  addMediaToPortfolioItem: jest.fn(),
  getPortfolioItemById: jest.fn(),
  getArtisanPortfolio: jest.fn(),
  getArtisanReviews: jest.fn(),
  addArtisanReview: jest.fn(),
  getPublicPortfolioItem: jest.fn(),
  aiSearchArtisans: jest.fn(),
}));

const fs = require('fs');
const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/artisanController');
const router = require('../../../routes/artisanRoutes');
const { getRouteHandlers, findRouteLayer } = require('./routeTestUtils');

describe('artisanRoutes', () => {
  test('configures portfolio multer storage and upload middleware', () => {
    jest.isolateModules(() => {
      const fsLocal = require('fs');
      const multerLocal = require('multer');
      require('../../../routes/artisanRoutes');

      expect(multerLocal.diskStorage).toHaveBeenCalledTimes(1);
      expect(multerLocal).toHaveBeenCalledWith({
        storage: expect.any(Object),
        limits: { fileSize: 120 * 1024 * 1024 },
      });

      expect(mockArray).toHaveBeenCalledWith('mediaFiles', 12);
      expect(mockArray).toHaveBeenCalledTimes(2);

      const storage = multerLocal.diskStorage.mock.calls[0][0];

      fsLocal.existsSync.mockReturnValue(false);
      const destinationCb = jest.fn();
      storage.destination({}, {}, destinationCb);

      expect(fsLocal.existsSync).toHaveBeenCalled();
      expect(fsLocal.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(`${path.sep}uploads${path.sep}portfolio`), {
        recursive: true,
      });
      expect(destinationCb).toHaveBeenCalledWith(
        null,
        expect.stringContaining(`${path.sep}uploads${path.sep}portfolio`)
      );

      const filenameCb = jest.fn();
      storage.filename({}, { originalname: 'image.jpeg' }, filenameCb);
      expect(filenameCb).toHaveBeenCalledWith(null, expect.stringMatching(/^portfolio-\d+-\d+\.jpeg$/));
    });
  });

  test('registers private and public endpoints with expected handlers', () => {
    expect(getRouteHandlers(router, 'GET', '/me/portfolio')).toEqual([protect, controller.getMyPortfolio]);
    expect(getRouteHandlers(router, 'POST', '/me/portfolio')).toEqual([
      protect,
      mockPortfolioUploadMw,
      controller.addPortfolioItem,
    ]);
    expect(getRouteHandlers(router, 'POST', '/me/portfolio/from-project/:projectId')).toEqual([
      protect,
      controller.addPortfolioItemFromProject,
    ]);
    expect(getRouteHandlers(router, 'PUT', '/me/portfolio/:itemId')).toEqual([
      protect,
      controller.updatePortfolioItem,
    ]);
    expect(getRouteHandlers(router, 'POST', '/me/portfolio/:itemId/media')).toEqual([
      protect,
      mockPortfolioUploadMw,
      controller.addMediaToPortfolioItem,
    ]);
    expect(getRouteHandlers(router, 'DELETE', '/me/portfolio/:itemId')).toEqual([
      protect,
      controller.deletePortfolioItem,
    ]);
    expect(getRouteHandlers(router, 'GET', '/me/portfolio/:itemId')).toEqual([
      protect,
      controller.getPortfolioItemById,
    ]);

    expect(getRouteHandlers(router, 'GET', '/')).toEqual([controller.getAllArtisans]);
    expect(getRouteHandlers(router, 'POST', '/ai-search')).toEqual([controller.aiSearchArtisans]);
    expect(getRouteHandlers(router, 'GET', '/search')).toEqual([controller.searchArtisans]);
    expect(getRouteHandlers(router, 'GET', '/:id')).toEqual([controller.getArtisanById]);
    expect(getRouteHandlers(router, 'GET', '/:id/portfolio')).toEqual([controller.getArtisanPortfolio]);
    expect(getRouteHandlers(router, 'GET', '/:id/portfolio/:itemId')).toEqual([
      controller.getPublicPortfolioItem,
    ]);
    expect(getRouteHandlers(router, 'GET', '/:id/reviews')).toEqual([controller.getArtisanReviews]);
    expect(getRouteHandlers(router, 'POST', '/:id/reviews')).toEqual([protect, controller.addArtisanReview]);
  });

  test('keeps /search route before /:id to avoid greedy param capture', () => {
    const searchLayer = findRouteLayer(router, 'GET', '/search');
    const idLayer = findRouteLayer(router, 'GET', '/:id');

    const searchIndex = router.stack.indexOf(searchLayer);
    const idIndex = router.stack.indexOf(idLayer);

    expect(searchIndex).toBeGreaterThanOrEqual(0);
    expect(idIndex).toBeGreaterThanOrEqual(0);
    expect(searchIndex).toBeLessThan(idIndex);
  });
});

