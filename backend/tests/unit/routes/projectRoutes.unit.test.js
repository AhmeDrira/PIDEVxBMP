const mockSingle = jest.fn(() => jest.fn());

jest.mock('../../../middleware/uploadMiddleware', () => ({
  single: mockSingle,
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/projectController', () => ({
  createProject: jest.fn(),
  getProjects: jest.fn(),
  getExpertProjects: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  uploadPersonalMaterialImage: jest.fn(),
}));

jest.mock('../../../controllers/recommendationController', () => ({
  getMaterialRecommendations: jest.fn(),
}));

const upload = require('../../../middleware/uploadMiddleware');
const { protect } = require('../../../middleware/authMiddleware');
const projectController = require('../../../controllers/projectController');
const { getMaterialRecommendations } = require('../../../controllers/recommendationController');
const router = require('../../../routes/projectRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('projectRoutes', () => {
  test('registers CRUD and recommendation routes with expected middleware', () => {
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, projectController.createProject]);
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, projectController.getProjects]);
    expect(getRouteHandlers(router, 'GET', '/expert/:expertId')).toEqual([
      protect,
      projectController.getExpertProjects,
    ]);
    expect(getRouteHandlers(router, 'PUT', '/:id')).toEqual([protect, projectController.updateProject]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, projectController.deleteProject]);

    const handlers = getRouteHandlers(router, 'POST', '/:id/personal-materials/:materialId/image');
    expect(typeof upload.single).toBe('function');
    expect(handlers).toHaveLength(3);
    expect(handlers[0]).toBe(protect);
    expect(typeof handlers[1]).toBe('function');
    expect(handlers[2]).toBe(projectController.uploadPersonalMaterialImage);

    expect(getRouteHandlers(router, 'POST', '/:projectId/material-recommendations')).toEqual([
      protect,
      getMaterialRecommendations,
    ]);
  });
});

