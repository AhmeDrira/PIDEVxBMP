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

const axios = require('axios');
const controller = require('../../../controllers/recommendationController');

describe('recommendationController coverage additions', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('generateMaterialDescription -> 200 trims boundary quotes and returns non-empty detailed text', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_API_VERSION = 'v1';
    process.env.GEMINI_MAX_RETRIES = '1';

    const detailedText = [
      'Description: Le ciment structurel convient aux travaux de gros oeuvre et de reprise, avec une mise en oeuvre stable sur chantier.',
      'Sa formulation offre une bonne tenue mecanique, une adherence reguliere et un comportement fiable face aux variations usuelles d humidite.',
      'Avant application, preparez un support propre, coherent et legerement humidifie afin d assurer une liaison plus uniforme.',
      'Pendant l execution, respectez les dosages recommandes et melangez par petites quantites pour conserver une ouvrabilite constante.',
      'Pour une durabilite accrue, prevoyez une cure adaptee et evitez les secheresses rapides durant les premieres heures de prise.',
      'Conservez les sacs en zone seche sur palette et appliquez les mesures de securite usuelles, notamment la protection respiratoire.',
    ].join(' ');

    axios.post.mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: `"""${detailedText}"""` }],
            },
          },
        ],
      },
    });

    const req = buildReq({
      body: { name: 'Ciment Pro', category: 'Beton', language: 'fr' },
      user: { role: 'manufacturer' },
    });
    const res = buildRes();

    await controller.generateMaterialDescription(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.fallbackUsed).toBe(false);
    expect(typeof res.body.description).toBe('string');
    expect(res.body.description.length).toBeGreaterThan(260);
    expect(res.body.description.startsWith('"')).toBe(false);
    expect(res.body.description.endsWith('"')).toBe(false);
  });

  test('generateMaterialDescription -> 200 fallback when AI output remains too short', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_API_VERSION = 'v1';
    process.env.GEMINI_MAX_RETRIES = '1';

    axios.post.mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: '"short"' }],
            },
          },
        ],
      },
    });

    const req = buildReq({
      body: { name: 'Enduit', category: 'Finition', language: 'fr' },
      user: { role: 'manufacturer' },
    });
    const res = buildRes();

    await controller.generateMaterialDescription(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.fallbackUsed).toBe(true);
    expect(typeof res.body.description).toBe('string');
    expect(res.body.description.length).toBeGreaterThan(200);
  });
});
