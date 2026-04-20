const service = require('../../../services/artisanAiSearchService');

describe('artisanAiSearchService', () => {
  afterEach(() => {
    service.__resetEmbeddingProviderForTests();
    jest.clearAllMocks();
  });

  test('analyzeIntent -> extracts domain/location and numeric constraints', () => {
    const result = service.analyzeIntent('Je cherche un electricien a Tunis avec au moins 5 ans d experience et rating above 4');

    expect(result.matchedDomains).toContain('Electrical Installation');
    expect(result.matchedLocations).toContain('tunis');
    expect(result.minYearsExperience).toBe(5);
    expect(result.minRating).toBe(4);
    expect(result.hasSemanticIntent).toBe(true);
    expect(result.semanticTerms).toEqual(expect.arrayContaining(['electricien', 'tunis']));
  });

  test('buildMongoFilter -> builds active filter with clauses', () => {
    const analysis = service.analyzeIntent('plombier a sfax avec plus de 3 ans et certifie');
    const filter = service.buildMongoFilter(analysis);

    expect(filter.status).toBe('active');
    expect(Array.isArray(filter.$and)).toBe(true);
    expect(filter.$and.length).toBeGreaterThan(0);
    expect(filter.$and).toEqual(
      expect.arrayContaining([
        { yearsExperience: { $gte: 3 } },
        { certifications: { $exists: true, $ne: [] } },
      ])
    );
    expect(filter.$and.some((clause) => Array.isArray(clause.$or))).toBe(true);
  });

  test('searchArtisansWithAI -> ranks active artisans and returns highlights', async () => {
    service.__setEmbeddingProviderForTests(async (texts) =>
      texts.map((text) => {
        const normalized = String(text || '').toLowerCase();
        if (normalized.includes('elect')) return [1, 0, 0];
        if (normalized.includes('plomb')) return [0, 1, 0];
        return [0.4, 0.3, 0.3];
      })
    );

    const artisans = [
      {
        _id: 'a1',
        status: 'active',
        firstName: 'Ali',
        lastName: 'Electric',
        domain: 'Electrical Installation',
        location: 'Tunis',
        bio: 'Installation tableau et cable',
        skills: ['electricite'],
        certifications: ['certif A'],
        completedProjects: 12,
        yearsExperience: 9,
        rating: 4.6,
        completedProjectDetails: [
          { title: 'Tableau electrique villa', description: 'cablage complet', location: 'Tunis' },
        ],
      },
      {
        _id: 'a2',
        status: 'active',
        firstName: 'Brahim',
        lastName: 'Plombier',
        domain: 'Plumbing',
        location: 'Sfax',
        bio: 'Plomberie generale',
        skills: ['plomberie'],
        certifications: [],
        completedProjects: 5,
        yearsExperience: 4,
        rating: 4.1,
        completedProjectDetails: [
          { title: 'Salle de bain', description: 'douche et tuyauterie', location: 'Sfax' },
        ],
      },
    ];

    const result = await service.searchArtisansWithAI(
      artisans,
      'Je cherche un electricien a Tunis',
      { limit: 5 }
    );

    expect(result.analysis.query).toMatch(/electricien/i);
    expect(result.analysis.sortBy).toBe('finalScore');
    expect(result.analysis.semanticMode).toBe('test-provider');
    expect(result.artisans.length).toBeGreaterThan(0);
    expect(result.artisans[0]._id).toBe('a1');
    expect(result.artisans[0].aiMatchPercent).toBeGreaterThan(0);
    expect(Array.isArray(result.artisans[0].matchHighlights)).toBe(true);
    expect(result.artisans[0].matchHighlights.length).toBeGreaterThan(0);
  });

  test('searchArtisansWithAI -> returns empty list when constraints exclude all artisans', async () => {
    service.__setEmbeddingProviderForTests(async (texts) =>
      texts.map((text) => {
        const normalized = String(text || '').toLowerCase();
        if (normalized.includes('elect')) return [1, 0, 0];
        return [0.4, 0.3, 0.3];
      })
    );

    const artisans = [
      {
        _id: 'a3',
        status: 'active',
        firstName: 'Nader',
        lastName: 'Generaliste',
        domain: 'Electrical Installation',
        location: 'Tunis',
        bio: 'Depannage electrique',
        skills: ['electricite'],
        certifications: ['certif B'],
        completedProjects: 2,
        yearsExperience: 3,
        rating: 4.2,
        completedProjectDetails: [],
      },
    ];

    const result = await service.searchArtisansWithAI(
      artisans,
      'electricien a Tunis avec au moins 10 ans d experience et rating above 4.9',
      { limit: 5 }
    );

    expect(result.analysis.minYearsExperience).toBe(10);
    expect(result.analysis.minRating).toBe(4);
    expect(result.artisans).toEqual([]);
  });
});
