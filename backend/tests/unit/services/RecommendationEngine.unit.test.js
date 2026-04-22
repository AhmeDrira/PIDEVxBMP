const {
  tokenise,
  normaliseStr,
  scoreCompatibiliteSurface,
  scoreBudget,
  scoreContrainteTechnique,
  scoreFiabilite,
  scorePdf,
  scoreSemanticProjectMatch,
  generateJustification,
  computeScore,
} = require('../../../services/RecommendationEngine');

describe('RecommendationEngine', () => {
  describe('normalisation and tokenization', () => {
    test('normaliseStr removes accents, punctuation and extra spaces', () => {
      expect(normaliseStr('  Béton, C25/30 !!  ')).toBe('beton c25 30');
    });

    test('tokenise keeps words with at least 3 chars', () => {
      expect(tokenise('un mortier de tres haute qualité')).toEqual(['mortier', 'tres', 'haute', 'qualite']);
    });
  });

  describe('scoreBudget', () => {
    test('returns neutral score when budget is missing or invalid', () => {
      expect(scoreBudget(20, 3, 0)).toEqual({
        score: 12,
        withinBudget: null,
        overPct: null,
        totalCost: 60,
      });
    });

    test('returns zero when price or quantity is missing', () => {
      expect(scoreBudget(0, 3, 100)).toEqual({
        score: 0,
        withinBudget: false,
        overPct: null,
        totalCost: 0,
      });
      expect(scoreBudget(20, 0, 100)).toEqual({
        score: 0,
        withinBudget: false,
        overPct: null,
        totalCost: 0,
      });
    });

    test('returns max score when total cost is within budget', () => {
      expect(scoreBudget(10, 8, 100)).toEqual({
        score: 25,
        withinBudget: true,
        overPct: 0,
        totalCost: 80,
      });
    });

    test('applies progressive penalty for moderate over-budget', () => {
      const result = scoreBudget(11, 10, 100); // +10%
      expect(result.totalCost).toBe(110);
      expect(result.withinBudget).toBe(false);
      expect(result.overPct).toBeCloseTo(10, 5);
      expect(result.score).toBe(5);
    });

    test('drops to zero when over-budget exceeds threshold', () => {
      const result = scoreBudget(13, 10, 100); // +30%
      expect(result.score).toBe(0);
      expect(result.withinBudget).toBe(false);
      expect(result.overPct).toBeGreaterThan(12.5);
    });
  });

  describe('scoreContrainteTechnique', () => {
    const product = {
      name: 'Peinture anti humidite premium',
      category: 'Peinture',
      description: 'Ideale pour interieur et resistance humidite',
    };

    test('returns neutral zero when constraint is empty', () => {
      expect(scoreContrainteTechnique(product, '')).toEqual({ score: 0, matchCount: 0 });
    });

    test('returns proportional score for partial/full matches', () => {
      const result = scoreContrainteTechnique(product, 'humidite interieur');
      expect(result.matchCount).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.score).toBeLessThanOrEqual(20);
    });

    test('returns zero when no token matches', () => {
      expect(scoreContrainteTechnique(product, 'ignifuge exterieur marine')).toEqual({
        score: 0,
        matchCount: 0,
      });
    });
  });

  describe('scoreFiabilite', () => {
    test('adds loyalty bonus when manufacturer was previously purchased', () => {
      const result = scoreFiabilite({ rating: 4.5, manufacturer: 'm1' }, new Set(['m1']));
      expect(result).toEqual({ reliability: 9, loyaltyBonus: 5, total: 14 });
    });

    test('caps reliability to max and avoids loyalty without match', () => {
      const result = scoreFiabilite({ rating: 7, manufacturer: 'm2' }, new Set(['m1']));
      expect(result).toEqual({ reliability: 10, loyaltyBonus: 0, total: 10 });
    });
  });

  describe('scorePdf', () => {
    test('returns zero when pdf is absent or profile is missing', () => {
      expect(scorePdf(null, true, 'norme')).toEqual({ score: 0, badges: [] });
      expect(scorePdf({ norms: ['NF'] }, false, 'norme')).toEqual({ score: 0, badges: [] });
    });

    test('returns capped score when entities are present and constraint matches', () => {
      const profile = {
        norms: ['NF EN 197'],
        certifications: ['ISO 9001'],
        safety: ['A1'],
        keywords: ['norme', 'ciment'],
      };

      const result = scorePdf(profile, true, 'norme ciment');
      expect(result.score).toBe(9);
      expect(result.badges).toHaveLength(3);
    });

    test('caps score to partial when constraint does not match profile text', () => {
      const profile = {
        norms: ['NF EN 197'],
        certifications: ['ISO 9001'],
        safety: ['A1'],
      };

      const result = scorePdf(profile, true, 'hydrofuge exterieur');
      expect(result.score).toBeLessThanOrEqual(7);
      expect(result.badges).toHaveLength(3);
    });
  });

  describe('semantic matching', () => {
    test('returns normalized bonus/penalty details', () => {
      expect(
        scoreSemanticProjectMatch({
          matchStrength: 'strong',
          matchCount: 4,
          bonus: 8,
          penalty: 2,
        })
      ).toEqual({
        bonus: 8,
        penalty: 2,
        net: 6,
        matchStrength: 'strong',
        matchCount: 4,
      });
    });

    test('returns zeroed fallback with empty payload', () => {
      expect(scoreSemanticProjectMatch()).toEqual({
        bonus: 0,
        penalty: 0,
        net: 0,
        matchStrength: 'none',
        matchCount: 0,
      });
    });
  });

  describe('generateJustification', () => {
    test('builds a complete professional justification', () => {
      const text = generateJustification({
        product: { rating: 4.8 },
        scoresDetail: {
          budget: { withinBudget: true, overPct: 0, score: 25 },
          contrainte: { score: 16, matchCount: 2 },
          fiabilite: { loyaltyBonus: 5 },
        },
        constraint: 'norme anti humidite',
        category: 'Peinture',
        hasPdfBadges: true,
        isNonStandard: true,
        semanticResult: { matchStrength: 'strong', penalty: 1 },
      });

      expect(text).toContain('Categorie "Peinture"'.replace('Categorie', 'Catégorie'));
      expect(text).toContain('respecte votre budget');
      expect(text).toContain('certifications');
      expect(text).toContain('bonus fidelite'.replace('fidelite', 'fidélité'));
    });

    test('returns a minimal category-based sentence when no extra signal is available', () => {
      const text = generateJustification({
        product: { rating: 0 },
        scoresDetail: {
          budget: { withinBudget: null, overPct: null, score: 12 },
          contrainte: { score: 0, matchCount: 0 },
          fiabilite: { loyaltyBonus: 0 },
        },
        constraint: '',
        category: '',
        hasPdfBadges: false,
        isNonStandard: false,
        semanticResult: { matchStrength: 'none', penalty: 0 },
      });

      expect(text).toBe('Catégorie "" correspondante.');
    });
  });

  describe('computeScore', () => {
    test('aggregates all criteria and produces rankingTotal with semantic net', () => {
      const result = computeScore({
        product: {
          name: 'Ciment Haute Resistance',
          category: 'Ciment',
          description: 'Ciment avec norme certifiee',
          price: 10,
          rating: 4.8,
          manufacturer: 'm1',
        },
        category: 'Ciment',
        unit: 'kg',
        constraint: 'norme certifiee',
        quantity: 10,
        budget: 120,
        purchasedManufIds: new Set(['m1']),
        techProfile: {
          norms: ['NF EN 197'],
          certifications: ['ISO 9001'],
          safety: ['A1'],
          keywords: ['norme'],
        },
        pdfPresent: true,
        isNonStandard: false,
        semanticAnalysis: {
          bonus: 6,
          penalty: 1,
          matchStrength: 'strong',
          matchCount: 3,
        },
      });

      expect(scoreCompatibiliteSurface()).toEqual({ total: 25 });
      expect(result.totalCost).toBe(100);
      expect(result.scores.compatibilite).toBe(25);
      expect(result.scores.budget).toBe(25);
      expect(result.scores.fiabilite).toBe(15);
      expect(result.scores.semanticBonus).toBe(6);
      expect(result.scores.genericPenalty).toBe(1);
      expect(result.scores.rankingTotal).toBe(result.scores.total + 5);
      expect(result.pdfBadges.length).toBeGreaterThan(0);
      expect(typeof result.justification).toBe('string');
      expect(result.justification.length).toBeGreaterThan(10);
    });
  });
});
