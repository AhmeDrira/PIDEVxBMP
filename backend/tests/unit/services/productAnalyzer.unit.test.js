const {
  GENERIC_TERMS,
  collectProductSources,
  analyzeProductForProjectType,
} = require('../../../services/productAnalyzer');

describe('productAnalyzer', () => {
  test('collectProductSources -> aggregates product and tech profile text', () => {
    const sources = collectProductSources(
      {
        name: 'Carrelage gres',
        description: 'Carrelage sol interieur',
        keywords: ['carrelage', 'sol'],
      },
      {
        keywords: ['ceramique'],
        materials: ['gres'],
        norms: ['NF EN 1'],
      }
    );

    expect(sources.name).toMatch(/Carrelage/);
    expect(sources.keywords).toMatch(/carrelage/);
    expect(sources.pdf).toMatch(/NF EN 1/);
  });

  test('analyzeProductForProjectType -> strong match and bonus', () => {
    const result = analyzeProductForProjectType({
      projectType: 'Maconnerie',
      product: {
        name: 'Parpaing bloc brique',
        description: 'Maconnerie de mur porteur en brique',
        keywords: ['parpaing', 'brique'],
      },
      techProfile: { keywords: ['mortier'] },
    });

    expect(result.matchStrength).toBe('strong');
    expect(result.bonus).toBeGreaterThan(0);
    expect(result.shouldFilter).toBe(false);
  });

  test('analyzeProductForProjectType -> no match leads to filtering', () => {
    const result = analyzeProductForProjectType({
      projectType: 'Plomberie',
      product: {
        name: 'Peinture mate blanche',
        description: 'Peinture interieur',
        keywords: ['peinture'],
      },
      techProfile: null,
    });

    expect(result.matchStrength).toBe('none');
    expect(result.shouldFilter).toBe(true);
  });

  test('analyzeProductForProjectType -> generic-heavy text applies penalty', () => {
    const result = analyzeProductForProjectType({
      projectType: 'Peinture',
      product: {
        name: 'Produit standard professionnel',
        description: 'materiau universel durable construction standard',
        keywords: ['produit', 'materiaux', 'standard'],
      },
      techProfile: null,
    });

    expect(GENERIC_TERMS.has('standard')).toBe(true);
    expect(result.genericRatio).toBeGreaterThan(0);
    expect(result.penalty).toBeGreaterThanOrEqual(0);
  });
});
