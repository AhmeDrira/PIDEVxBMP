const {
  tokenise,
  scoreBudget,
  scoreContrainteTechnique,
  scorePdf,
  computeScore,
} = require('../../../services/RecommendationEngine');

const { buildRecommendationProduct } = require('../builders/product.builder');
const { buildTechProfile, buildSemanticAnalysis } = require('../fixtures/recommendation.fixture');

describe('RecommendationEngine (unit)', () => {
  describe('tokenise', () => {
    it('should normalize text and remove accents', () => {
      // Arrange
      const input = 'Béton Résistant!';

      // Act
      const tokens = tokenise(input);

      // Assert
      expect(tokens).toEqual(['beton', 'resistant']);
    });
  });

  describe('scoreBudget', () => {
    it('should return 25 when total cost is within budget', () => {
      // Arrange
      const price = 50;
      const quantity = 10;
      const budget = 1000;

      // Act
      const result = scoreBudget(price, quantity, budget);

      // Assert
      expect(result.score).toBe(25);
      expect(result.withinBudget).toBe(true);
      expect(result.totalCost).toBe(500);
    });

    it('should return 0 when over budget by more than 12.5%', () => {
      // Arrange
      const price = 200;
      const quantity = 10;
      const budget = 1000;

      // Act
      const result = scoreBudget(price, quantity, budget);

      // Assert
      expect(result.score).toBe(0);
      expect(result.withinBudget).toBe(false);
      expect(result.overPct).toBeGreaterThan(12.5);
    });

    it('should return neutral score when budget is missing', () => {
      // Arrange
      const price = 50;
      const quantity = 10;

      // Act
      const result = scoreBudget(price, quantity, null);

      // Assert
      expect(result.score).toBe(12);
      expect(result.withinBudget).toBeNull();
    });
  });

  describe('scoreContrainteTechnique', () => {
    it('should reject empty constraint with zero score', () => {
      // Arrange
      const product = buildRecommendationProduct();

      // Act
      const result = scoreContrainteTechnique(product, '');

      // Assert
      expect(result.score).toBe(0);
      expect(result.matchCount).toBe(0);
    });

    it('should score high when constraint tokens match product text', () => {
      // Arrange
      const product = buildRecommendationProduct({
        description: 'Beton resistant pour fondation exterieure',
      });
      const constraint = 'beton resistant fondation';

      // Act
      const result = scoreContrainteTechnique(product, constraint);

      // Assert
      expect(result.score).toBeGreaterThanOrEqual(13);
      expect(result.matchCount).toBeGreaterThan(0);
    });
  });

  describe('scorePdf', () => {
    it('should return zero when PDF is missing', () => {
      // Arrange
      const techProfile = buildTechProfile();

      // Act
      const result = scorePdf(techProfile, false, 'norme beton');

      // Assert
      expect(result.score).toBe(0);
      expect(result.badges).toEqual([]);
    });

    it('should return partial score when PDF does not match constraints', () => {
      // Arrange
      const techProfile = buildTechProfile({
        norms: ['ISO 9001'],
        certifications: ['CE'],
        safety: ['A2'],
        keywords: ['interieur'],
      });

      // Act
      const result = scorePdf(techProfile, true, 'marine anti corrosion');

      // Assert
      expect(result.score).toBeLessThanOrEqual(7);
      expect(result.badges.length).toBeGreaterThan(0);
    });
  });

  describe('computeScore', () => {
    it('should compute rankingTotal and provide a non-empty justification', () => {
      // Arrange
      const product = buildRecommendationProduct();
      const techProfile = buildTechProfile();
      const semanticAnalysis = buildSemanticAnalysis({ bonus: 7, penalty: 1 });

      // Act
      const result = computeScore({
        product,
        category: 'Beton',
        unit: 'm2',
        constraint: 'beton resistant',
        quantity: 10,
        budget: 450,
        purchasedManufIds: new Set(['mfr-001']),
        techProfile,
        pdfPresent: true,
        semanticAnalysis,
      });

      // Assert
      expect(result.scores.total).toBeGreaterThanOrEqual(0);
      expect(result.scores.total).toBeLessThanOrEqual(100);
      expect(result.scores.rankingTotal).toBeGreaterThanOrEqual(0);
      expect(result.justification).toEqual(expect.any(String));
      expect(result.justification.length).toBeGreaterThan(10);
    });
  });
});
