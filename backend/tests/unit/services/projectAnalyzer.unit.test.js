const {
  normalise,
  containsKeyword,
  mapCategoryToProjectType,
  detectProjectType,
} = require('../../../services/projectAnalyzer');

describe('projectAnalyzer', () => {
  test('detectProjectType -> finds best match with confidence', () => {
    const result = detectProjectType({
      title: 'Installation tableau electrique et cable',
      description: 'Ajouter disjoncteur et prises dans la maison',
    });

    expect(result.primaryType).toBe('Electricite');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  test('detectProjectType -> resolves tie with fallback category', () => {
    const result = detectProjectType({
      title: 'Travaux cable tuyau',
      description: 'cable et tuyau',
      fallbackCategory: 'Plomberie',
    });

    expect(result.primaryType).toBeTruthy();
    expect(['Plomberie', 'Electricite']).toContain(result.primaryType);
  });

  test('detectProjectType -> returns fallback when no keyword match', () => {
    const result = detectProjectType({
      title: 'Projet generique',
      description: 'aucun mot technique',
      fallbackCategory: 'Beton',
    });

    expect(result.primaryType).toBe('Beton & Ciment');
    expect(result.usedFallback).toBe(true);
  });

  test('helpers -> normalise/containsKeyword/mapCategoryToProjectType', () => {
    expect(normalise('Électricité générale')).toBe('electricite generale');
    expect(containsKeyword('installation cable gaine', 'cable')).toBe(true);
    expect(containsKeyword('installation cable gaine', 'cab')).toBe(false);
    expect(mapCategoryToProjectType('Beton')).toBe('Beton & Ciment');
    expect(mapCategoryToProjectType('Unknown')).toBeNull();
  });
});
