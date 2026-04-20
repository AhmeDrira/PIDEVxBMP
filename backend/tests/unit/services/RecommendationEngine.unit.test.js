const engine = require('../../../services/RecommendationEngine');

describe('RecommendationEngine', () => {
  test('scoreBudget -> full score when total cost is within budget', () => {
    const result = engine.scoreBudget(20, 10, 250);

    expect(result.score).toBe(25);
    expect(result.withinBudget).toBe(true);
    expect(result.totalCost).toBe(200);
  });

  test('scoreBudget -> zero when budget overrun is too high', () => {
    const result = engine.scoreBudget(20, 10, 100);

    expect(result.score).toBe(0);
    expect(result.withinBudget).toBe(false);
    expect(result.overPct).toBeGreaterThan(12.5);
  });

  test('scoreContrainteTechnique -> detects matching constraint tokens', () => {
    const result = engine.scoreContrainteTechnique(
      { name: 'Peinture facade', category: 'Peinture', description: 'resistant humidite exterieur' },
      'humidité extérieur'
    );

    expect(result.matchCount).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  test('scorePdf -> returns partial score when constraint does not match profile', () => {
    const result = engine.scorePdf(
      {
        norms: ['NF EN 206'],
        certifications: ['CE'],
        safety: ['A2'],
      },
      true,
      'anti corrosion marine'
    );

    expect(result.score).toBeLessThanOrEqual(7);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test('computeScore -> returns base and ranking totals with semantic bonus', () => {
    const product = {
      name: 'Parpaing 20',
      category: 'Maconnerie',
      description: 'Bloc beton',
      price: 4,
      rating: 4.6,
      manufacturer: 'm1',
    };

    const result = engine.computeScore({
      product,
      category: 'Maconnerie',
      unit: 'm²',
      constraint: 'beton solide',
      quantity: 20,
      budget: 150,
      purchasedManufIds: new Set(['m1']),
      techProfile: {
        norms: ['NF EN 206'],
        certifications: ['CE'],
        safety: ['A2'],
      },
      pdfPresent: true,
      isNonStandard: false,
      semanticAnalysis: {
        matchStrength: 'strong',
        matchCount: 2,
        bonus: 8,
        penalty: 1,
      },
    });

    expect(result.scores.total).toBeGreaterThan(0);
    expect(result.scores.rankingTotal).toBeGreaterThan(result.scores.total - 1);
    expect(result.justification).toMatch(/Catégorie/i);
    expect(Array.isArray(result.pdfBadges)).toBe(true);
  });
});
