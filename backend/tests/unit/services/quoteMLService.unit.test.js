jest.mock('../../../models/Quote', () => ({
  find: jest.fn(),
}));

const Quote = require('../../../models/Quote');
const {
  predictQuoteDraftFromHistory,
  __setEmbeddingProviderForTests,
  __resetEmbeddingProviderForTests,
} = require('../../../services/quoteMLService');

const makeQuoteQuery = (quotes) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(quotes),
});

const makeProject = (overrides = {}) => ({
  title: 'Villa extension',
  description: 'Build a new room and renovate bathroom',
  location: 'Tunis',
  priority: 'high',
  tasks: [{ title: 'Masonry wall' }],
  materials: [{ name: 'Cement bag' }],
  personalMaterials: [{ name: 'Paint white' }],
  ...overrides,
});

let quoteCounter = 0;
const makeQuote = (overrides = {}) => {
  quoteCounter += 1;
  return {
    _id: `quote-${quoteCounter}`,
    quoteNumber: `Q-${100 + quoteCounter}`,
    amount: 1200,
    laborHand: 350,
    materialsAmount: 700,
    upfrontPercent: 50,
    paymentTerms: 'percentage',
    project: makeProject(),
    ...overrides,
  };
};

describe('quoteMLService (unit)', () => {
  afterEach(() => {
    __resetEmbeddingProviderForTests();
    Quote.find.mockReset();
  });

  it('should return missing-artisan-id signal when artisan id is absent', async () => {
    // Arrange
    const findMock = Quote.find;

    // Act
    const result = await predictQuoteDraftFromHistory({
      artisanId: null,
      project: makeProject(),
      clientName: 'Client A',
      currentMaterialsAmount: 500,
    });

    // Assert
    expect(result).toMatchObject({
      ok: false,
      reason: 'missing-artisan-id',
      historyCount: 0,
      neighborsUsed: 0,
    });
    expect(findMock).not.toHaveBeenCalled();
  });

  it('should return insufficient-history when approved quote count is low', async () => {
    // Arrange
    Quote.find.mockReturnValue(
      makeQuoteQuery([
        makeQuote({ _id: 'q-1', amount: 500 }),
        makeQuote({ _id: 'q-2', amount: 650 }),
      ])
    );

    // Act
    const result = await predictQuoteDraftFromHistory({
      artisanId: 'artisan-1',
      project: makeProject(),
      clientName: 'Client B',
      currentMaterialsAmount: 650,
      minHistory: 3,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-history');
    expect(result.historyCount).toBe(2);
  });

  it('should return model-load-failed when embedding model cannot be initialized', async () => {
    // Arrange
    Quote.find.mockReturnValue(
      makeQuoteQuery([
        makeQuote({ _id: 'q-1' }),
        makeQuote({ _id: 'q-2' }),
        makeQuote({ _id: 'q-3' }),
      ])
    );
    __setEmbeddingProviderForTests(async () => {
      throw new Error('transformer model init failed');
    });

    // Act
    const result = await predictQuoteDraftFromHistory({
      artisanId: 'artisan-2',
      project: makeProject(),
      clientName: 'Client C',
      currentMaterialsAmount: 900,
      minHistory: 3,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('model-load-failed');
    expect(result.errorMessage).toContain('transformer model init failed');
  });

  it('should produce bounded predictions when history is sufficient', async () => {
    // Arrange
    Quote.find.mockReturnValue(
      makeQuoteQuery([
        makeQuote({ _id: 'q-11', quoteNumber: 'Q-11', laborHand: 500, amount: 1500, materialsAmount: 900, upfrontPercent: 140, paymentTerms: 'fixed payment' }),
        makeQuote({ _id: 'q-12', quoteNumber: 'Q-12', laborHand: 420, amount: 1400, materialsAmount: 880, upfrontPercent: -20, paymentTerms: 'fixed plan' }),
        makeQuote({ _id: 'q-13', quoteNumber: 'Q-13', laborHand: 390, amount: 1350, materialsAmount: 820, upfrontPercent: 80, paymentTerms: 'percentage' }),
      ])
    );
    __setEmbeddingProviderForTests(async (text) => {
      const value = String(text || '').toLowerCase();
      if (value.includes('bathroom')) return [1, 0.2, 0];
      if (value.includes('villa')) return [0.9, 0.25, 0.05];
      return [0.8, 0.2, 0.1];
    });

    // Act
    const result = await predictQuoteDraftFromHistory({
      artisanId: 'artisan-3',
      project: makeProject({ title: 'Bathroom refresh' }),
      clientName: 'Client D',
      currentMaterialsAmount: 1000,
      minHistory: 3,
      topK: 3,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.neighborsUsed).toBeGreaterThan(0);
    expect(result.predictions.laborHand).toBeGreaterThanOrEqual(0);
    expect(result.predictions.upfrontPercent).toBeGreaterThanOrEqual(0);
    expect(result.predictions.upfrontPercent).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
    expect(result.confidence).toBeLessThanOrEqual(0.97);
    expect(['fixed', 'percentage']).toContain(result.predictions.paymentType);
  });
});
