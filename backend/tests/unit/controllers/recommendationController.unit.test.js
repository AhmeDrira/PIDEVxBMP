const { buildReq, buildRes } = require('../../http.mock');

jest.mock('../../../models/Project', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/Product', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/ProductPayment', () => ({
  find: jest.fn(),
}));

jest.mock('../../../services/RecommendationEngine', () => ({
  computeScore: jest.fn(),
}));

jest.mock('../../../services/TechSheetAnalyzer', () => ({
  getOrAnalyze: jest.fn(),
  forceAnalyze: jest.fn(),
}));

jest.mock('../../../services/conversionService', () => ({
  calculateQuantity: jest.fn(),
}));

jest.mock('../../../services/projectAnalyzer', () => ({
  detectProjectType: jest.fn(),
  mapCategoryToProjectType: jest.fn(),
}));

jest.mock('../../../services/productAnalyzer', () => ({
  analyzeProductForProjectType: jest.fn(),
}));

jest.mock('../../../services/conversionFactors', () => ({
  calculateProductQuantity: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn((error) => Boolean(error?.isAxiosError)),
}));

const Product = require('../../../models/Product');
const TechSheetAnalyzer = require('../../../services/TechSheetAnalyzer');
const controller = require('../../../controllers/recommendationController');

describe('recommendationController', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('generateMaterialDescription -> 400 when name is missing', async () => {
    const req = buildReq({ body: { category: 'Beton' }, user: { role: 'manufacturer' } });
    const res = buildRes();

    await controller.generateMaterialDescription(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('generateMaterialDescription -> 403 for non-manufacturer user', async () => {
    const req = buildReq({ body: { name: 'Ciment' }, user: { role: 'artisan' } });
    const res = buildRes();

    await controller.generateMaterialDescription(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('generateMaterialDescription -> 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = buildReq({
      body: { name: 'Ciment', category: 'Beton', language: 'fr' },
      user: { role: 'manufacturer' },
    });
    const res = buildRes();

    await controller.generateMaterialDescription(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toMatch(/temporarily unavailable/i);
  });

  test('getMaterialRecommendations -> 400 when surface is invalid', async () => {
    const req = buildReq({
      user: { _id: 'u1' },
      params: { projectId: 'p1' },
      body: { surface: 0, unit: 'm²', category: 'Beton', budget: 1200 },
    });
    const res = buildRes();

    await controller.getMaterialRecommendations(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/surface/i);
  });

  test('analyzeTechSheet -> 404 when product does not exist', async () => {
    Product.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const req = buildReq({ params: { id: 'missing' } });
    const res = buildRes();

    await controller.analyzeTechSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('analyzeTechSheet -> 200 with analyzer output', async () => {
    Product.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'p1', techSheetUrl: 'https://cdn.example.com/file.pdf' }),
    });
    TechSheetAnalyzer.forceAnalyze.mockResolvedValue({
      success: true,
      confidence: 0.77,
      profile: { norms: ['NF EN 206'] },
      errorMessage: null,
    });

    const req = buildReq({ params: { id: 'p1' } });
    const res = buildRes();

    await controller.analyzeTechSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.confidence).toBe(0.77);
  });
});
