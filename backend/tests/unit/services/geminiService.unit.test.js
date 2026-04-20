const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));
const mockGoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI,
}));

const loadService = () => {
  jest.resetModules();
  return require('../../../services/geminiService');
};

describe('geminiService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  test('inferCategories -> detects categories from normalized text', () => {
    const service = loadService();

    const categories = service.inferCategories('Renovation salle de bain avec electricite et carrelage');

    expect(categories).toContain('Plomberie');
    expect(categories).toContain('Électricité');
    expect(categories).toContain('Carrelage');
  });

  test('generateRecommendations -> returns parsed JSON arrays', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const service = loadService();
    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{ finishReason: 'STOP' }],
        text: () =>
          JSON.stringify({
            bmp_materials: [
              {
                productId: 'p1',
                name: 'Parpaing',
                price: 4,
                quantite_recommandee: 20,
                unite_mesure: 'pieces',
                ai_justification: 'Bon rapport prix/qualite',
              },
            ],
            external_materials: [],
          }),
      },
    });

    const result = await service.generateRecommendations({
      project: { title: 'Mur exterieur' },
      constraints: { budget: 1200 },
      products: [{ _id: 'p1', name: 'Parpaing' }],
    });

    expect(result.bmp_materials.length).toBe(1);
    expect(result.external_materials).toEqual([]);
    expect(service.getActiveModelName()).toBeTruthy();
    expect(service.getActiveApiVersion()).toBeTruthy();
  });

  test('generateRecommendations -> throws when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const service = loadService();

    await expect(
      service.generateRecommendations({ project: {}, constraints: {}, products: [] })
    ).rejects.toThrow(/GEMINI_API_KEY\/GOOGLE_API_KEY manquante/i);
  });
});
