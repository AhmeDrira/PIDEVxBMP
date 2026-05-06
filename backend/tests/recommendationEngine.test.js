/**
 * Unit tests — RecommendationEngine (pure scoring functions, v4 API)
 * Run: npx jest tests/recommendationEngine.test.js
 */

const {
  tokenise,
  scoreCompatibiliteSurface,
  scoreBudget,
  scoreContrainteTechnique,
  scoreFiabilite,
  scorePdf,
  scoreSemanticProjectMatch,
  computeScore,
} = require('../services/RecommendationEngine');

// ── tokenise ─────────────────────────────────────────────────────────────────
describe('tokenise', () => {
  test('lowercases and strips accents', () => {
    const tokens = tokenise('Béton armé résistant');
    expect(tokens).toContain('beton');
    expect(tokens).toContain('arme');
    expect(tokens).toContain('resistant');
  });
  test('filters short words (< 3 chars)', () => {
    const tokens = tokenise('de la à béton');
    expect(tokens).toContain('beton');
    expect(tokens).not.toContain('de');
    expect(tokens).not.toContain('la');
  });
  test('empty/null input returns []', () => {
    expect(tokenise('')).toEqual([]);
    expect(tokenise(null)).toEqual([]);
  });
});

// ── scoreCompatibiliteSurface ────────────────────────────────────────────────
describe('scoreCompatibiliteSurface', () => {
  test('returns the fixed 25 points compatibility score (v1 behaviour)', () => {
    expect(scoreCompatibiliteSurface()).toEqual({ total: 25 });
  });
});

// ── scoreBudget ──────────────────────────────────────────────────────────────
describe('scoreBudget', () => {
  test('within budget → max 25 pts', () => {
    const r = scoreBudget(100, 5, 1000); // 500 ≤ 1000
    expect(r.score).toBe(25);
    expect(r.withinBudget).toBe(true);
    expect(r.totalCost).toBe(500);
  });
  test('exactly on budget → 25 pts', () => {
    const r = scoreBudget(100, 10, 1000); // 1000 = 1000
    expect(r.score).toBe(25);
    expect(r.withinBudget).toBe(true);
  });
  test('slightly over budget (<=12.5%) yields partial points', () => {
    const r = scoreBudget(100, 11, 1000); // 1100 → 10% over
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(25);
    expect(r.withinBudget).toBe(false);
  });
  test('over 12.5% → 0 pts', () => {
    const r = scoreBudget(100, 20, 1000); // 2000 → 100% over
    expect(r.score).toBe(0);
    expect(r.withinBudget).toBe(false);
  });
  test('no budget → neutral 12 pts', () => {
    expect(scoreBudget(100, 10, 0).score).toBe(12);
    expect(scoreBudget(100, 10, null).score).toBe(12);
  });
  test('zero price or quantity → 0 pts', () => {
    expect(scoreBudget(0, 10, 500).score).toBe(0);
    expect(scoreBudget(100, 0, 500).score).toBe(0);
  });
});

// ── scoreContrainteTechnique ─────────────────────────────────────────────────
describe('scoreContrainteTechnique', () => {
  const product = { name: 'Béton C25', category: 'Béton', description: 'Résistant aux intempéries' };

  test('no constraint → 0 pts neutral', () => {
    expect(scoreContrainteTechnique(product, '')).toEqual({ score: 0, matchCount: 0 });
    expect(scoreContrainteTechnique(product, '   ')).toEqual({ score: 0, matchCount: 0 });
  });
  test('full match yields high score', () => {
    const r = scoreContrainteTechnique(product, 'résistant intempéries');
    expect(r.matchCount).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(20);
  });
  test('no match → 0 pts', () => {
    const r = scoreContrainteTechnique(product, 'peinture mur');
    expect(r.score).toBe(0);
    expect(r.matchCount).toBe(0);
  });
  test('score is in [0, 20]', () => {
    const r = scoreContrainteTechnique(product, 'béton résistant');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(20);
  });
});

// ── scoreFiabilite ───────────────────────────────────────────────────────────
describe('scoreFiabilite', () => {
  test('perfect rating + loyal manufacturer → 15 pts', () => {
    const product = { rating: 5, manufacturer: 'm1' };
    const r = scoreFiabilite(product, new Set(['m1']));
    expect(r.reliability).toBe(10);
    expect(r.loyaltyBonus).toBe(5);
    expect(r.total).toBe(15);
  });
  test('zero rating + no history → 0 pts', () => {
    const product = { rating: 0, manufacturer: 'm1' };
    const r = scoreFiabilite(product, new Set());
    expect(r.total).toBe(0);
  });
  test('loyalty bonus increases score', () => {
    const product = { rating: 3, manufacturer: 'm1' };
    const without = scoreFiabilite(product, new Set());
    const with_   = scoreFiabilite(product, new Set(['m1']));
    expect(with_.total).toBeGreaterThan(without.total);
  });
  test('total <= 15', () => {
    const product = { rating: 4.3, manufacturer: 'm1' };
    const r = scoreFiabilite(product, new Set(['m1']));
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(15);
  });
});

// ── scorePdf ─────────────────────────────────────────────────────────────────
describe('scorePdf', () => {
  const richProfile = {
    norms:          ['NF EN 206', 'ISO 9001'],
    certifications: ['CE', 'CSTB'],
    resistance:     ['30 MPa'],
    dimensions:     ['500×200 mm'],
    environment:    ['extérieur', 'humide'],
    safety:         ['A2'],
    materials:      ['béton'],
    keywords:       ['fondation', 'dalle'],
  };

  test('no PDF → 0 pts', () => {
    expect(scorePdf(null, false, '').score).toBe(0);
    expect(scorePdf(richProfile, false, '').score).toBe(0);
  });
  test('PDF present with rich profile and no constraint → high score', () => {
    const r = scorePdf(richProfile, true, '');
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(15);
    expect(Array.isArray(r.badges)).toBe(true);
    expect(r.badges.length).toBeGreaterThan(0);
  });
  test('constraint covered by profile yields full score', () => {
    const matched = scorePdf(richProfile, true, 'extérieur humide béton');
    const unmatched = scorePdf(richProfile, true, 'isolation acoustique');
    expect(matched.score).toBeGreaterThanOrEqual(unmatched.score);
  });
  test('score is in [0, 15]', () => {
    const r = scorePdf(richProfile, true, 'résistant extérieur');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(15);
  });
});

// ── scoreSemanticProjectMatch ────────────────────────────────────────────────
describe('scoreSemanticProjectMatch', () => {
  test('empty input → all zeros', () => {
    const r = scoreSemanticProjectMatch();
    expect(r.bonus).toBe(0);
    expect(r.penalty).toBe(0);
    expect(r.net).toBe(0);
  });
  test('positive bonus and penalty → net = bonus - penalty', () => {
    const r = scoreSemanticProjectMatch({ bonus: 8, penalty: 2, matchStrength: 'strong', matchCount: 3 });
    expect(r.net).toBe(6);
    expect(r.matchStrength).toBe('strong');
    expect(r.matchCount).toBe(3);
  });
  test('clamps negative bonus/penalty to 0', () => {
    const r = scoreSemanticProjectMatch({ bonus: -5, penalty: -3 });
    expect(r.bonus).toBe(0);
    expect(r.penalty).toBe(0);
  });
});

// ── computeScore (integration) ───────────────────────────────────────────────
describe('computeScore', () => {
  const mockProduct = {
    _id: 'prod1',
    name: 'Béton C25 sac 25kg',
    category: 'Béton',
    description: 'Béton hydraulique résistant gel',
    price: 45,
    stock: 50,
    status: 'active',
    rating: 4.2,
    numReviews: 35,
    manufacturer: 'manuf1',
  };
  const richProfile = {
    norms: ['NF EN 206'], certifications: ['CE'], resistance: ['25 MPa'],
    dimensions: [], environment: ['extérieur'], safety: ['A2'], materials: ['béton'], keywords: ['fondation'],
  };

  const baseParams = {
    product: mockProduct,
    category: 'Béton',
    unit: 'm²',
    constraint: 'résistant',
    quantity: 10,
    budget: 600,
    purchasedManufIds: new Set(),
    techProfile: richProfile,
    pdfPresent: true,
    isNonStandard: false,
    semanticAnalysis: { bonus: 0, penalty: 0, matchStrength: 'none', matchCount: 0 },
  };

  test('returns score breakdown with the 5 expected criteria', () => {
    const { scores } = computeScore(baseParams);
    expect(scores).toHaveProperty('compatibilite');
    expect(scores).toHaveProperty('budget');
    expect(scores).toHaveProperty('contrainte');
    expect(scores).toHaveProperty('fiabilite');
    expect(scores).toHaveProperty('pdf');
    expect(scores).toHaveProperty('total');
    expect(scores).toHaveProperty('rankingTotal');
  });

  test('total is in [0, 100]', () => {
    const { scores } = computeScore(baseParams);
    expect(scores.total).toBeGreaterThanOrEqual(0);
    expect(scores.total).toBeLessThanOrEqual(100);
  });

  test('product with PDF scores higher than identical product without PDF', () => {
    const withPdf    = computeScore({ ...baseParams, techProfile: richProfile, pdfPresent: true });
    const withoutPdf = computeScore({ ...baseParams, techProfile: null,        pdfPresent: false });
    expect(withPdf.scores.total).toBeGreaterThan(withoutPdf.scores.total);
  });

  test('justification is a non-empty string', () => {
    const { justification } = computeScore(baseParams);
    expect(typeof justification).toBe('string');
    expect(justification.length).toBeGreaterThan(0);
  });

  test('totalCost = price × quantity', () => {
    const { totalCost } = computeScore(baseParams);
    expect(totalCost).toBe(mockProduct.price * baseParams.quantity);
  });

  test('out-of-budget product gets a lower total than affordable one', () => {
    const expensive = { ...mockProduct, price: 500 };  // 500 × 10 = 5000 vs budget 400
    const cheap     = { ...mockProduct, price: 30 };   //  30 × 10 =  300 vs budget 400
    const sExpensive = computeScore({ ...baseParams, product: expensive, budget: 400, techProfile: null, pdfPresent: false });
    const sCheap     = computeScore({ ...baseParams, product: cheap,     budget: 400, techProfile: null, pdfPresent: false });
    expect(sCheap.scores.total).toBeGreaterThan(sExpensive.scores.total);
  });

  test('semantic bonus increases rankingTotal', () => {
    const without = computeScore({ ...baseParams, semanticAnalysis: { bonus: 0, penalty: 0 } });
    const with_   = computeScore({ ...baseParams, semanticAnalysis: { bonus: 8, penalty: 0, matchStrength: 'strong', matchCount: 4 } });
    expect(with_.scores.rankingTotal).toBeGreaterThan(without.scores.rankingTotal);
  });

  test('loyal manufacturer earns the loyalty bonus through fiabilite', () => {
    const loyal   = computeScore({ ...baseParams, purchasedManufIds: new Set(['manuf1']) });
    const new_    = computeScore({ ...baseParams, purchasedManufIds: new Set() });
    expect(loyal.scores.fiabilite).toBeGreaterThan(new_.scores.fiabilite);
  });
});
