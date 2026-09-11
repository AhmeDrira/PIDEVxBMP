const {
  computeElectricalLines,
  computeTemplateLines,
  hasCalculator,
} = require('../../../services/quoteCalculators');
const { QUOTE_CALCULATION_FACTORS } = require('../../../services/quoteCalculationFactors');
const {
  QUOTE_UNITS,
  QUOTE_LINE_TYPES,
  listQuoteTemplates,
} = require('../../../utils/quoteTemplates');

const ELEC = QUOTE_CALCULATION_FACTORS['Electrical Installation'];

const pt = (typeCircuit, typePoint = 'point_lumineux', modePose = 'apparent') => ({
  typeCircuit,
  typePoint,
  modePose,
});

/** n points identiques, pour saturer un circuit. */
const nPoints = (n, ...args) => Array.from({ length: n }, () => pt(...args));

const base = (pointsElectriques, extra = {}) => ({
  typeTableau: 'neuf',
  longueurCableMl: 0,
  pointsElectriques,
  ...extra,
});

const findLine = (lines, fragment) =>
  lines.find((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

const findAll = (lines, fragment) =>
  lines.filter((line) => line.designation.toLowerCase().includes(fragment.toLowerCase()));

describe('quoteCalculators - electricite', () => {
  test('computeElectricalLines -> every line matches the Quote schema enums', () => {
    const lines = computeElectricalLines(
      base(
        [
          pt('eclairage', 'point_lumineux', 'encastre'),
          pt('prise_courante', 'prise_simple', 'goulotte'),
          pt('prise_specialisee', 'prise_simple', 'apparent'),
        ],
        { longueurCableMl: 30 }
      )
    );

    lines.forEach((line) => {
      expect(QUOTE_UNITS).toContain(line.unit);
      expect(QUOTE_LINE_TYPES).toContain(line.lineType);
      expect(line.designation.length).toBeGreaterThan(0);
      expect(line.quantity).toBeGreaterThan(0);
      expect(line.unitPrice).toBe(0);
      expect(line.total).toBe(0);
    });
  });

  // ── Bloc tableau ───────────────────────────────────────────────────────────

  test('computeElectricalLines -> a new board lays its four fixed lines once', () => {
    const lines = computeElectricalLines(base(nPoints(5, 'eclairage')));

    ELEC.tableauNeuf.forEach((attendue) => {
      const ligne = findLine(lines, attendue.designation);
      expect(ligne).toBeTruthy();
      expect(ligne.quantity).toBe(attendue.quantity);
      expect(ligne.unit).toBe(attendue.unit);
    });
    // Une seule fois, quel que soit le nombre de points.
    expect(findAll(lines, 'coffret tableau')).toHaveLength(1);
    // Et rien du bloc extension.
    expect(findLine(lines, 'diagnostic')).toBeUndefined();
  });

  test('computeElectricalLines -> an extension replaces the new-board block', () => {
    const lines = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { typeTableau: 'extension' })
    );

    expect(findLine(lines, 'diagnostic tableau existant')).toBeTruthy();
    expect(findLine(lines, 'coffret tableau')).toBeUndefined();
    expect(findLine(lines, 'raccordement compteur')).toBeUndefined();
  });

  test('computeElectricalLines -> the extra row depends on the declared fullness', () => {
    const plein = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { typeTableau: 'extension', tableauPlein: 'oui' })
    );
    const pasPlein = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { typeTableau: 'extension', tableauPlein: 'non' })
    );

    expect(findLine(plein, 'rangée additionnelle')).toBeTruthy();
    expect(findLine(pasPlein, 'rangée additionnelle')).toBeUndefined();

    // Champ absent : traite comme « non », pas comme une erreur.
    const sansChamp = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { typeTableau: 'extension' })
    );
    expect(findLine(sansChamp, 'rangée additionnelle')).toBeUndefined();
  });

  test('computeElectricalLines -> a new board ignores the fullness flag', () => {
    const lines = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { typeTableau: 'neuf', tableauPlein: 'oui' })
    );

    expect(findLine(lines, 'rangée additionnelle')).toBeUndefined();
  });

  test('computeElectricalLines -> the extension breaker counts every circuit', () => {
    // 2 specialisees (max 1 chacune) + 9 eclairages (max 8) = 2 + 2 = 4 circuits.
    const lines = computeElectricalLines(
      base(
        [...nPoints(2, 'prise_specialisee', 'prise_simple'), ...nPoints(9, 'eclairage')],
        { typeTableau: 'extension' }
      )
    );

    expect(findLine(lines, 'disjoncteur nouveau circuit').quantity).toBe(4);
  });

  // ── Regroupement en circuits ───────────────────────────────────────────────

  test('computeElectricalLines -> one circuit per type below the point ceiling', () => {
    const lines = computeElectricalLines(
      base([...nPoints(3, 'eclairage'), ...nPoints(2, 'prise_courante', 'prise_simple')])
    );

    expect(findLine(lines, `disjoncteur ${ELEC.CIRCUITS.eclairage.calibreA}a`).quantity).toBe(1);
    expect(findLine(lines, `disjoncteur ${ELEC.CIRCUITS.prise_courante.calibreA}a`).quantity).toBe(1);
    // Pas de circuit pour un type absent.
    expect(findLine(lines, `disjoncteur ${ELEC.CIRCUITS.prise_specialisee.calibreA}a`)).toBeUndefined();
  });

  test('computeElectricalLines -> splits into extra circuits above the ceiling', () => {
    const max = ELEC.CIRCUITS.eclairage.pointsMax;

    // Pile au maximum : un seul circuit.
    const pile = computeElectricalLines(base(nPoints(max, 'eclairage')));
    expect(findLine(pile, 'disjoncteur 10a').quantity).toBe(1);

    // Un de plus : il en faut deux.
    const unDePlus = computeElectricalLines(base(nPoints(max + 1, 'eclairage')));
    expect(findLine(unDePlus, 'disjoncteur 10a').quantity).toBe(2);

    // Et le decompte suit l'arrondi superieur.
    const beaucoup = computeElectricalLines(base(nPoints(max * 2 + 1, 'eclairage')));
    expect(findLine(beaucoup, 'disjoncteur 10a').quantity).toBe(3);
  });

  test('computeElectricalLines -> a specialised outlet gets its own circuit each', () => {
    // pointsMax vaut 1 : trois prises specialisees, trois circuits.
    const lines = computeElectricalLines(base(nPoints(3, 'prise_specialisee', 'prise_simple')));

    expect(findLine(lines, 'disjoncteur 32a').quantity).toBe(3);
  });

  test('computeElectricalLines -> the circuit count is spelled out only when above one', () => {
    const unSeul = computeElectricalLines(base(nPoints(4, 'eclairage')));
    expect(findLine(unSeul, 'disjoncteur 10a').designation).toBe('Disjoncteur 10A');

    const plusieurs = computeElectricalLines(base(nPoints(10, 'eclairage')));
    expect(findLine(plusieurs, 'disjoncteur 10a').designation).toBe('Disjoncteur 10A (2 circuits)');
  });

  // ── Lignes de points ───────────────────────────────────────────────────────

  test('computeElectricalLines -> one line per point type, all circuits merged', () => {
    const lines = computeElectricalLines(
      base([
        pt('eclairage', 'point_lumineux'),
        pt('eclairage', 'point_lumineux'),
        pt('eclairage', 'interrupteur'),
        pt('prise_courante', 'prise_simple'),
        // Une prise simple sur un autre circuit compte dans la meme ligne.
        pt('prise_specialisee', 'prise_simple'),
      ])
    );

    expect(findLine(lines, 'point lumineux').quantity).toBe(2);
    expect(findLine(lines, 'interrupteur').quantity).toBe(1);
    expect(findAll(lines, 'prise simple')).toHaveLength(1);
    expect(findLine(lines, 'prise simple').quantity).toBe(2);
    expect(findLine(lines, 'point lumineux').unit).toBe('unité');
  });

  // ── Main d'œuvre ───────────────────────────────────────────────────────────

  test('computeElectricalLines -> labor is weighted point by point', () => {
    const lines = computeElectricalLines(
      base([
        pt('eclairage', 'point_lumineux', 'apparent'),
        pt('eclairage', 'point_lumineux', 'encastre'),
        pt('eclairage', 'point_lumineux', 'goulotte'),
      ])
    );
    const labor = findLine(lines, "main d'œuvre");

    expect(labor.quantity).toBeCloseTo(
      ELEC.multiplicateurPose.apparent
        + ELEC.multiplicateurPose.encastre
        + ELEC.multiplicateurPose.goulotte,
      2
    );
    expect(labor.lineType).toBe('labor');
    expect(labor.unit).toBe('unité');
    expect(findAll(lines, "main d'œuvre")).toHaveLength(1);
  });

  test('computeElectricalLines -> exposed mounting leaves the point count untouched', () => {
    const lines = computeElectricalLines(base(nPoints(6, 'eclairage')));

    expect(findLine(lines, "main d'œuvre").quantity).toBe(6);
  });

  test('the flush-mount multiplier is shared with plumbing, not duplicated', () => {
    // Le referentiel dit « meme logique, pas a reinventer » : une recalibration
    // doit bouger les deux metiers ensemble.
    expect(ELEC.multiplicateurPose.encastre).toBe(
      QUOTE_CALCULATION_FACTORS.Plumbing.multiplicateurEncastre
    );
  });

  // ── Câble ──────────────────────────────────────────────────────────────────

  test('computeElectricalLines -> the declared cable length becomes the quantity', () => {
    const lines = computeElectricalLines(
      base(nPoints(3, 'eclairage'), { longueurCableMl: 47.5 })
    );
    const cable = findLine(lines, 'câble');

    // Declaratif : le referentiel dit cette valeur « non forfaitaire », donc on
    // ne la calcule pas, on la reprend telle quelle.
    expect(cable.quantity).toBe(47.5);
    expect(cable.unit).toBe('ml');
  });

  test('computeElectricalLines -> no cable line when no length is declared', () => {
    expect(findLine(computeElectricalLines(base(nPoints(3, 'eclairage'))), 'câble'))
      .toBeUndefined();
    // Champ absent : traite comme zero.
    const sansChamp = computeElectricalLines({
      typeTableau: 'neuf',
      pointsElectriques: nPoints(3, 'eclairage'),
    });
    expect(findLine(sansChamp, 'câble')).toBeUndefined();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  test.each([
    ['no list at all', { typeTableau: 'neuf' }],
    ['an empty list', base([])],
    ['a non-array', base('eclairage')],
  ])('computeElectricalLines -> rejects %s', (_label, params) => {
    expect(() => computeElectricalLines(params)).toThrow(/at least one point/);
  });

  test('computeElectricalLines -> error messages point at the offending item', () => {
    expect(() =>
      computeElectricalLines(base([pt('eclairage'), pt('chauffage')]))
    ).toThrow(/pointsElectriques\[1\]\.typeCircuit must be one of/);

    expect(() =>
      computeElectricalLines(base([pt('eclairage'), pt('eclairage', 'variateur')]))
    ).toThrow(/pointsElectriques\[1\]\.typePoint must be one of/);

    expect(() =>
      computeElectricalLines(base([pt('eclairage', 'point_lumineux', 'suspendu')]))
    ).toThrow(/pointsElectriques\[0\]\.modePose must be one of/);
  });

  test.each([
    ['unknown board type', base(nPoints(1, 'eclairage'), { typeTableau: 'renove' }), /typeTableau/],
    ['unknown fullness flag', base(nPoints(1, 'eclairage'), { typeTableau: 'extension', tableauPlein: 'peut-etre' }), /tableauPlein/],
    ['negative cable length', base(nPoints(1, 'eclairage'), { longueurCableMl: -5 }), /longueurCableMl/],
  ])('computeElectricalLines -> rejects %s', (_label, params, pattern) => {
    expect(() => computeElectricalLines(params)).toThrow(pattern);
  });

  // ── Cohérence config / modèle ──────────────────────────────────────────────

  test('the template circuit options match the CIRCUITS keys exactly', () => {
    const template = listQuoteTemplates().find((t) => t.id === 'electricien-5-points');
    const liste = template.parameters.find((p) => p.type === 'list');
    const typeCircuit = liste.itemFields.find((f) => f.key === 'typeCircuit');

    expect(typeCircuit.options.map((o) => o.value).sort()).toEqual(
      Object.keys(ELEC.CIRCUITS).sort()
    );
  });

  test('the template mounting options match the multiplier keys exactly', () => {
    const template = listQuoteTemplates().find((t) => t.id === 'electricien-5-points');
    const liste = template.parameters.find((p) => p.type === 'list');
    const modePose = liste.itemFields.find((f) => f.key === 'modePose');

    expect(modePose.options.map((o) => o.value).sort()).toEqual(
      Object.keys(ELEC.multiplicateurPose).sort()
    );
  });

  test('every trade template is now auto-calculated', () => {
    ['carreleur-salle-de-bain-8m2', 'peintre-piece-25m2', 'plombier-3-points-eau', 'electricien-5-points']
      .forEach((id) => expect(hasCalculator(id)).toBe(true));
    expect(hasCalculator('inconnu')).toBe(false);
  });

  test('the electrical template is reachable through the registry', () => {
    const params = base(nPoints(2, 'eclairage'));

    expect(computeTemplateLines('electricien-5-points', params))
      .toEqual(computeElectricalLines(params));
  });
});
