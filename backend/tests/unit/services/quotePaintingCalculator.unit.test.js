const {
  computePaintingLines,
  computeTemplateLines,
  hasCalculator,
} = require('../../../services/quoteCalculators');
const { QUOTE_CALCULATION_FACTORS } = require('../../../services/quoteCalculationFactors');
const { QUOTE_UNITS, QUOTE_LINE_TYPES } = require('../../../utils/quoteTemplates');

const PAINT = QUOTE_CALCULATION_FACTORS.Painting;

/** Chantier nominal : 25 m² de murs, sans plafond, renovation, support sain. */
const baseParams = {
  surfaceMurs: 25,
  surfacePlafond: 0,
  etatSupport: 'bon',
  contexte: 'renovation',
  typeFinition: 'mat',
  changementCouleur: 'non',
};

const findLine = (lines, fragment) =>
  lines.find((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

describe('quoteCalculators - peinture', () => {
  test('computePaintingLines -> every line matches the Quote schema enums', () => {
    const lines = computePaintingLines({
      ...baseParams,
      surfacePlafond: 12,
      etatSupport: 'mauvais',
      changementCouleur: 'oui',
    });

    lines.forEach((line) => {
      expect(QUOTE_UNITS).toContain(line.unit);
      expect(QUOTE_LINE_TYPES).toContain(line.lineType);
      expect(line.designation.length).toBeGreaterThan(0);
      expect(line.quantity).toBeGreaterThan(0);
      // Pas de catalogue de prix : l'artisan saisit les montants.
      expect(line.unitPrice).toBe(0);
      expect(line.total).toBe(0);
    });
  });

  test('computePaintingLines -> adds up walls and ceiling', () => {
    const lines = computePaintingLines({ ...baseParams, surfaceMurs: 25, surfacePlafond: 12 });
    const labor = findLine(lines, "main d'œuvre");

    expect(labor.quantity).toBe(37);
    expect(labor.unit).toBe('m²');
    expect(labor.lineType).toBe('labor');
  });

  test('computePaintingLines -> accepts a walls-only job', () => {
    const lines = computePaintingLines({ ...baseParams, surfacePlafond: 0 });

    expect(findLine(lines, "main d'œuvre").quantity).toBe(25);
  });

  test('computePaintingLines -> accepts a ceiling-only job', () => {
    const lines = computePaintingLines({ ...baseParams, surfaceMurs: 0, surfacePlafond: 14 });

    expect(findLine(lines, "main d'œuvre").quantity).toBe(14);
  });

  // ── Apprêt / ponçage : exclusifs selon le contexte ─────────────────────────

  test('computePaintingLines -> primer only on new work', () => {
    const neuf = computePaintingLines({ ...baseParams, contexte: 'neuf' });
    const renovation = computePaintingLines({ ...baseParams, contexte: 'renovation' });

    const appret = findLine(neuf, 'apprêt');
    expect(appret).toBeTruthy();
    expect(appret.quantity).toBe(Math.ceil(25 / PAINT.rendementM2ParLitre.appret));
    expect(appret.unit).toBe('litre');
    expect(appret.lineType).toBe('material');

    expect(findLine(renovation, 'apprêt')).toBeUndefined();
  });

  test('computePaintingLines -> sanding only on renovation, as a labor line', () => {
    const renovation = computePaintingLines({ ...baseParams, contexte: 'renovation' });
    const neuf = computePaintingLines({ ...baseParams, contexte: 'neuf' });

    const poncage = findLine(renovation, 'ponçage');
    expect(poncage).toBeTruthy();
    expect(poncage.lineType).toBe('labor');
    expect(poncage.quantity).toBe(25);
    expect(poncage.unit).toBe('m²');

    expect(findLine(neuf, 'ponçage')).toBeUndefined();
  });

  // ── Sous-couche : double condition ─────────────────────────────────────────

  test('computePaintingLines -> undercoat needs BOTH renovation and a radical colour change', () => {
    const cases = [
      { contexte: 'renovation', changementCouleur: 'oui', attendu: true },
      { contexte: 'renovation', changementCouleur: 'non', attendu: false },
      { contexte: 'neuf', changementCouleur: 'oui', attendu: false },
      { contexte: 'neuf', changementCouleur: 'non', attendu: false },
    ];

    cases.forEach(({ contexte, changementCouleur, attendu }) => {
      const lines = computePaintingLines({ ...baseParams, contexte, changementCouleur });
      expect(Boolean(findLine(lines, 'sous-couche'))).toBe(attendu);
    });
  });

  test('computePaintingLines -> undercoat volume follows its yield', () => {
    const lines = computePaintingLines({
      ...baseParams,
      contexte: 'renovation',
      changementCouleur: 'oui',
    });
    const sousCouche = findLine(lines, 'sous-couche');

    expect(sousCouche.quantity).toBe(Math.ceil(25 / PAINT.rendementM2ParLitre.sousCouche));
    expect(sousCouche.unit).toBe('litre');
  });

  test('computePaintingLines -> a missing colour-change flag is treated as "non"', () => {
    // Le champ est masque hors renovation : le frontend ne l'envoie pas.
    const lines = computePaintingLines({
      surfaceMurs: 25,
      surfacePlafond: 0,
      etatSupport: 'bon',
      contexte: 'renovation',
      typeFinition: 'mat',
    });

    expect(findLine(lines, 'sous-couche')).toBeUndefined();
  });

  // ── Enduit de rebouchage ───────────────────────────────────────────────────

  test('computePaintingLines -> filler line appears only when the substrate needs it', () => {
    expect(findLine(computePaintingLines({ ...baseParams, etatSupport: 'bon' }), 'enduit'))
      .toBeUndefined();

    const moyen = findLine(computePaintingLines({ ...baseParams, etatSupport: 'moyen' }), 'enduit');
    expect(moyen.quantity).toBe(Math.ceil(25 * PAINT.enduitKgParM2.moyen));
    expect(moyen.unit).toBe('kg');

    const mauvais = findLine(computePaintingLines({ ...baseParams, etatSupport: 'mauvais' }), 'enduit');
    expect(mauvais.quantity).toBe(Math.ceil(25 * PAINT.enduitKgParM2.mauvais));
    expect(mauvais.quantity).toBeGreaterThan(moyen.quantity);
  });

  // ── Peinture de finition ───────────────────────────────────────────────────

  test('computePaintingLines -> topcoat covers every coat at the finish yield', () => {
    const lines = computePaintingLines({ ...baseParams, surfaceMurs: 25, surfacePlafond: 12 });
    const finition = findLine(lines, 'finition');

    expect(finition.quantity).toBe(
      Math.ceil((37 * PAINT.couchesFinition) / PAINT.rendementM2ParLitre.finition.mat)
    );
    expect(finition.unit).toBe('litre');
  });

  test('computePaintingLines -> a glossier finish spreads further, so needs less paint', () => {
    const volume = (typeFinition) =>
      findLine(computePaintingLines({ ...baseParams, surfaceMurs: 100, typeFinition }), 'finition')
        .quantity;

    // Coherence du barème : rendement croissant => volume decroissant.
    expect(volume('mat')).toBeGreaterThan(volume('satine'));
    expect(volume('satine')).toBeGreaterThan(volume('brillant'));
  });

  test('computePaintingLines -> finish label is accented in the designation', () => {
    const lines = computePaintingLines({ ...baseParams, typeFinition: 'satine' });

    expect(findLine(lines, 'finition').designation).toContain('satiné');
  });

  // ── Lignes fixes et lignes volontairement absentes ─────────────────────────

  test('computePaintingLines -> keeps the consumables as a flat one-kit line', () => {
    const kit = findLine(computePaintingLines(baseParams), 'rouleau');

    expect(kit.quantity).toBe(1);
    expect(kit.unit).toBe('kit');
    expect(kit.lineType).toBe('material');
  });

  test('computePaintingLines -> does not compute masking tape nor drop sheets', () => {
    const lines = computePaintingLines({
      ...baseParams,
      etatSupport: 'mauvais',
      changementCouleur: 'oui',
    });

    // Elles dependent du perimetre des ouvertures et de la surface au sol,
    // donnees absentes de l'application : saisie manuelle.
    expect(findLine(lines, 'adhésif')).toBeUndefined();
    expect(findLine(lines, 'bâche')).toBeUndefined();
  });

  // ── Arrondis et conditionnement ────────────────────────────────────────────

  test('computePaintingLines -> no litre or kg line carries a meaningless decimal', () => {
    [12.4, 25, 33.33, 87.7].forEach((surfaceMurs) => {
      const lines = computePaintingLines({
        ...baseParams,
        surfaceMurs,
        surfacePlafond: 7.3,
        etatSupport: 'mauvais',
        changementCouleur: 'oui',
      });
      lines
        .filter((line) => line.unit === 'litre' || line.unit === 'kg')
        .forEach((line) => {
          expect(Number.isInteger(line.quantity)).toBe(true);
        });
    });
  });

  test('computePaintingLines -> liquid lines state how many cans to order', () => {
    const lines = computePaintingLines({ ...baseParams, surfaceMurs: 200, contexte: 'neuf' });

    const appret = findLine(lines, 'apprêt');
    const bidonsAttendus = Math.ceil(appret.quantity / PAINT.conditionnementLitres.appret);
    expect(appret.designation).toContain(
      `${bidonsAttendus} bidons de ${PAINT.conditionnementLitres.appret} L`
    );

    const finition = findLine(lines, 'finition');
    expect(finition.designation).toContain(`de ${PAINT.conditionnementLitres.finition} L`);
  });

  test('computePaintingLines -> can count stays singular for a small job', () => {
    const finition = findLine(computePaintingLines({ ...baseParams, surfaceMurs: 5 }), 'finition');

    expect(finition.designation).toMatch(/1 bidon de/);
    expect(finition.designation).not.toMatch(/bidons/);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  test.each([
    ['both surfaces at zero', { ...baseParams, surfaceMurs: 0, surfacePlafond: 0 }, /greater than 0/],
    ['negative wall surface', { ...baseParams, surfaceMurs: -5 }, /surfaceMurs/],
    ['negative ceiling surface', { ...baseParams, surfacePlafond: -5 }, /surfacePlafond/],
    ['wall surface not a number', { ...baseParams, surfaceMurs: 'vingt' }, /surfaceMurs/],
    ['unknown substrate', { ...baseParams, etatSupport: 'humide' }, /etatSupport/],
    ['unknown context', { ...baseParams, contexte: 'extension' }, /contexte/],
    ['unknown finish', { ...baseParams, typeFinition: 'nacre' }, /typeFinition/],
    ['unknown colour flag', { ...baseParams, changementCouleur: 'peut-etre' }, /changementCouleur/],
  ])('computePaintingLines -> rejects %s', (_label, params, pattern) => {
    expect(() => computePaintingLines(params)).toThrow(pattern);
  });

  // ── Registre ───────────────────────────────────────────────────────────────

  test('the painting template is registered as auto-calculated', () => {
    expect(hasCalculator('peintre-piece-25m2')).toBe(true);
    expect(computeTemplateLines('peintre-piece-25m2', baseParams)).toEqual(
      computePaintingLines(baseParams)
    );
  });

  test('an unknown template has no calculator', () => {
    expect(hasCalculator('modele-inexistant')).toBe(false);
  });
});

describe('computePaintingLines - les murs se saisissent un par un', () => {
  const base = {
    surfacePlafond: 0,
    etatSupport: 'bon',
    contexte: 'renovation',
    typeFinition: 'mat',
  };
  const mainOeuvre = (params) => computeTemplateLines('peintre-piece-25m2', { ...base, ...params })
    .find((l) => l.lineType === 'labor');

  test('adds up several walls given as surfaces', () => {
    const ligne = mainOeuvre({ murs: [
      { mode: 'surface', surfaceM2: 10 },
      { mode: 'surface', surfaceM2: 5.5 },
    ] });

    expect(ligne.quantity).toBe(15.5);
  });

  test('multiplies a wall given as length by its height', () => {
    const ligne = mainOeuvre({ murs: [{ mode: 'longueur', longueurM: 3.56, hauteurM: 2.5 }] });

    expect(ligne.quantity).toBe(8.9);
  });

  test('mixes both ways of entering a wall in one list', () => {
    // Un plan donne parfois la surface d'un pignon et la longueur des autres.
    const ligne = mainOeuvre({ murs: [
      { mode: 'surface', surfaceM2: 12 },
      { mode: 'longueur', longueurM: 4, hauteurM: 2.5 },
    ] });

    expect(ligne.quantity).toBe(22);
  });

  test('reproduces the four walls of a 3,56 x 2,80 room under 2,50 m', () => {
    // Verite terrain du plan de validation : 2 x (3,56 + 2,80) x 2,50.
    const ligne = mainOeuvre({ murs: [3.56, 2.8, 3.56, 2.8].map((longueurM) => ({
      mode: 'longueur', longueurM, hauteurM: 2.5,
    })) });

    expect(ligne.quantity).toBe(31.8);
  });

  test('still accepts a plain surfaceMurs number', () => {
    // Les devis ouverts avant le passage a la liste doivent continuer a
    // calculer, et les appels directs au calculateur aussi.
    expect(mainOeuvre({ surfaceMurs: 25 }).quantity).toBe(25);
  });

  test('lets a wall be removed down to none, provided the ceiling carries it', () => {
    // « Plafond seul » reste un chantier valide.
    expect(mainOeuvre({ murs: [], surfacePlafond: 12 }).quantity).toBe(12);
  });

  test('refuses a quote where nothing at all is to be painted', () => {
    expect(() => mainOeuvre({ murs: [], surfacePlafond: 0 }))
      .toThrow(/greater than 0/);
  });

  test('names the offending wall when one is invalid', () => {
    expect(() => mainOeuvre({ murs: [
      { mode: 'surface', surfaceM2: 10 },
      { mode: 'longueur', longueurM: 'trois', hauteurM: 2.5 },
    ] })).toThrow(/murs\[1\]\.longueurM/);
  });

  test('rejects an unknown entry mode', () => {
    expect(() => mainOeuvre({ murs: [{ mode: 'diagonale', surfaceM2: 10 }] }))
      .toThrow(/murs\[0\]\.mode/);
  });
});
