const {
  CATEGORY_DEFINITIONS,
  analyzeProjectDescription,
  norm,
} = require('../../../utils/categoryKeywords');

describe('categoryKeywords utility', () => {
  test('norm -> lowercases and strips accents', () => {
    expect(norm('Électricité Générale')).toBe('electricite generale');
  });

  test('analyzeProjectDescription -> detects best category with confidence', () => {
    const result = analyzeProjectDescription(
      'Installation tableau electrique cable prise et interrupteur',
      'mise en norme electrique'
    );

    expect(result).toEqual(
      expect.objectContaining({
        category: 'Électricité',
        matchCount: expect.any(Number),
        confidence: expect.any(Number),
        matchedKeywords: expect.any(Array),
        categoryPatterns: expect.any(Array),
        allScores: expect.any(Object),
      })
    );
    expect(result.matchCount).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.allScores['Électricité']).toBeGreaterThan(0);
    expect(result.matchedKeywords.length).toBe(result.matchCount);
    expect(result.categoryPatterns.every((pattern) => pattern instanceof RegExp)).toBe(true);
  });

  test('analyzeProjectDescription -> returns null category for very short text', () => {
    const result = analyzeProjectDescription('ok', '');

    expect(result.category).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.matchCount).toBe(0);
    expect(result.categoryPatterns).toEqual([]);
    expect(result.allScores).toEqual({});
  });

  test('analyzeProjectDescription -> handles null/undefined/empty inputs safely', () => {
    const samples = [
      [null, undefined],
      [undefined, ''],
      ['', '   '],
    ];

    samples.forEach(([projectText, constraint]) => {
      const result = analyzeProjectDescription(projectText, constraint);

      expect(result).toEqual({
        category: null,
        confidence: 0,
        matchCount: 0,
        matchedKeywords: [],
        categoryPatterns: [],
        allScores: {},
      });
    });
  });

  test('analyzeProjectDescription -> returns null category when no keyword matches', () => {
    const result = analyzeProjectDescription('texte sans mots metier specifiques', 'aucun indice');

    expect(result.category).toBeNull();
    expect(result.matchCount).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.categoryPatterns).toEqual([]);
    expect(Object.keys(result.allScores)).toHaveLength(Object.keys(CATEGORY_DEFINITIONS).length);
    expect(Object.values(result.allScores).every((score) => score === 0)).toBe(true);
  });

  test('CATEGORY_DEFINITIONS -> exposes expected major categories and valid structures', () => {
    const expectedCategories = ['Maçonnerie', 'Béton', 'Plomberie', 'Électricité'];

    expectedCategories.forEach((categoryName) => {
      expect(CATEGORY_DEFINITIONS).toHaveProperty(categoryName);
      expect(Array.isArray(CATEGORY_DEFINITIONS[categoryName].keywords)).toBe(true);
      expect(CATEGORY_DEFINITIONS[categoryName].keywords.length).toBeGreaterThan(0);
      expect(Array.isArray(CATEGORY_DEFINITIONS[categoryName].categoryPatterns)).toBe(true);
      expect(CATEGORY_DEFINITIONS[categoryName].categoryPatterns.length).toBeGreaterThan(0);
      expect(
        CATEGORY_DEFINITIONS[categoryName].categoryPatterns.every((pattern) => pattern instanceof RegExp)
      ).toBe(true);
    });
  });
});
