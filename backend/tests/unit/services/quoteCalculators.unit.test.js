const {
  computeTilingLines,
  computeTemplateLines,
  hasCalculator,
} = require('../../../services/quoteCalculators');
const { QUOTE_CALCULATION_FACTORS } = require('../../../services/quoteCalculationFactors');
const { QUOTE_UNITS, QUOTE_LINE_TYPES } = require('../../../utils/quoteTemplates');

const TILING = QUOTE_CALCULATION_FACTORS.Tiling;

/** Parametres nominaux : 8 m² de sol, petit format, pose droite, support plan. */
const baseParams = {
  surface: 8,
  formatCarreau: 'petit',
  typePose: 'droite',
  position: 'sol',
  etatSupport: 'plan',
};

const findLine = (lines, fragment) =>
  lines.find((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

describe('quoteCalculators - carrelage', () => {
  test('computeTilingLines -> returns the 5 lines of a flat, small-format job', () => {
    const lines = computeTilingLines(baseParams);

    // Pas de ragreage sur un support plan : 6 lignes moins celle-la.
    expect(lines).toHaveLength(5);
    expect(findLine(lines, 'ragreage')).toBeUndefined();
    expect(findLine(lines, 'carreaux')).toBeTruthy();
    expect(findLine(lines, 'colle')).toBeTruthy();
    expect(findLine(lines, 'joint')).toBeTruthy();
    expect(findLine(lines, 'croisillons')).toBeTruthy();
    expect(findLine(lines, "main d'œuvre")).toBeTruthy();
  });

  test('computeTilingLines -> every line matches the Quote schema enums', () => {
    const lines = computeTilingLines({ ...baseParams, etatSupport: 'a_ragreer' });

    lines.forEach((line) => {
      expect(QUOTE_UNITS).toContain(line.unit);
      expect(QUOTE_LINE_TYPES).toContain(line.lineType);
      expect(typeof line.designation).toBe('string');
      expect(line.designation.length).toBeGreaterThan(0);
      expect(line.quantity).toBeGreaterThan(0);
      // Pas de catalogue de prix : l'artisan saisit les montants.
      expect(line.unitPrice).toBe(0);
      expect(line.total).toBe(0);
    });
  });

  test('computeTilingLines -> tile quantity carries the waste coefficient of the layout', () => {
    const droite = findLine(computeTilingLines(baseParams), 'carreaux');
    const chevrons = findLine(
      computeTilingLines({ ...baseParams, typePose: 'chevrons' }),
      'carreaux'
    );

    expect(droite.quantity).toBeCloseTo(8 * (1 + TILING.chute.droite), 2);
    expect(chevrons.quantity).toBeCloseTo(8 * (1 + TILING.chute.chevrons), 2);
    expect(chevrons.quantity).toBeGreaterThan(droite.quantity);
    expect(droite.unit).toBe('m²');
  });

  test('computeTilingLines -> glue follows position, format and safety margin', () => {
    const sol = findLine(computeTilingLines(baseParams), 'colle');
    const mur = findLine(computeTilingLines({ ...baseParams, position: 'mur' }), 'colle');

    // Produit en vrac : la quantite est plafonnee au kilo entier superieur.
    expect(sol.quantity).toBe(Math.ceil(8 * TILING.colleKgParM2.sol * TILING.colleMarge));
    expect(mur.quantity).toBe(Math.ceil(8 * TILING.colleKgParM2.mur * TILING.colleMarge));
    expect(sol.quantity).toBeGreaterThan(mur.quantity);
    expect(sol.unit).toBe('kg');
  });

  test('computeTilingLines -> large format triggers the double-buttering surcharge', () => {
    const petit = findLine(computeTilingLines(baseParams), 'colle');
    const grand = findLine(computeTilingLines({ ...baseParams, formatCarreau: 'grand' }), 'colle');

    expect(grand.quantity).toBe(
      Math.ceil(8 * TILING.colleKgParM2.sol * TILING.colleMajorationGrandFormat * TILING.colleMarge)
    );
    expect(grand.quantity).toBeGreaterThan(petit.quantity);
    expect(grand.designation).toMatch(/double encollage/i);
  });

  test('computeTilingLines -> grout uses the configured ratio', () => {
    const joint = findLine(computeTilingLines(baseParams), 'joint');

    expect(joint.quantity).toBe(Math.ceil(8 * TILING.jointKgParM2));
    expect(joint.unit).toBe('kg');
  });

  test('computeTilingLines -> levelling line appears only when the substrate needs it', () => {
    const plan = computeTilingLines(baseParams);
    const aRagreer = computeTilingLines({ ...baseParams, etatSupport: 'a_ragreer' });

    expect(findLine(plan, 'ragreage')).toBeUndefined();

    const ragreage = findLine(aRagreer, 'ragreage');
    expect(aRagreer).toHaveLength(6);
    expect(ragreage.quantity).toBe(Math.ceil(8 * TILING.ragreageKgParM2.a_ragreer));
    expect(ragreage.unit).toBe('kg');
  });

  test('computeTilingLines -> spacers use a per-m2 rate rounded up to whole units', () => {
    const croisillons = findLine(computeTilingLines({ ...baseParams, surface: 8.4 }), 'croisillons');

    expect(croisillons.quantity).toBe(Math.ceil(8.4 * TILING.croisillonsParM2));
    expect(Number.isInteger(croisillons.quantity)).toBe(true);
    expect(croisillons.unit).toBe('unité');
  });

  test('computeTilingLines -> keeps a labor line quantified by the surface', () => {
    const labor = findLine(computeTilingLines({ ...baseParams, surface: 12 }), "main d'œuvre");

    expect(labor.lineType).toBe('labor');
    expect(labor.quantity).toBe(12);
    expect(labor.unit).toBe('m²');
    // Le prix de pose reste saisi a la main.
    expect(labor.unitPrice).toBe(0);
  });

  test('computeTilingLines -> does not emit a skirting line (perimeter is unknown)', () => {
    const lines = computeTilingLines({ ...baseParams, etatSupport: 'a_ragreer' });

    expect(findLine(lines, 'plinthe')).toBeUndefined();
  });

  test('computeTilingLines -> no bulk line carries a meaningless decimal', () => {
    // Les coefficients sont provisoires a +/- 30 % : afficher 193,05 kg de colle
    // suggererait une precision au gramme qui n'existe pas.
    [8, 12.4, 30, 33.33].forEach((surface) => {
      const lines = computeTilingLines({ ...baseParams, surface, etatSupport: 'a_ragreer' });
      lines
        .filter((line) => line.unit === 'kg')
        .forEach((line) => {
          expect(Number.isInteger(line.quantity)).toBe(true);
        });
    });
  });

  test('computeTilingLines -> bulk lines state how many bags to order', () => {
    const lines = computeTilingLines({ ...baseParams, surface: 30, formatCarreau: 'grand', etatSupport: 'a_ragreer' });

    const colle = findLine(lines, 'colle');
    const sacsAttendus = Math.ceil(colle.quantity / TILING.conditionnementKg.colle);
    expect(colle.designation).toContain(`${sacsAttendus} sacs de ${TILING.conditionnementKg.colle} kg`);

    const joint = findLine(lines, 'joint');
    expect(joint.designation).toContain(`de ${TILING.conditionnementKg.joint} kg`);

    const ragreage = findLine(lines, 'ragreage');
    expect(ragreage.designation).toContain(`de ${TILING.conditionnementKg.ragreage} kg`);
  });

  test('computeTilingLines -> bag count stays singular for a small job', () => {
    const joint = findLine(computeTilingLines({ ...baseParams, surface: 2 }), 'joint');

    expect(joint.designation).toMatch(/1 sac de 5 kg/);
    expect(joint.designation).not.toMatch(/sacs/);
  });

  test.each([
    ['surface missing', { ...baseParams, surface: undefined }, /surface/],
    ['surface zero', { ...baseParams, surface: 0 }, /surface/],
    ['surface negative', { ...baseParams, surface: -3 }, /surface/],
    ['surface not a number', { ...baseParams, surface: 'douze' }, /surface/],
    ['unknown layout', { ...baseParams, typePose: 'zigzag' }, /typePose/],
    ['unknown format', { ...baseParams, formatCarreau: 'moyen' }, /formatCarreau/],
    ['unknown position', { ...baseParams, position: 'plafond' }, /position/],
    ['unknown substrate', { ...baseParams, etatSupport: 'humide' }, /etatSupport/],
  ])('computeTilingLines -> rejects %s', (_label, params, pattern) => {
    expect(() => computeTilingLines(params)).toThrow(pattern);
  });

  test('computeTilingLines -> scales linearly with the surface', () => {
    const small = computeTilingLines({ ...baseParams, surface: 10 });
    const large = computeTilingLines({ ...baseParams, surface: 20 });

    // Les m² ne sont pas plafonnes : le doublement y est exact.
    expect(findLine(large, 'carreaux').quantity).toBeCloseTo(
      findLine(small, 'carreaux').quantity * 2,
      2
    );

    // Les lignes en vrac sont arrondies au kilo, le doublement est donc
    // approche : l'ecart ne peut pas depasser 1 kg par arrondi.
    ['colle', 'joint'].forEach((produit) => {
      const attendu = findLine(small, produit).quantity * 2;
      expect(findLine(large, produit).quantity).toBeLessThanOrEqual(attendu);
      expect(findLine(large, produit).quantity).toBeGreaterThan(attendu - 2);
    });
  });
});

describe('quoteCalculators - registry', () => {
  test('hasCalculator -> the four trade templates are auto-calculated', () => {
    expect(hasCalculator('carreleur-salle-de-bain-8m2')).toBe(true);
    expect(hasCalculator('peintre-piece-25m2')).toBe(true);
    expect(hasCalculator('plombier-3-points-eau')).toBe(true);
    expect(hasCalculator('electricien-5-points')).toBe(true);
    expect(hasCalculator('inconnu')).toBe(false);
  });

  test('computeTemplateLines -> dispatches to the tiling calculator', () => {
    const viaRegistry = computeTemplateLines('carreleur-salle-de-bain-8m2', baseParams);

    expect(viaRegistry).toEqual(computeTilingLines(baseParams));
  });

  test('computeTemplateLines -> throws for an unregistered template', () => {
    // Plus aucun modele metier n'est fige : la garde protege desormais un
    // modele futur, ou un identifiant errone.
    expect(() => computeTemplateLines('modele-inexistant', baseParams)).toThrow(
      /not auto-calculated/
    );
  });
});
