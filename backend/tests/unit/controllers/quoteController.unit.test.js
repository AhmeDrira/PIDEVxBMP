const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Quote', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('../../../models/Invoice', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../models/Project', () => ({
  findOne: jest.fn(),
}));

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn((value) => value !== 'bad-id'),
    },
  },
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

jest.mock('../../../services/quoteAIDraftService', () => ({
  generateQuoteAIDraft: jest.fn(),
}));

jest.mock('../../../services/planReaderService', () => ({
  readPlan: jest.fn(),
  mapReading: jest.fn(),
}));

const Quote = require('../../../models/Quote');
const Project = require('../../../models/Project');
const { logAction } = require('../../../utils/actionLogger');
const { generateQuoteAIDraft } = require('../../../services/quoteAIDraftService');
const { readPlan, mapReading } = require('../../../services/planReaderService');
const controller = require('../../../controllers/quoteController');

describe('quoteController', () => {
  test('generateQuoteDraft -> 400 for invalid projectId', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'bad-id' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('generateQuoteDraft -> 404 when project is not found', async () => {
    Project.findOne.mockReturnValue(chainableQuery(null));

    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'p1' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('generateQuoteDraft -> 200 with AI draft payload', async () => {
    Project.findOne.mockReturnValue(
      chainableQuery({
        _id: 'p1',
        artisan: 'u1',
        title: 'Maison',
        status: 'ongoing',
        progress: 40,
        materials: [],
      })
    );
    generateQuoteAIDraft.mockResolvedValue({
      recommendations: { laborHand: { value: 1200 } },
    });

    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'p1', clientName: 'Client' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(generateQuoteAIDraft).toHaveBeenCalled();
  });

  test('createQuote -> 400 when required fields are missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { project: 'p1' } });
    const res = buildRes();

    await controller.createQuote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createQuote -> 201 on valid quote', async () => {
    Quote.create.mockResolvedValue({ _id: 'q1', quoteNumber: 'QT-2026-1111' });

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        project: 'p1',
        clientName: 'Client A',
        laborHand: 100,
        materialsAmount: 300,
        description: 'Work package',
        validUntil: '2026-05-30',
      },
    });
    const res = buildRes();

    await controller.createQuote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logAction).toHaveBeenCalled();
  });

  test('updateQuoteStatus -> 401 when user is missing', async () => {
    const req = buildReq({ user: null, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('updateQuoteStatus -> 403 when quote exists but user does not own it', async () => {
    Quote.findOneAndUpdate.mockReturnValue(chainableQuery(null));
    Quote.exists.mockResolvedValue(true);

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateQuoteStatus -> 500 on unexpected error', async () => {
    Quote.findOneAndUpdate.mockImplementation(() => {
      throw new Error('db explode');
    });

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe('getQuoteTemplates', () => {
    test('returns the four trade templates with zeroed prices', async () => {
      const res = buildRes();

      await controller.getQuoteTemplates(buildReq({ user: { _id: 'u1' } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(4);
      expect(res.body.map((t) => t.domain).sort()).toEqual([
        'Electrical Installation',
        'Painting',
        'Plumbing',
        'Tiling',
      ]);
      res.body.forEach((template) => {
        expect(template.lines).toHaveLength(5);
        template.lines.forEach((line) => {
          expect(line.unitPrice).toBe(0);
          expect(line.total).toBe(0);
        });
      });
    });

    test('every template has exactly one labor line', async () => {
      const res = buildRes();
      await controller.getQuoteTemplates(buildReq({ user: { _id: 'u1' } }), res);

      res.body.forEach((template) => {
        const labor = template.lines.filter((l) => l.lineType === 'labor');
        expect(labor).toHaveLength(1);
      });
    });

    test('only the auto-calculated templates expose a parameters block', async () => {
      const res = buildRes();
      await controller.getQuoteTemplates(buildReq({ user: { _id: 'u1' } }), res);

      const withParams = res.body.filter((t) => Array.isArray(t.parameters));
      // Les quatre metiers sont desormais auto-calcules.
      expect(withParams.map((t) => t.id).sort()).toEqual([
        'carreleur-salle-de-bain-8m2',
        'electricien-5-points',
        'peintre-piece-25m2',
        'plombier-3-points-eau',
      ]);

      const tiling = withParams.find((t) => t.id === 'carreleur-salle-de-bain-8m2');
      expect(tiling.parameters.map((p) => p.key)).toEqual([
        'surface',
        'formatCarreau',
        'typePose',
        'position',
        'etatSupport',
      ]);

      const painting = withParams.find((t) => t.id === 'peintre-piece-25m2');
      expect(painting.parameters.map((p) => p.key)).toEqual([
        // Les murs se saisissent un par un, comme les points d'eau.
        'murs',
        'surfacePlafond',
        'etatSupport',
        'contexte',
        'typeFinition',
        'changementCouleur',
      ]);

      // Chaque champ doit etre exploitable tel quel par le frontend. Une liste
      // est verifiee a travers ses sous-champs, qui suivent le meme contrat.
      const assertChamp = (param) => {
        expect(param.label).toEqual(expect.any(String));
        expect(['number', 'select', 'text']).toContain(param.type);
        expect(param.default).toBeDefined();
        if (param.type === 'select') {
          expect(param.options.length).toBeGreaterThan(1);
          expect(param.options.map((o) => o.value)).toContain(param.default);
        }
      };

      withParams.forEach((template) => {
        template.parameters.forEach((param) => {
          expect(param.label).toEqual(expect.any(String));
          if (param.type === 'list') {
            // Une liste ne contient que des champs scalaires, jamais une liste.
            expect(Array.isArray(param.itemFields)).toBe(true);
            expect(param.itemFields.length).toBeGreaterThan(0);
            param.itemFields.forEach(assertChamp);
            return;
          }
          assertChamp(param);
        });
      });
    });

    test('the colour-change field is conditional on renovation', async () => {
      const res = buildRes();
      await controller.getQuoteTemplates(buildReq({ user: { _id: 'u1' } }), res);

      const painting = res.body.find((t) => t.id === 'peintre-piece-25m2');
      const conditionnels = painting.parameters.filter((p) => p.showIf);

      expect(conditionnels).toHaveLength(1);
      expect(conditionnels[0].key).toBe('changementCouleur');
      expect(conditionnels[0].showIf).toEqual({ key: 'contexte', equals: 'renovation' });
      // La condition doit pointer un champ qui existe et une valeur possible.
      const cible = painting.parameters.find((p) => p.key === conditionnels[0].showIf.key);
      expect(cible).toBeTruthy();
      expect(cible.options.map((o) => o.value)).toContain(conditionnels[0].showIf.equals);
    });
  });

  describe('readPlanFile', () => {
    const planFile = { buffer: Buffer.from('plan'), mimetype: 'image/png' };

    const lectureType = {
      lecture: {
        pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source: 'SEJOUR 18,50 m2' }],
        cotations: [],
        illisible: [],
      },
      dimensions: { width: 1600, height: 1200 },
      avertissements: [],
    };

    const appeler = async (file) => {
      const res = buildRes();
      await controller.readPlanFile(buildReq({ user: { _id: 'u1' }, file }), res);
      return res;
    };

    beforeEach(() => {
      readPlan.mockReset();
      readPlan.mockResolvedValue(lectureType);
    });

    test('returns the raw reading, with no trade involved', async () => {
      const res = await appeler(planFile);

      expect(res.statusCode).toBe(200);
      expect(res.body.lecture.pieces).toHaveLength(1);
      // A ce stade le metier n'est pas choisi : aucune proposition.
      expect(res.body.propositions).toBeUndefined();
    });

    test('hands the buffer and the mime type to the service', async () => {
      await appeler(planFile);

      expect(readPlan).toHaveBeenCalledWith(planFile.buffer, 'image/png');
    });

    test('400 when no file reached the route', async () => {
      const res = await appeler(undefined);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/file is required/i);
    });

    test('400 with the artisan-facing message when the image is too small', async () => {
      const err = new Error('Image trop petite (600×420 px).');
      err.code = 'PLAN_RESOLUTION_TOO_LOW';
      readPlan.mockRejectedValue(err);

      const res = await appeler(planFile);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('PLAN_RESOLUTION_TOO_LOW');
      // Le message est destine a l'artisan, il doit lui parvenir intact.
      expect(res.body.message).toMatch(/trop petite/);
    });

    test('400 for an unsupported file type', async () => {
      const err = new Error('Seuls les formats JPEG, PNG et PDF sont acceptés.');
      err.code = 'PLAN_TYPE_UNSUPPORTED';
      readPlan.mockRejectedValue(err);

      const res = await appeler(planFile);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('PLAN_TYPE_UNSUPPORTED');
    });

    test('503 when the reader is not configured on this server', async () => {
      const err = new Error('cle manquante');
      err.code = 'GEMINI_KEY_MISSING';
      readPlan.mockRejectedValue(err);

      const res = await appeler(planFile);

      // Faute de configuration serveur, pas faute de l'artisan.
      expect(res.statusCode).toBe(503);
    });

    test('502 when the model call fails for an unexpected reason', async () => {
      readPlan.mockRejectedValue(new Error('ECONNRESET'));

      const res = await appeler(planFile);

      expect(res.statusCode).toBe(502);
      expect(res.body.error).toMatch(/ECONNRESET/);
    });

    test('429, not 502, when the daily quota is exhausted', async () => {
      // Le service marche : c'est le palier journalier qui est atteint.
      // Un 502 laisserait croire a une panne.
      const err = new Error('La limite quotidienne de lecture de plans est atteinte.');
      err.code = 'GEMINI_QUOTA_EXHAUSTED';
      readPlan.mockRejectedValue(err);

      const res = await appeler(planFile);

      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe('GEMINI_QUOTA_EXHAUSTED');
      expect(res.body.message).toMatch(/limite quotidienne/);
    });

    test('400 when the plan carries too much text to be read at once', async () => {
      const err = new Error('Le plan comporte trop de texte pour être lu en une fois.');
      err.code = 'PLAN_TOO_DENSE';
      readPlan.mockRejectedValue(err);

      const res = await appeler(planFile);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('PLAN_TOO_DENSE');
    });
  });

  describe('detectTradeFromDescription', () => {
    const appeler = async (body) => {
      const res = buildRes();
      await controller.detectTradeFromDescription(
        buildReq({ user: { _id: 'u1' }, body }),
        res
      );
      return res;
    };

    test('recognises a trade and returns the template with it', async () => {
      // Le modele complet accompagne la reponse : le frontend enchaine sur le
      // formulaire sans recharger la galerie.
      const res = await appeler({ description: 'Carrelage salle de bain' });

      expect(res.statusCode).toBe(200);
      expect(res.body.templateId).toBe('carreleur-salle-de-bain-8m2');
      expect(res.body.template.id).toBe('carreleur-salle-de-bain-8m2');
      expect(Array.isArray(res.body.template.parameters)).toBe(true);
    });

    test('returns null rather than guessing when nothing matches', async () => {
      const res = await appeler({ description: 'Refaire la toiture' });

      expect(res.statusCode).toBe(200);
      expect(res.body.templateId).toBeNull();
      expect(res.body.template).toBeUndefined();
      expect(res.body.raison).toMatch(/aucun mot-clé/);
    });

    test('returns null when two trades are mentioned', async () => {
      const res = await appeler({ description: 'Carrelage et peinture' });

      expect(res.body.templateId).toBeNull();
      expect(res.body.raison).toMatch(/plusieurs métiers/);
    });

    test('costs nothing — the model is never called', async () => {
      // C'est la raison d'etre de la detection par mots-cles : une requete de
      // quota economisee et aucune latence.
      await appeler({ description: 'Peinture des murs' });

      expect(readPlan).not.toHaveBeenCalled();
    });

    test.each([
      ['a missing description', {}],
      ['an empty body', undefined],
      ['a non-string description', { description: 42 }],
    ])('400 on %s', async (_label, body) => {
      const res = await appeler(body);

      expect(res.statusCode).toBe(400);
    });

    test('accepts an empty description without failing', async () => {
      // L'artisan peut laisser le champ vide : il choisira dans la galerie.
      const res = await appeler({ description: '' });

      expect(res.statusCode).toBe(200);
      expect(res.body.templateId).toBeNull();
    });
  });

  describe('mapPlanReadingToTemplate', () => {
    const lecture = {
      pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source: 'SEJOUR 18,50 m2' }],
      cotations: [],
      illisible: [],
    };

    const mappingType = {
      propositions: [{
        champ_cible: 'surface',
        unite: 'm²',
        candidats: [{ valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
      }],
      rejetees: [],
      avertissements: [],
    };

    const appeler = async (id, body) => {
      const res = buildRes();
      await controller.mapPlanReadingToTemplate(
        buildReq({ user: { _id: 'u1' }, params: { id }, body }),
        res
      );
      return res;
    };

    beforeEach(() => {
      mapReading.mockReset();
      mapReading.mockReturnValue(mappingType);
    });

    test('projects the reading onto the chosen trade', async () => {
      const res = await appeler('carreleur-salle-de-bain-8m2', { lecture });

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('carreleur-salle-de-bain-8m2');
      expect(res.body.propositions[0].champ_cible).toBe('surface');
      expect(mapReading).toHaveBeenCalledWith(lecture, 'carreleur-salle-de-bain-8m2');
    });

    test('never calls the model — that is the point of the split', async () => {
      await appeler('carreleur-salle-de-bain-8m2', { lecture });

      expect(readPlan).not.toHaveBeenCalled();
    });

    test('404 for an unknown template', async () => {
      const res = await appeler('modele-inexistant', { lecture });

      expect(res.statusCode).toBe(404);
      expect(mapReading).not.toHaveBeenCalled();
    });

    test.each([
      ['a missing reading', {}],
      ['an empty body', undefined],
      ['a non-object reading', { lecture: 'nope' }],
    ])('400 on %s', async (_label, body) => {
      const res = await appeler('carreleur-salle-de-bain-8m2', body);

      expect(res.statusCode).toBe(400);
      expect(mapReading).not.toHaveBeenCalled();
    });
  });

  describe('computeQuoteTemplateLines', () => {
    const validParams = {
      surface: 8,
      formatCarreau: 'petit',
      typePose: 'droite',
      position: 'sol',
      etatSupport: 'plan',
    };

    const compute = async (id, body) => {
      const res = buildRes();
      await controller.computeQuoteTemplateLines(
        buildReq({ user: { _id: 'u1' }, params: { id }, body }),
        res
      );
      return res;
    };

    test('returns the computed lines for the tiling template', async () => {
      const res = await compute('carreleur-salle-de-bain-8m2', validParams);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('carreleur-salle-de-bain-8m2');
      expect(res.body.lines).toHaveLength(5);
      res.body.lines.forEach((line) => {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.unitPrice).toBe(0);
      });
      expect(res.body.lines.some((l) => l.lineType === 'labor')).toBe(true);
    });

    test('adds the levelling line when the substrate needs it', async () => {
      const res = await compute('carreleur-salle-de-bain-8m2', {
        ...validParams,
        etatSupport: 'a_ragreer',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.lines).toHaveLength(6);
      expect(res.body.lines.some((l) => /ragreage/i.test(l.designation))).toBe(true);
    });

    test('404 for an unknown template', async () => {
      const res = await compute('modele-inexistant', validParams);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    test('computes the electrical template from its points and board type', async () => {
      const res = await compute('electricien-5-points', {
        typeTableau: 'neuf',
        longueurCableMl: 40,
        pointsElectriques: [
          { typeCircuit: 'eclairage', typePoint: 'point_lumineux', modePose: 'apparent' },
          { typeCircuit: 'prise_courante', typePoint: 'prise_simple', modePose: 'encastre' },
        ],
      });

      expect(res.statusCode).toBe(200);
      const designations = res.body.lines.map((l) => l.designation.toLowerCase());
      expect(designations.some((d) => d.includes('coffret tableau'))).toBe(true);
      expect(designations.some((d) => d.includes('disjoncteur 10a'))).toBe(true);
      expect(designations.some((d) => d.includes('disjoncteur 16a'))).toBe(true);
      expect(designations.some((d) => d.includes('câble'))).toBe(true);
    });

    test('400 naming the offending item index for an invalid electrical point', async () => {
      const res = await compute('electricien-5-points', {
        typeTableau: 'neuf',
        pointsElectriques: [
          { typeCircuit: 'eclairage', typePoint: 'point_lumineux', modePose: 'apparent' },
          { typeCircuit: 'chauffage', typePoint: 'point_lumineux', modePose: 'apparent' },
        ],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/pointsElectriques\[1\]\.typeCircuit/);
    });

    test('computes the painting template too', async () => {
      const res = await compute('peintre-piece-25m2', {
        surfaceMurs: 25,
        surfacePlafond: 12,
        etatSupport: 'moyen',
        contexte: 'renovation',
        typeFinition: 'satine',
        changementCouleur: 'oui',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('peintre-piece-25m2');
      const designations = res.body.lines.map((l) => l.designation.toLowerCase());
      expect(designations.some((d) => d.includes('enduit'))).toBe(true);
      expect(designations.some((d) => d.includes('ponçage'))).toBe(true);
      expect(designations.some((d) => d.includes('sous-couche'))).toBe(true);
      expect(designations.some((d) => d.includes('finition'))).toBe(true);
      expect(res.body.lines.filter((l) => l.lineType === 'labor')).toHaveLength(2);
    });

    test('computes the plumbing template from a list of water points', async () => {
      const res = await compute('plombier-3-points-eau', {
        pointsEau: [
          { sousType: 'lavabo', modePose: 'apparent' },
          { sousType: 'lavabo', modePose: 'apparent' },
          { sousType: 'wc', modePose: 'apparent' },
          { sousType: 'douche_italienne', modePose: 'encastre', distanceMl: 6 },
        ],
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe('plombier-3-points-eau');

      const designations = res.body.lines.map((l) => l.designation.toLowerCase());
      expect(designations.some((d) => d.includes('raccordement au compteur'))).toBe(true);
      // 4 points, donc au-dela du seuil : la nourrice est ajoutee.
      expect(designations.some((d) => d.includes('nourrice'))).toBe(true);
      expect(designations.some((d) => d.includes('saignée'))).toBe(true);

      // Les deux lavabos sont fusionnes : une seule ligne de tube cuivre.
      expect(designations.filter((d) => d.includes('tube cuivre'))).toHaveLength(1);
    });

    test('400 when the water point list is empty', async () => {
      const res = await compute('plombier-3-points-eau', { pointsEau: [] });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/at least one water point/i);
    });

    test('400 naming the offending item index for an invalid water point', async () => {
      const res = await compute('plombier-3-points-eau', {
        pointsEau: [
          { sousType: 'lavabo', modePose: 'apparent' },
          { sousType: 'jacuzzi', modePose: 'apparent' },
        ],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/pointsEau\[1\]\.sousType/);
    });

    test('400 with the offending field for an invalid painting parameter', async () => {
      const res = await compute('peintre-piece-25m2', {
        surfaceMurs: 25,
        surfacePlafond: 0,
        etatSupport: 'humide',
        contexte: 'renovation',
        typeFinition: 'mat',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/etatSupport/);
    });

    test('400 with the offending field when a parameter is invalid', async () => {
      const missing = await compute('carreleur-salle-de-bain-8m2', {
        ...validParams,
        surface: 0,
      });
      expect(missing.statusCode).toBe(400);
      expect(missing.body.message).toMatch(/surface/);

      const badChoice = await compute('carreleur-salle-de-bain-8m2', {
        ...validParams,
        typePose: 'zigzag',
      });
      expect(badChoice.statusCode).toBe(400);
      expect(badChoice.body.message).toMatch(/typePose/);
    });

    test('400 when the body is empty rather than crashing', async () => {
      const res = await compute('carreleur-salle-de-bain-8m2', undefined);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/surface/);
    });
  });

  describe('createQuote with quoteLines', () => {
    const baseBody = {
      project: 'p1',
      clientName: 'Client A',
      description: 'Work package',
      validUntil: '2026-05-30',
    };

    const lines = [
      { designation: 'Cable 2,5mm2', quantity: 15, unit: 'ml', unitPrice: 2, lineType: 'material' },
      { designation: 'Gaine ICTA', quantity: 10, unit: 'ml', unitPrice: 1, lineType: 'material' },
      { designation: "Main d'oeuvre", quantity: 5, unit: 'heure', unitPrice: 20, lineType: 'labor' },
    ];

    const create = async (body) => {
      Quote.create.mockResolvedValue({ _id: 'q1', quoteNumber: 'QT-2026-1111' });
      const res = buildRes();
      await controller.createQuote(buildReq({ user: { _id: 'u1' }, body }), res);
      return res;
    };

    test('derives labor and materials from the lines instead of the body', async () => {
      // Les montants envoyes par le client sont volontairement faux : ils doivent
      // etre ignores au profit du calcul depuis les lignes.
      const res = await create({ ...baseBody, laborHand: 9999, materialsAmount: 9999, quoteLines: lines });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.materialsAmount).toBe(40); // 15*2 + 10*1
      expect(created.laborHand).toBe(100);      // 5*20
      expect(created.amount).toBe(140);
    });

    test('persists each line with its computed total', async () => {
      await create({ ...baseBody, quoteLines: lines });

      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.quoteLines).toHaveLength(3);
      expect(created.quoteLines[0]).toEqual({
        designation: 'Cable 2,5mm2',
        quantity: 15,
        unit: 'ml',
        unitPrice: 2,
        lineType: 'material',
        total: 30,
      });
    });

    test('rejects an unknown unit', async () => {
      const res = await create({
        ...baseBody,
        quoteLines: [{ designation: 'X', quantity: 1, unit: 'litres', unitPrice: 1, lineType: 'material' }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/unknown unit/i);
    });

    test('rejects an unknown lineType', async () => {
      const res = await create({
        ...baseBody,
        quoteLines: [{ designation: 'X', quantity: 1, unit: 'ml', unitPrice: 1, lineType: 'other' }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/labor.*material/i);
    });

    test('rejects a line without designation', async () => {
      const res = await create({
        ...baseBody,
        quoteLines: [{ designation: '  ', quantity: 1, unit: 'ml', unitPrice: 1, lineType: 'material' }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/designation/i);
    });

    test('keeps the free-quote path untouched when quoteLines is absent', async () => {
      // Chemin existant : les montants restent ceux saisis a la main, et aucune
      // ligne n'est persistee.
      const res = await create({ ...baseBody, laborHand: 100, materialsAmount: 300 });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.laborHand).toBe(100);
      expect(created.materialsAmount).toBe(300);
      expect(created.amount).toBe(400);
      expect(created).not.toHaveProperty('quoteLines');
    });

    test('treats an empty lines array as a free quote', async () => {
      const res = await create({ ...baseBody, laborHand: 50, materialsAmount: 50, quoteLines: [] });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created).not.toHaveProperty('quoteLines');
      expect(created.amount).toBe(100);
    });
  });


  describe('createQuote with paymentSchedule', () => {
    const baseBody = {
      project: 'p1',
      clientName: 'Client A',
      description: 'Work package',
      validUntil: '2026-05-30',
      laborHand: 400,
      materialsAmount: 600,
    };

    const create = async (body) => {
      Quote.create.mockResolvedValue({ _id: 'q1', quoteNumber: 'QT-2026-1111' });
      const res = buildRes();
      await controller.createQuote(buildReq({ user: { _id: 'u1' }, body }), res);
      return res;
    };

    test('persists the tranches with server-computed amounts', async () => {
      const res = await create({
        ...baseBody,
        paymentSchedule: [
          { label: 'Acompte', type: 'percent', value: 30 },
          { label: 'Apres pose', type: 'fixed', value: 200 },
          { label: 'Solde', type: 'remaining' },
        ],
      });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.paymentSchedule.map((t) => t.amount)).toEqual([300, 200, 500]);
      expect(created.paymentSchedule.map((t) => t.percentage)).toEqual([30, 20, 50]);
    });

    test('ignores amounts sent by the client and recomputes them', async () => {
      await create({
        ...baseBody,
        paymentSchedule: [
          { label: 'Acompte', type: 'percent', value: 30, amount: 99999, percentage: 99999 },
          { label: 'Solde', type: 'remaining', amount: 99999 },
        ],
      });

      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.paymentSchedule[0].amount).toBe(300);
      expect(created.paymentSchedule[1].amount).toBe(700);
    });

    test('derives upfrontPercent from the first tranche', async () => {
      // C'est ce que lisent invoiceController, quoteMLService et quoteAIDraftService.
      await create({
        ...baseBody,
        upfrontPercent: 50,
        paymentSchedule: [
          { label: 'Acompte', type: 'percent', value: 30 },
          { label: 'Solde', type: 'remaining' },
        ],
      });

      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created.upfrontPercent).toBe(30);
    });

    test('rejects an unbalanced schedule', async () => {
      const res = await create({
        ...baseBody,
        paymentSchedule: [{ label: 'Acompte', type: 'percent', value: 40 }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/add up to the quote total/i);
    });

    test('rejects a tranche without label', async () => {
      const res = await create({
        ...baseBody,
        paymentSchedule: [{ label: '   ', type: 'remaining' }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/label is required/i);
    });

    test('rejects an unknown tranche type', async () => {
      const res = await create({
        ...baseBody,
        paymentSchedule: [{ label: 'A', type: 'installment', value: 10 }],
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/unknown payment type/i);
    });

    test('keeps the legacy two-tranche path when paymentSchedule is absent', async () => {
      const res = await create({ ...baseBody, upfrontPercent: 60 });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created).not.toHaveProperty('paymentSchedule');
      expect(created.upfrontPercent).toBe(60);
    });

    test('treats an empty schedule as the legacy path', async () => {
      const res = await create({ ...baseBody, upfrontPercent: 45, paymentSchedule: [] });

      expect(res.statusCode).toBe(201);
      const created = Quote.create.mock.calls.at(-1)[0];
      expect(created).not.toHaveProperty('paymentSchedule');
      expect(created.upfrontPercent).toBe(45);
    });
  });

});
