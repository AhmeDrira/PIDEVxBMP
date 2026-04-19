const buildGeminiResult = (text, finishReason = 'STOP') => ({
  response: {
    candidates: [{ finishReason }],
    text: () => text,
  },
});

const loadGeminiService = ({ apiKey = 'unit-test-gemini-key', generateContentImpl } = {}) => {
  jest.resetModules();

  if (apiKey === null) {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = apiKey;
    delete process.env.GOOGLE_API_KEY;
  }

  const mockGenerateContent = jest.fn().mockImplementation(
    generateContentImpl || (() => Promise.resolve(buildGeminiResult('{"bmp_materials":[],"external_materials":[]}')))
  );

  const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
  }));

  const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));

  jest.doMock('@google/generative-ai', () => ({
    GoogleGenerativeAI: MockGoogleGenerativeAI,
  }));

  const service = require('../../../services/geminiService');
  return {
    service,
    mockGenerateContent,
    mockGetGenerativeModel,
    MockGoogleGenerativeAI,
  };
};

describe('geminiService (unit)', () => {
  it('should infer relevant categories from project text', () => {
    // Arrange
    const { service } = loadGeminiService();

    // Act
    const categories = service.inferCategories('Renovation cuisine avec electricite et plomberie');

    // Assert
    expect(categories).toEqual(expect.arrayContaining(['Plomberie', 'Carrelage', 'Électricité']));
  });

  it('should return parsed recommendation payload from markdown JSON response', async () => {
    // Arrange
    const { service } = loadGeminiService({
      generateContentImpl: () =>
        Promise.resolve(
          buildGeminiResult(
            '```json\n{"bmp_materials":[{"name":"Cement","price":20}],"external_materials":[{"generic_name":"Primer"}]}\n```'
          )
        ),
    });

    // Act
    const result = await service.generateRecommendations({
      project: { title: 'New slab' },
      constraints: { budget: 2000 },
      products: [{ _id: 'p1', name: 'Cement bag', category: 'Beton' }],
    });

    // Assert
    expect(result.bmp_materials).toHaveLength(1);
    expect(result.external_materials).toHaveLength(1);
    expect(result.bmp_materials[0]).toEqual(expect.objectContaining({ name: 'Cement' }));
  });

  it('should retry with fallback candidate when first model is not found', async () => {
    // Arrange
    const notFoundError = new Error('model is not found');
    notFoundError.status = 404;

    const { service, mockGenerateContent, mockGetGenerativeModel } = loadGeminiService({
      generateContentImpl: jest
        .fn()
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce(buildGeminiResult('{"bmp_materials":[],"external_materials":[]}')),
    });

    // Act
    const result = await service.generateRecommendations({
      project: { title: 'Roof repair' },
      constraints: { budget: 3000 },
      products: [{ _id: 'p2', name: 'Tile', category: 'Couverture' }],
    });

    // Assert
    expect(result).toEqual({ bmp_materials: [], external_materials: [] });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
  });

  it('should throw GEMINI_KEY_MISSING without exposing sensitive values', async () => {
    // Arrange
    const { service } = loadGeminiService({ apiKey: null });

    // Act + Assert
    await expect(
      service.generateRecommendations({ project: {}, constraints: {}, products: [] })
    ).rejects.toMatchObject({ code: 'GEMINI_KEY_MISSING' });

    await service
      .generateRecommendations({ project: {}, constraints: {}, products: [] })
      .catch((error) => {
        expect(String(error.message)).not.toMatch(/AIza|sk_live|sk_test/i);
      });
  });
});
