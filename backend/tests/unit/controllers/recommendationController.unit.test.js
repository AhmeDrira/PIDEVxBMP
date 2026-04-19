const { createMockReq, createMockRes } = require('../mocks/http.mock');

jest.mock('../../../models/Project', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/Product', () => ({
  find: jest.fn(),
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
  isAxiosError: jest.fn(() => false),
}));

const Project = require('../../../models/Project');
const Product = require('../../../models/Product');
const ProductPayment = require('../../../models/ProductPayment');
const RecommendationEngine = require('../../../services/RecommendationEngine');
const TechSheetAnalyzer = require('../../../services/TechSheetAnalyzer');
const conversionService = require('../../../services/conversionService');
const ProjectAnalyzer = require('../../../services/projectAnalyzer');
const ProductAnalyzer = require('../../../services/productAnalyzer');
const { calculateProductQuantity } = require('../../../services/conversionFactors');

const { getMaterialRecommendations } = require('../../../controllers/recommendationController');

const queryWithLean = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe('recommendationController (unit)', () => {
  it('should reject invalid recommendation input when unit is not allowed', async () => {
    // Arrange
    const req = createMockReq({
      params: { projectId: 'project-1' },
      body: {
        surface: 100,
        unit: 'cm',
        category: 'Beton',
        budget: 1500,
      },
      user: { _id: 'artisan-1' },
    });
    const res = createMockRes();

    // Act
    await getMaterialRecommendations(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('unit') })
    );
    expect(Project.findById).not.toHaveBeenCalled();
  });

  it('should reject access when project does not belong to requester', async () => {
    // Arrange
    Project.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'project-2',
        title: 'My project',
        description: 'desc',
        artisan: { toString: () => 'owner-1' },
        materials: [],
      }),
    });

    const req = createMockReq({
      params: { projectId: 'project-2' },
      body: {
        surface: 80,
        unit: 'm²',
        category: 'Beton',
        budget: 1000,
      },
      user: { _id: 'owner-2' },
    });
    const res = createMockRes();

    // Act
    await getMaterialRecommendations(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Accès refusé') })
    );
  });

  it('should return ranked recommendations for a valid request', async () => {
    // Arrange
    Project.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'project-3',
        title: 'Foundation slab',
        description: 'Concrete slab for new garage',
        artisan: { toString: () => 'artisan-3' },
        materials: [],
      }),
    });

    ProjectAnalyzer.detectProjectType.mockReturnValue({
      primaryType: 'foundation',
      confidence: 0.9,
      matchedKeywords: ['slab'],
      rankedTypes: [{ type: 'foundation', score: 0.9 }],
    });

    conversionService.calculateQuantity.mockReturnValue({
      quantity: 20,
      formula: 'surface * factor',
      label: 'reference conversion',
    });

    Product.find.mockReturnValueOnce(
      queryWithLean([
        {
          _id: 'prod-1',
          name: 'Concrete Mix',
          category: 'Beton',
          price: 30,
          stock: 50,
          image: 'img.png',
          rating: 4.8,
          numReviews: 18,
          techSheetUrl: 'https://example.com/tech.pdf',
          manufacturer: 'm-1',
          status: 'active',
        },
      ])
    );

    ProductPayment.find.mockReturnValue(queryWithLean([]));

    calculateProductQuantity.mockReturnValue({
      quantity: 10,
      factor: 1,
      matchedKey: 'default',
      outputUnit: 'pieces',
      formula: 'simple',
      note: '',
      isNonStandard: false,
      warning: null,
    });

    TechSheetAnalyzer.getOrAnalyze.mockResolvedValue({
      success: true,
      confidence: 0.88,
      profile: { density: 'high' },
      errorMessage: null,
    });

    ProductAnalyzer.analyzeProductForProjectType.mockReturnValue({
      shouldFilter: false,
      matchCount: 3,
      matchStrength: 0.92,
      matchedKeywords: ['concrete', 'foundation'],
      sourceHits: ['name', 'tech-sheet'],
      genericRatio: 0.1,
    });

    RecommendationEngine.computeScore.mockReturnValue({
      scores: {
        total: 90,
        compatibilite: 25,
        budget: 20,
        contrainte: 15,
        fiabilite: 15,
        pdf: 10,
        semanticBonus: 5,
        genericPenalty: 0,
        rankingTotal: 95,
      },
      totalCost: 300,
      justification: 'Excellent project fit',
      pdfBadges: ['tech-sheet-verified'],
    });

    const req = createMockReq({
      params: { projectId: 'project-3' },
      body: {
        surface: 50,
        unit: 'm²',
        category: 'Beton',
        budget: 1500,
        maxResults: 5,
      },
      user: { _id: 'artisan-3' },
    });
    const res = createMockRes();

    // Act
    await getMaterialRecommendations(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            productId: 'prod-1',
            productName: 'Concrete Mix',
          }),
        ]),
      })
    );
  });

  it('should handle service exceptions and return 500', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Project.findById.mockImplementationOnce(() => {
      throw new Error('database read failed');
    });

    const req = createMockReq({
      params: { projectId: 'project-4' },
      body: {
        surface: 10,
        unit: 'm²',
        category: 'Beton',
        budget: 200,
      },
      user: { _id: 'artisan-4' },
    });
    const res = createMockRes();

    // Act
    await getMaterialRecommendations(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Erreur serveur lors du calcul des recommandations' })
    );
    consoleSpy.mockRestore();
  });
});
