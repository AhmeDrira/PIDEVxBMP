/**
 * Unit tests — RecommendationEngine (pure scoring functions)
 * Run: npx jest tests/recommendationEngine.test.js
 */

const {
  scoreBesoin,
  scoreBudget,
  scoreDispoDelai,
  scoreFiabilite,
  scorePdf,
  computeScore,
  renormaliseWeights,
  DEFAULT_WEIGHTS,
  tokenise,
  estimateDeliveryDays,
} = require('../services/RecommendationEngine');

// ── tokenise ─────────────────────────────────────────────────────────────────
describe('tokenise', () => {
  test('lowercases and strips accents', () => {
    const tokens = tokenise('Béton armé résistant');
    expect(tokens).toContain('beton');
    expect(tokens).toContain('arme');
    expect(tokens).toContain('resistant');
  });
  test('filters short words', () => {
    const tokens = tokenise('de la à béton');
    expect(tokens).toContain('beton');
    expect(tokens).not.toContain('de');
    expect(tokens).not.toContain('la');
  });
  test('empty string returns []', () => {
    expect(tokenise('')).toEqual([]);
    expect(tokenise(null)).toEqual([]);
  });
});

// ── estimateDeliveryDays ──────────────────────────────────────────────────────
describe('estimateDeliveryDays', () => {
  test('sufficient stock → 3 days', () => {
    expect(estimateDeliveryDays(10, 10)).toBe(3);
    expect(estimateDeliveryDays(20, 5)).toBe(3);
  });
  test('insufficient stock adds 2 days per missing unit', () => {
    expect(estimateDeliveryDays(0, 5)).toBe(3 + 5 * 2); // 13
    expect(estimateDeliveryDays(3, 5)).toBe(3 + 2 * 2); // 7
  });
});

// ── scoreBesoin ───────────────────────────────────────────────────────────────
describe('scoreBesoin', () => {
  const product = { name: 'Béton C25', category: 'Béton', description: 'Résistant aux intempéries' };

  test('exact category match boosts score', () => {
    const score = scoreBesoin(product, 'béton fondation', []);
    expect(score).toBeGreaterThan(0.5);
  });
  test('no match returns low score', () => {
    const score = scoreBesoin(product, 'peinture mur', []);
    expect(score).toBeLessThan(0.3);
  });
  test('empty nature returns neutral 0.5', () => {
    expect(scoreBesoin(product, '', [])).toBe(0.5);
  });
  test('constraints contribute to score', () => {
    const score = scoreBesoin(product, 'béton', ['résistant', 'intempéries']);
    expect(score).toBeGreaterThan(0.5);
  });
  test('score is between 0 and 1', () => {
    const s = scoreBesoin(product, 'béton résistant fondation', ['NF EN', 'sol']);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ── scoreBudget ───────────────────────────────────────────────────────────────
describe('scoreBudget', () => {
  test('within budget → 1.0', () => {
    expect(scoreBudget(100, 5, 1000)).toBe(1.0); // 500 ≤ 1000
  });
  test('exactly on budget → 1.0', () => {
    expect(scoreBudget(100, 10, 1000)).toBe(1.0); // 1000 = 1000
  });
  test('slightly over budget → partial score', () => {
    const s = scoreBudget(100, 12, 1000); // 1200 vs 1000 → 20% over
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThan(1);
  });
  test('2× budget → ~0.37 (exp(-1))', () => {
    const s = scoreBudget(100, 20, 1000); // 2000 vs 1000 → 100% over
    expect(s).toBeCloseTo(Math.exp(-1), 1);
  });
  test('no budget → neutral 0.5', () => {
    expect(scoreBudget(100, 10, 0)).toBe(0.5);
    expect(scoreBudget(100, 10, null)).toBe(0.5);
  });
  test('zero price or quantity → 0', () => {
    expect(scoreBudget(0, 10, 500)).toBe(0);
    expect(scoreBudget(100, 0, 500)).toBe(0);
  });
});

// ── scoreDispoDelai ───────────────────────────────────────────────────────────
describe('scoreDispoDelai', () => {
  test('full stock within deadline → ≈1.0', () => {
    const s = scoreDispoDelai(20, 'active', 10, 30);
    expect(s).toBeCloseTo(1.0, 1);
  });
  test('out-of-stock → 0', () => {
    expect(scoreDispoDelai(0, 'out-of-stock', 10, 30)).toBe(0);
    expect(scoreDispoDelai(5, 'out-of-stock', 10, 30)).toBe(0);
  });
  test('low-stock applies penalty', () => {
    const active   = scoreDispoDelai(15, 'active', 10, 30);
    const lowStock = scoreDispoDelai(15, 'low-stock', 10, 30);
    expect(lowStock).toBeLessThan(active);
  });
  test('insufficient stock with tight deadline → lower score', () => {
    const loose = scoreDispoDelai(2, 'active', 10, 60);
    const tight  = scoreDispoDelai(2, 'active', 10, 5);
    expect(tight).toBeLessThan(loose);
  });
  test('score is in [0, 1]', () => {
    const s = scoreDispoDelai(3, 'active', 20, 7);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ── scoreFiabilite ────────────────────────────────────────────────────────────
describe('scoreFiabilite', () => {
  test('perfect rating + many reviews + loyal → close to 1', () => {
    const s = scoreFiabilite(5, 100, true);
    expect(s).toBeGreaterThan(0.9);
  });
  test('zero rating + no reviews + no history → 0', () => {
    expect(scoreFiabilite(0, 0, false)).toBe(0);
  });
  test('loyalty bonus increases score', () => {
    const without = scoreFiabilite(3, 20, false);
    const with_   = scoreFiabilite(3, 20, true);
    expect(with_).toBeGreaterThan(without);
  });
  test('rating and review volume both contribute', () => {
    const highRating = scoreFiabilite(5, 5, false);
    const manyReviews = scoreFiabilite(2, 50, false);
    // Both should be non-zero but different
    expect(highRating).toBeGreaterThan(0);
    expect(manyReviews).toBeGreaterThan(0);
  });
  test('score is in [0, 1]', () => {
    const s = scoreFiabilite(4.3, 27, false);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ── scorePdf ──────────────────────────────────────────────────────────────────
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

  test('no PDF → 0.20 penalty score', () => {
    expect(scorePdf(null, 0, false, [])).toBe(0.20);
    expect(scorePdf(richProfile, 0, false, [])).toBe(0.20);
  });
  test('PDF present with rich profile → high score', () => {
    const s = scorePdf(richProfile, 0.9, true, ['béton', 'fondation']);
    expect(s).toBeGreaterThan(0.6);
  });
  test('PDF present but confidence = 0 → near-zero', () => {
    expect(scorePdf(richProfile, 0, true, [])).toBeCloseTo(0.15, 1);
  });
  test('constraints covered in profile boost score', () => {
    const withConstraints    = scorePdf(richProfile, 0.8, true, ['béton', 'humide', 'fondation']);
    const withoutConstraints = scorePdf(richProfile, 0.8, true, []);
    expect(withConstraints).toBeGreaterThanOrEqual(withoutConstraints);
  });
  test('score is in [0, 1]', () => {
    const s = scorePdf(richProfile, 0.75, true, ['résistant', 'extérieur']);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ── renormaliseWeights ────────────────────────────────────────────────────────
describe('renormaliseWeights', () => {
  test('all criteria available → sum = 1', () => {
    const available = new Set(['besoin', 'budget', 'dispoDelai', 'fiabilite', 'pdf']);
    const w = renormaliseWeights(DEFAULT_WEIGHTS, available);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
  test('budget removed → remaining sum = 1', () => {
    const available = new Set(['besoin', 'dispoDelai', 'fiabilite', 'pdf']);
    const w = renormaliseWeights(DEFAULT_WEIGHTS, available);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(w.budget).toBeUndefined();
  });
  test('only one criterion → weight = 1', () => {
    const w = renormaliseWeights(DEFAULT_WEIGHTS, new Set(['besoin']));
    expect(w.besoin).toBeCloseTo(1, 5);
  });
});

// ── computeScore (integration) ────────────────────────────────────────────────
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
  };
  const richProfile = {
    norms: ['NF EN 206'], certifications: ['CE'], resistance: ['25 MPa'],
    dimensions: [], environment: ['extérieur'], safety: ['A2'], materials: ['béton'], keywords: ['fondation'],
  };

  test('returns totalScore in [0, 1]', () => {
    const { totalScore } = computeScore({
      product: mockProduct,
      nature: 'béton fondation',
      quantity: 10,
      budget: 600,
      constraints: ['résistant'],
      deadlineDays: 14,
      artisanBoughtBefore: false,
      techProfile: richProfile,
      techConfidence: 0.8,
      pdfPresent: true,
    });
    expect(totalScore).toBeGreaterThanOrEqual(0);
    expect(totalScore).toBeLessThanOrEqual(1);
  });

  test('breakdown has all 5 keys', () => {
    const { breakdown } = computeScore({
      product: mockProduct,
      nature: 'béton',
      quantity: 5,
      budget: 500,
      constraints: [],
      deadlineDays: 30,
      artisanBoughtBefore: false,
      techProfile: null,
      techConfidence: 0,
      pdfPresent: false,
    });
    expect(breakdown).toHaveProperty('besoin');
    expect(breakdown).toHaveProperty('budget');
    expect(breakdown).toHaveProperty('dispoDelai');
    expect(breakdown).toHaveProperty('fiabilite');
    expect(breakdown).toHaveProperty('pdf');
  });

  test('product with PDF scores higher than identical without PDF', () => {
    const base = { product: mockProduct, nature: 'béton', quantity: 5, budget: 400, constraints: [], deadlineDays: 20, artisanBoughtBefore: false };
    const withPdf    = computeScore({ ...base, techProfile: richProfile, techConfidence: 0.9, pdfPresent: true });
    const withoutPdf = computeScore({ ...base, techProfile: null, techConfidence: 0, pdfPresent: false });
    expect(withPdf.totalScore).toBeGreaterThan(withoutPdf.totalScore);
  });

  test('reasons array is non-empty', () => {
    const { reasons } = computeScore({
      product: mockProduct,
      nature: 'béton',
      quantity: 10,
      budget: 200,
      constraints: [],
      deadlineDays: 7,
      artisanBoughtBefore: true,
      techProfile: richProfile,
      techConfidence: 0.7,
      pdfPresent: true,
    });
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
  });

  test('out-of-budget product gets lower score', () => {
    const expensive = { ...mockProduct, price: 500 }; // 500 × 10 = 5000 vs budget 400
    const cheap     = { ...mockProduct, price: 30 };   // 30  × 10 = 300  vs budget 400
    const sExpensive = computeScore({ product: expensive, nature: 'béton', quantity: 10, budget: 400, constraints: [], deadlineDays: 30, artisanBoughtBefore: false, techProfile: null, techConfidence: 0, pdfPresent: false });
    const sCheap     = computeScore({ product: cheap,     nature: 'béton', quantity: 10, budget: 400, constraints: [], deadlineDays: 30, artisanBoughtBefore: false, techProfile: null, techConfidence: 0, pdfPresent: false });
    expect(sCheap.totalScore).toBeGreaterThan(sExpensive.totalScore);
  });
});
