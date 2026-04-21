const {
  calculateQuantity,
  getUnitsForCategory,
  getCategoryKeywords,
  getAllCategories,
  DEFAULT_SAFETY_MARGIN,
} = require('../../../services/conversionService');

describe('conversionService', () => {
  test('calculateQuantity -> nominal with default margin', () => {
    const result = calculateQuantity(15, 'm²', 'Maçonnerie');

    expect(result.factor).toBe(10);
    expect(result.applyMargin).toBe(true);
    expect(result.quantity).toBeGreaterThan(result.rawQuantity - 1);
    expect(result.formula).toMatch(/15 m²/);
  });

  test('calculateQuantity -> supports custom margin and no-margin mode', () => {
    const withMargin = calculateQuantity(10, 'm²', 'Carrelage', 0.2, true);
    const noMargin = calculateQuantity(10, 'm²', 'Carrelage', 0.2, false);

    expect(withMargin.quantity).toBeGreaterThanOrEqual(noMargin.quantity);
    expect(noMargin.applyMargin).toBe(false);
  });

  test('calculateQuantity -> unknown category falls back to direct quantity', () => {
    const result = calculateQuantity(8, 'm', 'UnknownCategory');

    expect(result.factor).toBe(1);
    expect(result.label).toMatch(/Quantité directe/i);
  });

  test('getUnitsForCategory/getCategoryKeywords/getAllCategories return coherent metadata', () => {
    expect(getUnitsForCategory('Béton')).toContain('m³');
    expect(getUnitsForCategory('Unknown')).toEqual(['pièce']);

    const keywords = getCategoryKeywords('Plomberie');
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);

    const categories = getAllCategories();
    const sortedCopy = [...categories].sort();
    expect(categories).toEqual(sortedCopy);
    expect(DEFAULT_SAFETY_MARGIN).toBe(0.1);
  });

  test('calculateQuantity -> lower bound keeps quantity >= 1', () => {
    const result = calculateQuantity(0, 'm²', 'Peinture');
    expect(result.quantity).toBe(1);
  });
});

describe('ConversionService - Tests additionnels pour couverture', () => {
  test('calculateQuantity -> uses piece fallback when unit is unsupported', () => {
    const result = calculateQuantity(5, 'unsupported-unit', 'Carrelage');

    expect(result.factor).toBe(1);
    expect(result.quantity).toBe(6);
  });

  test('calculateQuantity -> zero margin returns exact quantity', () => {
    const result = calculateQuantity(10, 'm', 'Plomberie', 0, true);

    expect(result.rawQuantity).toBe(10);
    expect(result.quantity).toBe(10);
  });

  test('calculateQuantity -> negative margin still keeps quantity >= 1', () => {
    const result = calculateQuantity(0.2, 'm²', 'Peinture', -0.9, true);

    expect(result.quantity).toBeGreaterThanOrEqual(1);
  });

  test('getUnitsForCategory -> returns ordered units for known category', () => {
    const units = getUnitsForCategory('Béton');

    expect(Array.isArray(units)).toBe(true);
    expect(units[0]).toBe('m³');
  });

  test('getCategoryKeywords -> unknown category returns empty array', () => {
    const keywords = getCategoryKeywords('categorie_inconnue');

    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords).toEqual([]);
  });

  test('getAllCategories -> includes expected domain categories', () => {
    const categories = getAllCategories();

    expect(categories).toContain('Carrelage');
    expect(categories).toContain('Béton');
  });
});
