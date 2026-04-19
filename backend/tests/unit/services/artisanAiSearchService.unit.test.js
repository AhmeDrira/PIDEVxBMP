const {
  analyzeIntent,
  buildMongoFilter,
  searchArtisansWithAI,
  __setEmbeddingProviderForTests,
  __resetEmbeddingProviderForTests,
} = require('../../../services/artisanAiSearchService');

const embeddingProvider = async (texts) =>
  texts.map((text) => {
    const value = String(text || '').toLowerCase();
    if (value.includes('plumb') || value.includes('plomb')) return [1, 0, 0];
    if (value.includes('elect')) return [0, 1, 0];
    if (value.includes('tunis')) return [0.8, 0.2, 0];
    return [0.3, 0.3, 0.3];
  });

const makeArtisan = (overrides = {}) => ({
  _id: overrides._id || `artisan-${Math.random()}`,
  firstName: 'John',
  lastName: 'Doe',
  status: 'active',
  domain: 'Plumbing',
  location: 'Tunis',
  bio: 'Experienced plumbing artisan',
  skills: ['plumbing'],
  certifications: ['ISO'],
  yearsExperience: 10,
  rating: 4.6,
  completedProjects: 12,
  completedProjectDetails: [
    {
      title: 'Bathroom renovation',
      description: 'Full plumbing and sink installation',
      location: 'Tunis',
    },
  ],
  ...overrides,
});

describe('artisanAiSearchService (unit)', () => {
  afterEach(() => {
    __resetEmbeddingProviderForTests();
  });

  it('should analyze intent and extract filters from user query', () => {
    // Arrange
    const query = 'Need certified plumbing artisan in Tunis with over 5 years and rating over 4';

    // Act
    const analysis = analyzeIntent(query);

    // Assert
    expect(analysis.matchedDomains).toContain('Plumbing');
    expect(analysis.matchedLocations).toContain('tunis');
    expect(analysis.minYearsExperience).toBe(5);
    expect(analysis.minRating).toBe(4);
    expect(analysis.requiresCertification).toBe(true);
  });

  it('should build a strict mongo filter from analysis constraints', () => {
    // Arrange
    const analysis = analyzeIntent('certified plumber in Tunis over 3 years');

    // Act
    const filter = buildMongoFilter(analysis);

    // Assert
    expect(filter.status).toBe('active');
    expect(Array.isArray(filter.$and)).toBe(true);
    expect(filter.$and.some((clause) => clause.yearsExperience?.$gte === 3)).toBe(true);
    expect(
      filter.$and.some((clause) => clause.certifications?.$exists === true)
    ).toBe(true);
    expect(
      filter.$and.some(
        (clause) => Array.isArray(clause.$or) && clause.$or.some((entry) => entry.location)
      )
    ).toBe(true);
  });

  it('should return ranked artisans and respect active-only and limit rules', async () => {
    // Arrange
    __setEmbeddingProviderForTests(embeddingProvider);
    const artisans = [
      makeArtisan({ _id: 'a-1', domain: 'Plumbing', rating: 4.9, completedProjects: 18 }),
      makeArtisan({ _id: 'a-2', domain: 'Electrical Installation', rating: 4.3, completedProjects: 9 }),
      makeArtisan({ _id: 'a-3', status: 'inactive', rating: 5 }),
    ];

    // Act
    const result = await searchArtisansWithAI(artisans, 'top plumbing artisan in tunis', { limit: 1 });

    // Assert
    expect(result.analysis.query).toBe('top plumbing artisan in tunis');
    expect(result.artisans).toHaveLength(1);
    expect(result.artisans[0]._id).toBe('a-1');
    expect(result.artisans[0].status).toBe('active');
    expect(result.artisans[0].finalScore).toBeGreaterThan(0);
  });

  it('should reject when embedding provider fails and enforce certification/experience filtering', async () => {
    // Arrange
    __setEmbeddingProviderForTests(embeddingProvider);
    const artisans = [
      makeArtisan({ _id: 'a-10', certifications: [], yearsExperience: 12 }),
      makeArtisan({ _id: 'a-11', certifications: ['A'], yearsExperience: 7 }),
      makeArtisan({ _id: 'a-12', certifications: ['A'], yearsExperience: 15 }),
    ];

    // Act
    const filtered = await searchArtisansWithAI(
      artisans,
      'certified plumbing artisan over 8 years in tunis',
      { limit: 5 }
    );

    // Assert
    expect(filtered.artisans).toHaveLength(1);
    expect(filtered.artisans[0]._id).toBe('a-12');
    expect(filtered.artisans[0].yearsExperience).toBeGreaterThanOrEqual(8);
    expect(filtered.artisans[0].certifications.length).toBeGreaterThan(0);

    // Arrange
    __setEmbeddingProviderForTests(async () => {
      throw new Error('embedding provider unavailable');
    });

    // Act + Assert
    await expect(searchArtisansWithAI(artisans, 'plumbing help')).rejects.toThrow(
      'embedding provider unavailable'
    );
  });
});
