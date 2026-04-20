const {
  getConversionFactor,
  calculateProductQuantity,
  CONVERSION_FACTORS,
} = require('../../../services/conversionFactors');

describe('conversionFactors service', () => {
  test('getConversionFactor -> finds specific factor by product name', () => {
    const factor = getConversionFactor('Parpaing beton 20x20x40');

    expect(factor).toBeTruthy();
    expect(factor.matchedKey).toBe('Parpaing');
    expect(factor.factor).toBe(CONVERSION_FACTORS.Parpaing.factor);
  });

  test('getConversionFactor -> is accent/case insensitive', () => {
    const factor = getConversionFactor('BETON PRET DOSAGE RAPIDE');

    expect(factor).toBeTruthy();
    expect(['Béton prêt', 'Beton pret']).toContain(factor.matchedKey);
  });

  test('calculateProductQuantity -> returns nominal converted quantity with margin', () => {
    const result = calculateProductQuantity('Carrelage grès', 20, 'm²', true);

    expect(result.isNonStandard).toBe(false);
    expect(result.quantity).toBeGreaterThanOrEqual(result.rawQuantity);
    expect(result.outputUnit).toBe('m²');
  });

  test('calculateProductQuantity -> falls back for unknown product', () => {
    const result = calculateProductQuantity('Produit inconnu XYZ', 12, 'm²', true);

    expect(result.isNonStandard).toBe(true);
    expect(result.factor).toBe(1);
    expect(result.warning).toMatch(/non standard/i);
  });

  test('calculateProductQuantity -> enforces lower bound quantity >= 1', () => {
    const result = calculateProductQuantity('Parpaing', 0, 'm²', false);

    expect(result.quantity).toBe(1);
  });
});
