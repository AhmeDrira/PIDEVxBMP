const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Project', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/Product', () => ({
  find: jest.fn(),
}));

jest.mock('../../../services/geminiService', () => ({
  inferCategories: jest.fn(),
  generateRecommendations: jest.fn(),
  getActiveModelName: jest.fn(),
  getActiveApiVersion: jest.fn(),
}));

const Project = require('../../../models/Project');
const Product = require('../../../models/Product');
const geminiService = require('../../../services/geminiService');
const { aiShopper } = require('../../../controllers/aiShopperController');

describe('aiShopperController', () => {
  test('aiShopper -> 400 when projectId is missing', async () => {
    const req = buildReq({ body: { budget: 1200, range: 'standard' }, user: { _id: 'u1' } });
    const res = buildRes();

    await aiShopper(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/projectId/i);
  });

  test('aiShopper -> 404 when project is not found', async () => {
    Project.findById.mockReturnValue(chainableQuery(null));

    const req = buildReq({
      body: { projectId: 'p1', budget: 2000, range: 'economique' },
      user: { _id: 'u1' },
    });
    const res = buildRes();

    await aiShopper(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toMatch(/Projet introuvable/i);
  });

  test('aiShopper -> 403 when project does not belong to current user', async () => {
    Project.findById.mockReturnValue(chainableQuery({ _id: 'p1', artisan: 'other-user' }));

    const req = buildReq({
      body: { projectId: 'p1', budget: 2500, range: 'premium' },
      user: { _id: 'u1' },
    });
    const res = buildRes();

    await aiShopper(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toMatch(/Acces refuse/i);
  });

  test('aiShopper -> 200 with BMP and external recommendations', async () => {
    Project.findById.mockReturnValue(
      chainableQuery({
        _id: 'p1',
        artisan: 'u1',
        title: 'Mur de soutenement',
        description: 'Projet de drainage et beton',
        location: 'Tunis',
        startDate: '2026-05-01',
        endDate: '2026-05-20',
      })
    );

    Product.find.mockReturnValue(
      chainableQuery([
        {
          _id: 'prod1',
          name: 'Parpaing 20',
          price: 4,
          category: 'Maconnerie',
          description: 'Bloc de mur',
          manufacturer: { companyName: 'BuildCo' },
          rating: 4.5,
          numReviews: 10,
          stock: 100,
        },
      ])
    );

    geminiService.inferCategories.mockReturnValue(['Maconnerie']);
    geminiService.generateRecommendations.mockResolvedValue({
      bmp_materials: [
        {
          productId: 'prod1',
          name: 'Parpaing 20',
          quantite_recommandee: 15,
          unite_mesure: 'piece',
          ai_justification: 'Bon rapport qualite/prix',
        },
      ],
      external_materials: [
        {
          generic_name: 'Geotextile',
          estimated_price: 22,
          quantite_recommandee: 4,
          unite_mesure: 'm2',
          suggested_brand: 'Local Brand',
          search_keyword: 'geotextile drainage',
        },
      ],
    });
    geminiService.getActiveModelName.mockReturnValue('gemini-2.5-flash');
    geminiService.getActiveApiVersion.mockReturnValue('v1');

    const req = buildReq({
      body: {
        projectId: 'p1',
        budget: 1800,
        range: 'Standard',
        specificNeeds: 'drainage durable',
      },
      user: { _id: 'u1' },
    });
    const res = buildRes();

    await aiShopper(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.bmp_materials.length).toBeGreaterThan(0);
    expect(res.body.external_materials.length).toBeGreaterThan(0);
    expect(res.body.meta.model).toBe('gemini-2.5-flash');
    expect(geminiService.generateRecommendations).toHaveBeenCalled();
  });

  test('aiShopper -> 503 when Gemini key is missing', async () => {
    Project.findById.mockReturnValue(chainableQuery({ _id: 'p1', artisan: 'u1', title: 'A', description: 'B' }));
    Product.find.mockReturnValue(chainableQuery([]));
    geminiService.inferCategories.mockReturnValue(['Maconnerie']);
    geminiService.generateRecommendations.mockRejectedValue({
      code: 'GEMINI_KEY_MISSING',
      message: 'GEMINI_API_KEY missing',
    });

    const req = buildReq({
      body: { projectId: 'p1', budget: 1000, range: 'standard' },
      user: { _id: 'u1' },
    });
    const res = buildRes();

    await aiShopper(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body.message).toMatch(/Configuration IA manquante/i);
  });
});
