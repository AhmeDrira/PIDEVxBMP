jest.mock('../../../services/quoteMLService', () => ({
  predictQuoteDraftFromHistory: jest.fn(),
}));

const { predictQuoteDraftFromHistory } = require('../../../services/quoteMLService');
const { generateQuoteAIDraft } = require('../../../services/quoteAIDraftService');

describe('quoteAIDraftService', () => {
  const baseProject = {
    _id: 'p1',
    title: 'Renovation maison',
    location: 'Tunis',
    description: 'Travaux de renovation complete',
    startDate: '2026-04-01',
    endDate: '2026-05-01',
    priority: 'medium',
    tasks: [
      { title: 'Demolition', status: 'done' },
      { title: 'Peinture', status: 'todo' },
    ],
    materials: [
      { _id: 'm1', name: 'Ciment', price: 20, category: 'Beton', status: 'active' },
      { _id: 'm1', name: 'Ciment', price: 20, category: 'Beton', status: 'active' },
    ],
    personalMaterials: [{ name: 'Sable', stock: 3, price: 15, category: 'Beton' }],
  };

  test('generateQuoteAIDraft -> nominal heuristic fallback output', async () => {
    predictQuoteDraftFromHistory.mockResolvedValue({
      ok: false,
      reason: 'insufficient-history',
      historyCount: 1,
      requiredHistory: 3,
    });

    const draft = await generateQuoteAIDraft({
      project: baseProject,
      clientName: 'Client A',
      artisanId: 'a1',
    });

    expect(draft.inference.source).toBe('heuristic-fallback');
    expect(draft.recommendations.laborHand.value).toBeGreaterThan(0);
    expect(draft.recommendations.upfront.percent).toBeGreaterThanOrEqual(0);
    expect(draft.recommendations.upfront.percent).toBeLessThanOrEqual(100);
  });

  test('generateQuoteAIDraft -> uses ML output when available', async () => {
    predictQuoteDraftFromHistory.mockResolvedValue({
      ok: true,
      model: 'Xenova/all-MiniLM-L6-v2',
      method: 'embedding-rag-nearest-neighbors',
      confidence: 0.82,
      historyCount: 8,
      neighborsUsed: 4,
      averageSimilarity: 0.71,
      predictions: {
        laborHand: 2100,
        laborRatio: 0.8,
        upfrontPercent: 35,
        paymentType: 'percentage',
      },
      neighbors: [],
    });

    const draft = await generateQuoteAIDraft({
      project: baseProject,
      clientName: 'Client A',
      artisanId: 'a1',
    });

    expect(draft.inference.source).toBe('ml-rag');
    expect(draft.recommendations.laborHand.value).toBe(2100);
    expect(draft.recommendations.paymentType.value).toBe('percentage');
  });

  test('generateQuoteAIDraft -> handles sparse input and keeps business bounds', async () => {
    predictQuoteDraftFromHistory.mockResolvedValue({ ok: false, reason: 'missing-artisan-id', historyCount: 0 });

    const draft = await generateQuoteAIDraft({
      project: {
        _id: 'p2',
        title: 'Projet court',
        materials: [],
        tasks: [],
      },
      clientName: '',
      artisanId: null,
    });

    expect(draft.warnings.length).toBeGreaterThan(0);
    expect(draft.recommendations.upfront.percent).toBeGreaterThanOrEqual(0);
    expect(draft.recommendations.upfront.percent).toBeLessThanOrEqual(100);
    expect(draft.projectSnapshot.totalEstimated).toBeGreaterThanOrEqual(0);
  });

  test('generateQuoteAIDraft -> falls back when ML dependency throws', async () => {
    predictQuoteDraftFromHistory.mockRejectedValue(new Error('ml unavailable'));

    const draft = await generateQuoteAIDraft({
      project: baseProject,
      clientName: 'Client A',
      artisanId: 'a1',
    });

    expect(draft.inference.source).toBe('heuristic-fallback');
    expect(draft.warnings.some((w) => /ML service is temporarily unavailable/i.test(w))).toBe(true);
  });
});
