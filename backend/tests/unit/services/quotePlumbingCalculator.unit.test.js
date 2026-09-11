const {
  computePlumbingLines,
  computeTemplateLines,
  aggregateLines,
  hasCalculator,
} = require('../../../services/quoteCalculators');
const { QUOTE_CALCULATION_FACTORS } = require('../../../services/quoteCalculationFactors');
const {
  QUOTE_UNITS,
  QUOTE_LINE_TYPES,
  listQuoteTemplates,
} = require('../../../utils/quoteTemplates');

const PLOMB = QUOTE_CALCULATION_FACTORS.Plumbing;
const TAUX = PLOMB.composantsParPoint;

const point = (sousType, modePose = 'apparent', distanceMl) => {
  const p = { sousType, modePose };
  if (distanceMl !== undefined) p.distanceMl = distanceMl;
  return p;
};

const findLine = (lines, fragment) =>
  lines.find((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

const findAll = (lines, fragment) =>
  lines.filter((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

describe('quoteCalculators - plomberie', () => {
  test('computePlumbingLines -> every line matches the Quote schema enums', () => {
    const lines = computePlumbingLines({
      pointsEau: [
        point('lavabo'),
        point('wc'),
        point('baignoire'),
        point('douche_italienne', 'encastre', 6),
      ],
    });

    lines.forEach((line) => {
      expect(QUOTE_UNITS).toContain(line.unit);
      expect(QUOTE_LINE_TYPES).toContain(line.lineType);
      expect(line.designation.length).toBeGreaterThan(0);
      expect(line.quantity).toBeGreaterThan(0);
      expect(line.unitPrice).toBe(0);
      expect(line.total).toBe(0);
    });
  });

  // ── Réseau amont ───────────────────────────────────────────────────────────

  test('computePlumbingLines -> always lays the upstream network once', () => {
    const unSeulPoint = computePlumbingLines({ pointsEau: [point('lavabo')] });
    const cinqPoints = computePlumbingLines({
      pointsEau: [point('lavabo'), point('evier'), point('wc'), point('baignoire'), point('lavabo')],
    });

    [unSeulPoint, cinqPoints].forEach((lines) => {
      // Une seule occurrence, quel que soit le nombre de points.
      expect(findAll(lines, 'raccordement au compteur')).toHaveLength(1);
      expect(findAll(lines, "vanne d'arrêt générale")).toHaveLength(1);
    });

    const raccordement = findLine(unSeulPoint, 'raccordement au compteur');
    expect(raccordement.quantity).toBe(PLOMB.reseauAmont.raccordementCompteur.quantity);
    expect(raccordement.unit).toBe(PLOMB.reseauAmont.raccordementCompteur.unit);
  });

  test('computePlumbingLines -> manifold appears strictly above the threshold', () => {
    const nPoints = (n) =>
      computePlumbingLines({ pointsEau: Array.from({ length: n }, () => point('lavabo')) });

    // Le referentiel dit « si > 3 points » : 3 n'en met pas, 4 oui.
    expect(findLine(nPoints(PLOMB.seuilNourrice), 'nourrice')).toBeUndefined();
    expect(findLine(nPoints(PLOMB.seuilNourrice + 1), 'nourrice')).toBeTruthy();

    const nourrice = findLine(nPoints(5), 'nourrice');
    expect(nourrice.quantity).toBe(PLOMB.reseauAmont.nourrice.quantity);
    expect(nourrice.unit).toBe(PLOMB.reseauAmont.nourrice.unit);
  });

  // ── Recettes par sous-type ────────────────────────────────────────────────

  test('computePlumbingLines -> supply lines follow the referential connection counts', () => {
    Object.entries(PLOMB.RECETTE_BASE).forEach(([sousType, recette]) => {
      const lines = computePlumbingLines({ pointsEau: [point(sousType)] });
      const tube = findLine(lines, 'tube cuivre');

      if (recette.alimentation === 0) {
        expect(tube).toBeUndefined();
        return;
      }
      expect(tube.quantity).toBeCloseTo(
        recette.alimentation * TAUX.tubeCuivreMlParAlimentation,
        2
      );
      expect(findLine(lines, 'raccords').quantity).toBe(
        recette.alimentation * TAUX.raccordsParAlimentation
      );
      expect(findLine(lines, "robinet d'arrêt").quantity).toBe(
        recette.alimentation * TAUX.robinetArretParAlimentation
      );
    });
  });

  test('computePlumbingLines -> a simple point has no drain and no trap', () => {
    const lines = computePlumbingLines({ pointsEau: [point('point_simple')] });

    // Referentiel : evacuation « 0-1 », pas de siphon systematique.
    expect(findLine(lines, 'tube évacuation')).toBeUndefined();
    expect(findLine(lines, 'siphon')).toBeUndefined();
  });

  test('computePlumbingLines -> a WC has no trap but a wider drain', () => {
    const lines = computePlumbingLines({ pointsEau: [point('wc')] });

    // Garde d'eau integree : pas de siphon a fournir.
    expect(findLine(lines, 'siphon')).toBeUndefined();
    expect(findLine(lines, 'tube évacuation').designation).toContain(
      String(PLOMB.RECETTE_BASE.wc.diametreEvacuationMm)
    );
  });

  test('computePlumbingLines -> an Italian shower gets a floor trap, not a plain one', () => {
    const lines = computePlumbingLines({ pointsEau: [point('douche_italienne')] });

    expect(findLine(lines, 'siphon de sol')).toBeTruthy();
    expect(findLine(lines, 'siphon').designation).toMatch(/siphon de sol/i);
  });

  test('computePlumbingLines -> shower tray and bath bring their own part', () => {
    const receveur = computePlumbingLines({ pointsEau: [point('douche_receveur')] });
    expect(findLine(receveur, 'receveur')).toBeTruthy();

    const baignoire = computePlumbingLines({ pointsEau: [point('baignoire')] });
    expect(findLine(baignoire, 'fixation')).toBeTruthy();
    expect(findLine(baignoire, 'fixation').unit).toBe('kit');
  });

  // ── Mode de pose ──────────────────────────────────────────────────────────

  test('computePlumbingLines -> flush mounting multiplies labor', () => {
    const apparent = computePlumbingLines({ pointsEau: [point('lavabo', 'apparent')] });
    const encastre = computePlumbingLines({ pointsEau: [point('lavabo', 'encastre', 0)] });

    const heures = (lines) => findLine(lines, "main d'œuvre").quantity;
    expect(heures(apparent)).toBe(PLOMB.mainOeuvreHeuresParPoint.lavabo);
    expect(heures(encastre)).toBeCloseTo(
      PLOMB.mainOeuvreHeuresParPoint.lavabo * PLOMB.multiplicateurEncastre,
      2
    );
  });

  test('computePlumbingLines -> the declared distance becomes the chase quantity', () => {
    const lines = computePlumbingLines({ pointsEau: [point('lavabo', 'encastre', 7.5)] });
    const saignee = findLine(lines, 'saignée');

    // Declaratif : la valeur saisie passe telle quelle, elle n'est pas calculee.
    expect(saignee.quantity).toBe(7.5);
    expect(saignee.unit).toBe('ml');
  });

  test('computePlumbingLines -> no chase line when mounting is exposed or distance is zero', () => {
    expect(findLine(computePlumbingLines({ pointsEau: [point('lavabo', 'apparent')] }), 'saignée'))
      .toBeUndefined();
    expect(findLine(computePlumbingLines({ pointsEau: [point('lavabo', 'encastre', 0)] }), 'saignée'))
      .toBeUndefined();
    // Champ absent : traite comme zero, pas comme une erreur.
    expect(findLine(computePlumbingLines({ pointsEau: [point('lavabo', 'encastre')] }), 'saignée'))
      .toBeUndefined();
  });

  test('computePlumbingLines -> chase distances add up across points', () => {
    const lines = computePlumbingLines({
      pointsEau: [point('lavabo', 'encastre', 4), point('wc', 'encastre', 2.5)],
    });

    expect(findLine(lines, 'saignée').quantity).toBe(6.5);
  });

  // ── Agrégation ────────────────────────────────────────────────────────────

  test('computePlumbingLines -> identical lines are merged, not repeated', () => {
    const lines = computePlumbingLines({
      pointsEau: [point('lavabo'), point('lavabo'), point('lavabo')],
    });

    expect(findAll(lines, 'tube cuivre')).toHaveLength(1);
    expect(findLine(lines, 'tube cuivre').quantity).toBeCloseTo(
      3 * PLOMB.RECETTE_BASE.lavabo.alimentation * TAUX.tubeCuivreMlParAlimentation,
      2
    );
    expect(findAll(lines, "main d'œuvre")).toHaveLength(1);
    expect(findLine(lines, "main d'œuvre").quantity).toBeCloseTo(
      3 * PLOMB.mainOeuvreHeuresParPoint.lavabo,
      2
    );
  });

  test('computePlumbingLines -> drains of different diameters stay separate', () => {
    const lines = computePlumbingLines({ pointsEau: [point('lavabo'), point('wc')] });
    const evacuations = findAll(lines, 'tube évacuation');

    // Un Ø40 et un Ø100 sont deux produits differents, ils ne fusionnent pas.
    expect(evacuations).toHaveLength(2);
    expect(new Set(evacuations.map((l) => l.designation)).size).toBe(2);
  });

  test('aggregateLines -> merges on designation, unit and type, keeping first order', () => {
    const merged = aggregateLines([
      { designation: 'A', quantity: 2, unit: 'ml', lineType: 'material', unitPrice: 0, total: 0 },
      { designation: 'B', quantity: 1, unit: 'unité', lineType: 'material', unitPrice: 0, total: 0 },
      { designation: 'A', quantity: 3, unit: 'ml', lineType: 'material', unitPrice: 0, total: 0 },
      // Meme designation mais autre unite : ligne distincte.
      { designation: 'A', quantity: 1, unit: 'kg', lineType: 'material', unitPrice: 0, total: 0 },
      // Meme designation et unite mais autre type : ligne distincte.
      { designation: 'A', quantity: 4, unit: 'ml', lineType: 'labor', unitPrice: 0, total: 0 },
    ]);

    expect(merged).toHaveLength(4);
    expect(merged[0]).toMatchObject({ designation: 'A', quantity: 5, unit: 'ml', lineType: 'material' });
    expect(merged[1].designation).toBe('B');
  });

  // ── Validation ────────────────────────────────────────────────────────────

  test.each([
    ['no list at all', {}],
    ['an empty list', { pointsEau: [] }],
    ['a non-array', { pointsEau: 'lavabo' }],
  ])('computePlumbingLines -> rejects %s', (_label, params) => {
    expect(() => computePlumbingLines(params)).toThrow(/at least one water point/);
  });

  test('computePlumbingLines -> error messages point at the offending item', () => {
    expect(() =>
      computePlumbingLines({ pointsEau: [point('lavabo'), point('wc'), point('jacuzzi')] })
    ).toThrow(/pointsEau\[2\]\.sousType must be one of/);

    expect(() =>
      computePlumbingLines({ pointsEau: [point('lavabo'), { sousType: 'wc', modePose: 'flottant' }] })
    ).toThrow(/pointsEau\[1\]\.modePose must be one of/);

    expect(() =>
      computePlumbingLines({ pointsEau: [point('lavabo', 'encastre', -3)] })
    ).toThrow(/pointsEau\[0\]\.distanceMl/);
  });

  // ── Cohérence config / modèle ─────────────────────────────────────────────

  test('the template sub-type options match the RECETTE_BASE keys exactly', () => {
    const template = listQuoteTemplates().find((t) => t.id === 'plombier-3-points-eau');
    const liste = template.parameters.find((p) => p.type === 'list');
    const sousType = liste.itemFields.find((f) => f.key === 'sousType');

    expect(sousType.options.map((o) => o.value).sort()).toEqual(
      Object.keys(PLOMB.RECETTE_BASE).sort()
    );
  });

  test('the plumbing template is registered as auto-calculated', () => {
    expect(hasCalculator('plombier-3-points-eau')).toBe(true);
    expect(computeTemplateLines('plombier-3-points-eau', { pointsEau: [point('lavabo')] }))
      .toEqual(computePlumbingLines({ pointsEau: [point('lavabo')] }));
  });
});
