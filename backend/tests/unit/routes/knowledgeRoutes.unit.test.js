const path = require('path');

const mockAttachmentsUploadMw = jest.fn();
const mockArray = jest.fn(() => mockAttachmentsUploadMw);
const mockMulter = jest.fn(() => ({ array: mockArray }));
mockMulter.diskStorage = jest.fn((config) => config);

jest.mock('multer', () => mockMulter);

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
  admin: jest.fn(),
}));

jest.mock('../../../controllers/knowledgeController', () => ({
  listArticles: jest.fn(),
  aiSearchArticles: jest.fn(),
  getArticleById: jest.fn(),
  createArticle: jest.fn(),
  updateArticle: jest.fn(),
  likeArticle: jest.fn(),
  deleteArticle: jest.fn(),
}));

const fs = require('fs');
const { protect, admin } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/knowledgeController');
const router = require('../../../routes/knowledgeRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('knowledgeRoutes', () => {
  test('configures attachment upload storage and sanitizes filenames', () => {
    jest.isolateModules(() => {
      const fsLocal = require('fs');
      const multerLocal = require('multer');
      require('../../../routes/knowledgeRoutes');

      expect(multerLocal.diskStorage).toHaveBeenCalledTimes(1);
      expect(multerLocal).toHaveBeenCalledWith({
        storage: expect.any(Object),
        limits: { fileSize: 10 * 1024 * 1024 },
      });

      const storage = multerLocal.diskStorage.mock.calls[0][0];

      fsLocal.existsSync.mockReturnValue(false);
      const destinationCb = jest.fn();
      storage.destination({}, {}, destinationCb);
      expect(fsLocal.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(`${path.sep}uploads${path.sep}knowledge-attachments`),
        { recursive: true }
      );
      expect(destinationCb).toHaveBeenCalledWith(
        null,
        expect.stringContaining(`${path.sep}uploads${path.sep}knowledge-attachments`)
      );

      const filenameCb = jest.fn();
      storage.filename({}, { originalname: 'my résumé 2026!!.pdf' }, filenameCb);
      expect(filenameCb).toHaveBeenCalledWith(null, expect.stringMatching(/^myrsum2026-\d+\.pdf$/));
    });
  });

  test('registers public, protected and admin endpoints correctly', () => {
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([controller.listArticles]);
    expect(getRouteHandlers(router, 'POST', '/ai-search')).toEqual([protect, controller.aiSearchArticles]);
    expect(getRouteHandlers(router, 'GET', '/:id')).toEqual([protect, controller.getArticleById]);
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([
      protect,
      admin,
      mockAttachmentsUploadMw,
      controller.createArticle,
    ]);
    expect(getRouteHandlers(router, 'PUT', '/:id')).toEqual([
      protect,
      admin,
      mockAttachmentsUploadMw,
      controller.updateArticle,
    ]);
    expect(getRouteHandlers(router, 'POST', '/:id/like')).toEqual([protect, controller.likeArticle]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, admin, controller.deleteArticle]);
  });
});

