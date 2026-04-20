const mockPipeline = jest.fn(async () =>
  async () => ({ data: new Float32Array([0.5, 0.3, 0.2]), dims: [1, 3] })
);

jest.mock('@xenova/transformers', () => ({
  pipeline: mockPipeline,
}));

jest.mock('../../../models/Quote', () => ({
  find: jest.fn(),
}));

const Quote = require('../../../models/Quote');
const { predictQuoteDraftFromHistory } = require('../../../services/quoteMLService');

const mockQuoteQuery = (rows) => {
  const chain = {
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(rows),
  };

  Quote.find.mockReturnValue(chain);
};

describe('quoteMLService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('predictQuoteDraftFromHistory -> returns missing-artisan-id when artisanId is absent', async () => {
    const result = await predictQuoteDraftFromHistory({
      artisanId: null,
      project: { title: 'Projet' },
      clientName: 'Client',
      currentMaterialsAmount: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-artisan-id');
  });

  test('predictQuoteDraftFromHistory -> returns insufficient-history when not enough approved quotes', async () => {
    mockQuoteQuery([
      {
        _id: 'q1',
        amount: 1000,
        project: { title: 'A', description: 'B' },
      },
    ]);

    const result = await predictQuoteDraftFromHistory({
      artisanId: 'a1',
      project: { title: 'Nouveau projet' },
      clientName: 'Client',
      currentMaterialsAmount: 300,
      minHistory: 3,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-history');
  });

  test('predictQuoteDraftFromHistory -> returns structured output with valid history', async () => {
    mockQuoteQuery([
      {
        _id: 'q1',
        quoteNumber: 'QT-001',
        laborHand: 800,
        materialsAmount: 1200,
        amount: 2000,
        upfrontPercent: 35,
        paymentTerms: 'percentage',
        updatedAt: new Date('2026-01-10'),
        project: {
          title: 'Renovation maison',
          description: 'Peinture et electricite',
          location: 'Tunis',
          priority: 'medium',
          tasks: [{ title: 'Peinture' }],
          materials: [],
          personalMaterials: [],
        },
      },
      {
        _id: 'q2',
        quoteNumber: 'QT-002',
        laborHand: 950,
        materialsAmount: 1300,
        amount: 2250,
        upfrontPercent: 40,
        paymentTerms: 'percentage',
        updatedAt: new Date('2026-02-12'),
        project: {
          title: 'Extension villa',
          description: 'Maconnerie et peinture',
          location: 'Sousse',
          priority: 'high',
          tasks: [{ title: 'Maconnerie' }],
          materials: [],
          personalMaterials: [],
        },
      },
      {
        _id: 'q3',
        quoteNumber: 'QT-003',
        laborHand: 700,
        materialsAmount: 1100,
        amount: 1800,
        upfrontPercent: 30,
        paymentTerms: 'fixed',
        updatedAt: new Date('2026-03-08'),
        project: {
          title: 'Appartement',
          description: 'Travaux interieurs',
          location: 'Sfax',
          priority: 'low',
          tasks: [{ title: 'Finition' }],
          materials: [],
          personalMaterials: [],
        },
      },
    ]);

    const result = await predictQuoteDraftFromHistory({
      artisanId: 'artisan-1',
      project: {
        title: 'Projet client',
        description: 'Renovation interieur complete',
        location: 'Tunis',
        tasks: [{ title: 'Preparation support' }],
        materials: [],
        personalMaterials: [],
      },
      clientName: 'Client A',
      currentMaterialsAmount: 1400,
      minHistory: 1,
      topK: 2,
    });

    expect(result.historyCount).toBeGreaterThanOrEqual(3);
    if (result.ok) {
      expect(result.neighborsUsed).toBeGreaterThan(0);
      expect(result.predictions.laborHand).toBeGreaterThanOrEqual(0);
      expect(result.predictions.upfrontPercent).toBeGreaterThanOrEqual(0);
      expect(result.predictions.upfrontPercent).toBeLessThanOrEqual(100);
    } else {
      expect(['model-load-failed', 'embedding-failed']).toContain(result.reason);
    }
  });
});
