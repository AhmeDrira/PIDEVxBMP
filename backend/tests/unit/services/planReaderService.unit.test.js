const mockGenerateContent = jest.fn();
/** Modeles reellement essayes, dans l'ordre, pour verifier la bascule. */
const mockModelsTried = [];

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: (config) => {
      mockModelsTried.push(config.model);
      return { generateContent: (...args) => mockGenerateContent(config.model, ...args) };
    },
  })),
}));

const mockSharpMetadata = { value: { width: 1600, height: 1200 } };
jest.mock('sharp', () => jest.fn(() => ({
  metadata: async () => {
    if (mockSharpMetadata.value instanceof Error) throw mockSharpMetadata.value;
    return mockSharpMetadata.value;
  },
})));

const {
  readPlan,
  mapReading,
  assertReadableResolution,
  buildPropositions,
  isValueBackedBySource,
  extractNumbers,
  parseHauteurSousPlafond,
  extractLengthsInMetres,
  isLengthBackedBySource,
  parseDimensionsPiece,
  buildPerimeterEstimation,
  parseJsonFromText,
  MIN_IMAGE_LONG_SIDE,
  DEFAULT_MIN_IMAGE_LONG_SIDE,
  readMinLongSide,
  MODEL_CANDIDATES,
  MAX_OUTPUT_TOKENS,
  SURFACE_TARGETS,
  PROMPT,
} = require('../../../services/planReaderService');

const buffer = Buffer.from('image');

/** Reponse type du modele, telle qu'observee sur le banc d'essai. */
const reponseModele = (json) => ({
  response: { text: () => '```json\n' + JSON.stringify(json) + '\n```' },
});

const lectureType = {
  pieces: [
    { libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' },
    { libelle: 'CUISINE', surface_m2: 12, texte_source_surface: 'CUISINE 12,00 m2' },
  ],
  cotations: [{ valeur: 4.2, unite: 'm', texte_source: '4,20 m' }],
  illisible: [],
};

/** Implementation de reference, rejouee avant chaque test. */
const brancherClientGemini = () => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  GoogleGenerativeAI.mockImplementation(() => ({
    getGenerativeModel: (config) => {
      mockModelsTried.push(config.model);
      return { generateContent: (...args) => mockGenerateContent(config.model, ...args) };
    },
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  // Un test remplace cette implementation pour inspecter la config : sans
  // remise en place, les suivants heritent de sa version et ne tracent plus
  // les modeles essayes.
  brancherClientGemini();
  mockModelsTried.length = 0;
  mockSharpMetadata.value = { width: 1600, height: 1200 };
  process.env.GEMINI_API_KEY = 'cle-de-test';
  mockGenerateContent.mockReturnValue(reponseModele(lectureType));
});

// ── Le contrat de lecture ────────────────────────────────────────────────────

describe('planReaderService - la consigne interdit de mesurer', () => {
  test('the prompt forbids measuring, estimating and deducing', () => {
    // Cette interdiction est la raison d'etre de la fonctionnalite : la lecture
    // de texte est fiable, la mesure geometrique visuelle ne l'est pas.
    expect(PROMPT).toMatch(/RIEN mesurer/);
    expect(PROMPT).toMatch(/RIEN estimer/);
    expect(PROMPT).toMatch(/RIEN déduire de la\s+géométrie/);
    expect(PROMPT).toMatch(/Ne compte pas les\s+portes ni les fenêtres/);
  });

  test('the prompt asks for a verbatim source text', () => {
    // Sans verbatim, le garde-fou de valeur ne peut rien verifier.
    expect(PROMPT).toMatch(/EXACTEMENT le texte/);
  });
});

// ── Garde-fou 1 : plancher de resolution ─────────────────────────────────────

describe('planReaderService - plancher de resolution', () => {
  test('accepts an image above the floor', async () => {
    await expect(assertReadableResolution(buffer, 'image/png'))
      .resolves.toEqual({ width: 1600, height: 1200 });
  });

  test.each([
    ['just below on the long side', { width: MIN_IMAGE_LONG_SIDE - 1, height: Math.round((MIN_IMAGE_LONG_SIDE - 1) * 0.7) }],
    // 260 px : la seule taille ou le banc d'essai a produit une hallucination
    // silencieuse. Elle doit rester refusee quel que soit le reglage.
    ['far below', { width: 260, height: 182 }],
  ])('refuses an image %s', async (_label, dimensions) => {
    mockSharpMetadata.value = dimensions;

    await expect(assertReadableResolution(buffer, 'image/png'))
      .rejects.toMatchObject({ code: 'PLAN_RESOLUTION_TOO_LOW' });
  });

  test('accepts exactly at the floor', async () => {
    mockSharpMetadata.value = { width: MIN_IMAGE_LONG_SIDE, height: 400 };

    await expect(assertReadableResolution(buffer, 'image/png')).resolves.toBeTruthy();
  });

  test('measures the LONG side, not the width', async () => {
    // Un plan en portrait de 800x1400 est parfaitement lisible.
    mockSharpMetadata.value = { width: 800, height: 1400 };

    await expect(assertReadableResolution(buffer, 'image/png')).resolves.toBeTruthy();
  });

  test('the refusal tells the artisan what to do', async () => {
    mockSharpMetadata.value = { width: 200, height: 140 };

    await expect(assertReadableResolution(buffer, 'image/png'))
      .rejects.toThrow(/Reprenez la photo de plus près|envoyez le PDF/);
  });

  test('the refusal quotes the configured floor, not a frozen number', async () => {
    // Le plancher se regle sans redeploiement : un message fige a 1000 px
    // enverrait l'artisan reprendre une photo qui serait desormais acceptee.
    mockSharpMetadata.value = { width: 200, height: 140 };

    await expect(assertReadableResolution(buffer, 'image/png'))
      .rejects.toThrow(new RegExp(`au moins ${MIN_IMAGE_LONG_SIDE} px`));
  });

  test('skips the check for a PDF, which sharp cannot read', async () => {
    await expect(assertReadableResolution(buffer, 'application/pdf')).resolves.toBeNull();
  });

  test('reports an unreadable image rather than crashing', async () => {
    mockSharpMetadata.value = new Error('unsupported image format');

    await expect(assertReadableResolution(buffer, 'image/png')).rejects.toThrow(/pas pu être lue/);
  });
});

describe('planReaderService - plancher reglable', () => {
  const original = process.env.PLAN_MIN_RESOLUTION_PX;
  afterEach(() => {
    if (original === undefined) delete process.env.PLAN_MIN_RESOLUTION_PX;
    else process.env.PLAN_MIN_RESOLUTION_PX = original;
  });

  test('falls back to 300 when the variable is absent', () => {
    delete process.env.PLAN_MIN_RESOLUTION_PX;

    expect(readMinLongSide()).toBe(300);
    expect(DEFAULT_MIN_IMAGE_LONG_SIDE).toBe(300);
  });

  test('never drops the floor below the measured hallucination cliff', () => {
    // Le decrochage mesure se situe entre 260 et 320 px : sous 300, une
    // lecture fausse ne se voit plus. Descendre demande une nouvelle mesure
    // et un accord explicite — ce test est la pour rendre le geste visible.
    expect(DEFAULT_MIN_IMAGE_LONG_SIDE).toBeGreaterThanOrEqual(300);
  });

  test('keeps refusing an unreadable image whatever the setting', () => {
    // Le plancher peut baisser, il ne peut pas disparaitre.
    process.env.PLAN_MIN_RESOLUTION_PX = '0';
    expect(readMinLongSide()).toBe(DEFAULT_MIN_IMAGE_LONG_SIDE);
  });

  test('honours the configured value', () => {
    // Remonter a 1000 doit se faire par variable, sans toucher au code.
    process.env.PLAN_MIN_RESOLUTION_PX = '1000';

    expect(readMinLongSide()).toBe(1000);
  });

  test.each([
    ['a non-numeric value', 'haute'],
    ['an empty value', ''],
    ['zero', '0'],
    ['a negative value', '-500'],
  ])('ignores %s rather than removing the floor', (_label, valeur) => {
    // Number('haute') vaut NaN, et toute comparaison avec NaN est fausse : le
    // plancher disparaitrait en silence, ce contre quoi il existe.
    process.env.PLAN_MIN_RESOLUTION_PX = valeur;

    expect(readMinLongSide()).toBe(DEFAULT_MIN_IMAGE_LONG_SIDE);
  });

});

// ── Garde-fou 2 : la valeur doit figurer dans son texte source ───────────────

describe('planReaderService - extractNumbers', () => {
  test('reads the French decimal comma', () => {
    expect(extractNumbers('SEJOUR 18,50 m2')).toEqual([18.5]);
  });

  test('reads a decimal point too', () => {
    expect(extractNumbers('SEJOUR 18.50 m2')).toEqual([18.5]);
  });

  test('does not mistake the 2 of "m2" for a value', () => {
    // Sans ce nettoyage, une surface de 2 m² serait validee par n'importe
    // quel texte se terminant par « m2 ».
    expect(extractNumbers('SALLE 45,00 m2')).toEqual([45]);
    expect(extractNumbers('SALLE 45,00 m²')).toEqual([45]);
  });

  test('does not mistake the ml unit for a value', () => {
    expect(extractNumbers('Cloison 4,20 ml')).toEqual([4.2]);
  });

  test('returns nothing for a text without a number', () => {
    expect(extractNumbers('valeur jamais lue')).toEqual([]);
  });
});

describe('planReaderService - la valeur doit venir du texte', () => {
  test('accepts a value present in its source text', () => {
    expect(isValueBackedBySource(18.5, 'SEJOUR 18,50 m2')).toBe(true);
  });

  test('refuses a value absent from its source text', () => {
    // Motif exact observe au banc : transcription correcte, chiffre faux.
    expect(isValueBackedBySource(16, 'SEJOUR 18,50 m2')).toBe(false);
  });

  test('refuses a value whose source text carries no number at all', () => {
    expect(isValueBackedBySource(99, 'valeur jamais lue')).toBe(false);
  });

  test.each([
    ['an empty source', 42, ''],
    ['a missing source', 42, undefined],
    ['a non-numeric value', 'beaucoup', 'SEJOUR 18,50 m2'],
  ])('refuses %s', (_label, valeur, source) => {
    expect(isValueBackedBySource(valeur, source)).toBe(false);
  });

  test('the check is NOT tautological', () => {
    // Une premiere version comparait le texte source a la liste des textes
    // sources — donc a lui-meme, ne rejetant jamais rien. On confronte
    // desormais le NOMBRE au TEXTE, deux productions distinctes du modele.
    const { propositions, rejetees } = buildPropositions({
      pieces: [{ libelle: 'FANTOME', surface_m2: 99, texte_source: 'valeur jamais lue' }],
      cotations: [],
      illisible: [],
    }, 'carreleur-salle-de-bain-8m2');

    expect(propositions).toHaveLength(0);
    expect(rejetees).toHaveLength(1);
    expect(rejetees[0].motif).toMatch(/ne figure pas dans le texte source/);
  });
});

// ── Garde-fou 3 : mapping deterministe ───────────────────────────────────────

describe('planReaderService - mapping vers les champs', () => {
  test('maps a floor area to the tiling surface field', () => {
    const { propositions } = buildPropositions(lectureType, 'carreleur-salle-de-bain-8m2');

    expect(propositions).toHaveLength(1);
    expect(propositions[0].champ_cible).toBe('surface');
    expect(propositions[0].unite).toBe('m²');
  });

  test('maps a floor area to the painting ceiling field', () => {
    const { propositions } = buildPropositions(lectureType, 'peintre-piece-25m2');

    expect(propositions[0].champ_cible).toBe('surfacePlafond');
  });

  test('never proposes surfaceMurs, which cannot be read from a floor area', () => {
    // La deduire demanderait hauteur et perimetre : c'est de la mesure
    // geometrique, precisement ce qu'on s'interdit.
    const champs = Object.values(SURFACE_TARGETS).flat().map((t) => t.champ);

    expect(champs).not.toContain('murs');
  });

  test('offers one candidate per room, without choosing', () => {
    // Rien sur un plan ne dit quelle piece l'artisan compte traiter :
    // trancher a sa place serait deviner.
    const { propositions } = buildPropositions(lectureType, 'carreleur-salle-de-bain-8m2');

    expect(propositions[0].candidats.map((c) => c.libelle)).toEqual(['SEJOUR', 'CUISINE']);
    expect(propositions[0].candidats.map((c) => c.valeur)).toEqual([18.5, 12]);
  });

  test.each([
    ['plumbing', 'plombier-3-points-eau'],
    ['electrical', 'electricien-5-points'],
    ['an unknown template', 'inconnu'],
  ])('proposes nothing for %s', (_label, templateId) => {
    // Hors perimetre v1 : leurs listes de points ne s'ecrivent pas sur un plan.
    expect(buildPropositions(lectureType, templateId).propositions).toEqual([]);
  });

  test.each([
    ['a null surface', { libelle: 'X', surface_m2: null, texte_source: 'X' }],
    ['a zero surface', { libelle: 'X', surface_m2: 0, texte_source: 'X 0 m2' }],
    ['a negative surface', { libelle: 'X', surface_m2: -3, texte_source: 'X -3 m2' }],
  ])('ignores a room with %s', (_label, piece) => {
    const { propositions } = buildPropositions(
      { pieces: [piece], cotations: [], illisible: [] },
      'carreleur-salle-de-bain-8m2'
    );

    expect(propositions).toEqual([]);
  });

  test('rounds to the hundredth, like a quote quantity', () => {
    const { propositions } = buildPropositions({
      pieces: [{ libelle: 'X', surface_m2: 18.499999, texte_source: 'X 18,499999 m2' }],
      cotations: [],
      illisible: [],
    }, 'carreleur-salle-de-bain-8m2');

    expect(propositions[0].candidats[0].valeur).toBe(18.5);
  });
});

// ── Parsing de la reponse ────────────────────────────────────────────────────

describe('planReaderService - parseJsonFromText', () => {
  test('strips the markdown fences the v1 API adds', () => {
    expect(parseJsonFromText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonFromText('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test('accepts bare JSON', () => {
    expect(parseJsonFromText('{"a":1}')).toEqual({ a: 1 });
  });

  test('digs the object out of surrounding prose', () => {
    expect(parseJsonFromText('Voici le résultat : {"a":1} Voilà.')).toEqual({ a: 1 });
  });

  test('throws on a response without any JSON', () => {
    expect(() => parseJsonFromText('je ne peux pas lire ce plan')).toThrow(/JSON exploitable/);
  });
});

// ── Bout en bout ─────────────────────────────────────────────────────────────

describe('planReaderService - readPlan', () => {
  test('returns the raw reading, without knowing any trade', async () => {
    const result = await readPlan(buffer, 'image/png');

    expect(result.lecture.pieces).toHaveLength(2);
    // Aucune proposition a ce stade : le metier n'est pas encore choisi.
    expect(result.propositions).toBeUndefined();
    expect(result.avertissements).toEqual([]);
  });

  test('sends the file inline, base64, with its mime type', async () => {
    await readPlan(buffer, 'application/pdf');

    const [, contenu] = mockGenerateContent.mock.calls[0];
    const piece = contenu[1];
    expect(piece.inlineData.mimeType).toBe('application/pdf');
    expect(piece.inlineData.data).toBe(buffer.toString('base64'));
  });

  test('refuses a file below the resolution floor before calling the model', async () => {
    mockSharpMetadata.value = { width: 200, height: 140 };

    await expect(readPlan(buffer, 'image/png'))
      .rejects.toMatchObject({ code: 'PLAN_RESOLUTION_TOO_LOW' });
    // Pas d'appel inutile au modele, donc pas de depense inutile.
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test.each([
    ['image/gif'],
    ['application/acad'],
    ['text/plain'],
  ])('refuses the unsupported type %s', async (mimeType) => {
    await expect(readPlan(buffer, mimeType))
      .rejects.toMatchObject({ code: 'PLAN_TYPE_UNSUPPORTED' });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('refuses an empty file', async () => {
    await expect(readPlan(Buffer.alloc(0), 'image/png')).rejects.toThrow(/Aucun fichier/);
  });

  test('surfaces the illegible zones the model reports', async () => {
    mockGenerateContent.mockResolvedValue(reponseModele({
      ...lectureType,
      illisible: ['La surface du SEJOUR est masquée'],
    }));

    const result = await readPlan(buffer, 'image/png');

    expect(result.avertissements.join(' ')).toMatch(/masquée/);
  });

  test('reports a missing API key with a dedicated code', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    await expect(readPlan(buffer, 'image/png'))
      .rejects.toMatchObject({ code: 'GEMINI_KEY_MISSING' });
  });

  test('asks the model for a deterministic transcription', async () => {
    // Ce n'est pas une tache creative : la temperature doit rester nulle.
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const getGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
    GoogleGenerativeAI.mockImplementation(() => ({ getGenerativeModel }));

    await readPlan(buffer, 'image/png');

    expect(getGenerativeModel.mock.calls[0][0].generationConfig.temperature).toBe(0);
  });

  test('leaves room for reasoning tokens before the answer', async () => {
    // A 4096, la lecture d'un plan dense se faisait tronquer : les modeles
    // recents consomment des jetons de raisonnement AVANT d'ecrire.
    expect(MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(8192);
  });
});

describe('planReaderService - bascule de modele', () => {
  beforeEach(() => {
    mockModelsTried.length = 0;
  });

  test('tries the next model when the first one is retired', async () => {
    // `gemini-2.0-flash` renvoie un 404 « no longer available » depuis que
    // Google l'a retire : un modele unique en dur ne tient pas dans le temps.
    mockGenerateContent.mockImplementation((modelName) => {
      if (modelName === MODEL_CANDIDATES[0]) {
        throw new Error('[404 Not Found] This model is no longer available.');
      }
      return reponseModele(lectureType);
    });

    const result = await readPlan(buffer, 'image/png');

    expect(result.lecture.pieces).toHaveLength(2);
    expect(mockModelsTried).toEqual(MODEL_CANDIDATES);
  });

  test('tries the next model when the daily quota is exhausted', async () => {
    // Le quota gratuit est compte PAR MODELE : basculer ressert vraiment.
    mockGenerateContent.mockImplementation((modelName) => {
      if (modelName === MODEL_CANDIDATES[0]) {
        throw new Error('[429 Too Many Requests] You exceeded your current quota');
      }
      return reponseModele(lectureType);
    });

    const result = await readPlan(buffer, 'image/png');

    expect(result.lecture.pieces).toHaveLength(2);
    expect(mockModelsTried.length).toBeGreaterThan(1);
  });

  test('reports an actionable message when every model is out of quota', async () => {
    mockGenerateContent.mockImplementation(() => {
      throw new Error('[429 Too Many Requests] You exceeded your current quota');
    });

    await expect(readPlan(buffer, 'image/png'))
      .rejects.toMatchObject({ code: 'GEMINI_QUOTA_EXHAUSTED' });
    // Ni son plan ni une panne : l'artisan doit savoir quoi faire.
    await expect(readPlan(buffer, 'image/png'))
      .rejects.toThrow(/Réessayez demain|saisissez les valeurs/);
  });

  test('does not swallow an unrelated failure', async () => {
    // Une erreur reseau ne doit pas passer pour un quota atteint.
    mockGenerateContent.mockImplementation(() => {
      throw new Error('ECONNRESET');
    });

    await expect(readPlan(buffer, 'image/png')).rejects.toThrow(/ECONNRESET/);
    // Et on n'insiste pas sur les modeles suivants pour rien.
    expect(mockModelsTried).toHaveLength(1);
  });

  test('reports a truncated answer as a too-dense plan', async () => {
    // `finishReason: MAX_TOKENS` produit un JSON incomplet : mieux vaut le
    // dire que d'echouer sur un parsage incomprehensible.
    mockGenerateContent.mockReturnValue({
      response: {
        candidates: [{ finishReason: 'MAX_TOKENS' }],
        text: () => '{"pieces": [{"libelle": "Bed',
      },
    });

    await expect(readPlan(buffer, 'image/png'))
      .rejects.toMatchObject({ code: 'PLAN_TOO_DENSE' });
  });
});

describe('planReaderService - mapReading', () => {
  test('projects a reading onto a trade WITHOUT calling the model', async () => {
    // C'est tout l'interet du decoupage : changer de metier ne coute rien.
    const result = mapReading(lectureType, 'carreleur-salle-de-bain-8m2');

    expect(result.propositions[0].candidats).toHaveLength(2);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('can be replayed on another trade with the same reading', async () => {
    const carrelage = mapReading(lectureType, 'carreleur-salle-de-bain-8m2');
    const peinture = mapReading(lectureType, 'peintre-piece-25m2');

    expect(carrelage.propositions[0].champ_cible).toBe('surface');
    expect(peinture.propositions[0].champ_cible).toBe('surfacePlafond');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('re-applies the source guardrail server-side', async () => {
    // La lecture transite par le client entre les deux etapes : le garde-fou
    // doit etre rejoue ici, pas seulement a la lecture.
    const result = mapReading({
      pieces: [{ libelle: 'HALLUCINE', surface_m2: 16, texte_source_surface: 'SEJOUR 18,50 m2' }],
      cotations: [],
      illisible: [],
    }, 'carreleur-salle-de-bain-8m2');

    expect(result.rejetees).toHaveLength(1);
    expect(result.propositions).toEqual([]);
    expect(result.avertissements.join(' ')).toMatch(/écartée/);
  });

  test('warns when nothing usable was read', async () => {
    const result = mapReading({ pieces: [], cotations: [], illisible: [] }, 'carreleur-salle-de-bain-8m2');

    expect(result.avertissements.join(' ')).toMatch(/Aucune surface exploitable/);
  });

  test.each([
    ['an empty object', {}],
    ['null', null],
    ['a reading without arrays', { pieces: 'nope', cotations: 3 }],
  ])('survives %s rather than crashing', (_label, lecture) => {
    expect(() => mapReading(lecture, 'carreleur-salle-de-bain-8m2')).not.toThrow();
  });
});

describe('planReaderService - hauteur sous plafond', () => {
  test('the prompt only asks for an explicitly written height', () => {
    // Sans cette consigne, le modele donnerait la hauteur « habituelle »
    // (2,50 m) sur tous les plans : une invention plausible et invisible.
    expect(PROMPT).toMatch(/hauteur_sous_plafond/);
    expect(PROMPT).toMatch(/mention explicite/i);
    expect(PROMPT).toMatch(/Ne\s+la déduis jamais/i);
  });

  test('keeps a height whose figure appears in its source text', () => {
    const resultat = parseHauteurSousPlafond({
      valeur_m: 2.5,
      texte_source: 'Hauteur sous plafond 2,50 m',
    });

    expect(resultat).toEqual({ valeurM: 2.5, texteSource: 'Hauteur sous plafond 2,50 m' });
  });

  test('rejects a height that its own source does not carry', () => {
    // Le meme garde-fou que les surfaces : le chiffre doit venir du texte lu.
    // Sans ca, la hauteur serait le seul champ du contrat sans verification.
    expect(parseHauteurSousPlafond({
      valeur_m: 2.8,
      texte_source: 'Hauteur sous plafond 2,50 m',
    })).toBeNull();
  });

  test.each([
    ['no source text', { valeur_m: 2.5 }],
    ['an empty source', { valeur_m: 2.5, texte_source: '' }],
    ['a zero height', { valeur_m: 0, texte_source: 'HSP 0' }],
    ['a negative height', { valeur_m: -2.5, texte_source: 'HSP -2,50' }],
    ['a non-numeric height', { valeur_m: 'haute', texte_source: 'HSP haute' }],
    ['null', null],
    ['a string', 'HSP 2,50'],
  ])('rejects %s', (_label, brut) => {
    expect(parseHauteurSousPlafond(brut)).toBeNull();
  });

  test('reads the abbreviated form too', () => {
    expect(parseHauteurSousPlafond({ valeur_m: 2.7, texte_source: 'HSP 2,70' }))
      .toEqual({ valeurM: 2.7, texteSource: 'HSP 2,70' });
  });
});

describe('planReaderService - indications', () => {
  const lectureAvecHauteur = {
    ...lectureType,
    hauteurSousPlafond: { valeurM: 2.5, texteSource: 'Hauteur sous plafond 2,50 m' },
  };

  test('reports the ceiling height next to the wall list without filling it', () => {
    // `surfaceMurs` demande le perimetre de la piece, qu'on ne peut pas lire.
    // On donne la hauteur a l'artisan ; le calcul reste le sien.
    const result = mapReading(lectureAvecHauteur, 'peintre-piece-25m2');

    const hauteur = result.indications.find((i) => /Hauteur sous plafond/.test(i.texte));
    expect(hauteur.champ_cible).toBe('murs');
    expect(hauteur.texte).toMatch(/2\.5 m/);
    // Et surtout : aucune proposition ne vise surfaceMurs.
    expect(result.propositions.map((p) => p.champ_cible)).not.toContain('murs');
  });

  test('carries the source text so the artisan can check it on the plan', () => {
    const result = mapReading(lectureAvecHauteur, 'peintre-piece-25m2');

    const hauteur = result.indications.find((i) => /Hauteur sous plafond/.test(i.texte));
    expect(hauteur.texte_source).toBe('Hauteur sous plafond 2,50 m');
  });

  test('drops a height the client could have tampered with in transit', () => {
    // La lecture repasse par le navigateur entre les deux etapes : le
    // garde-fou est rejoue ici, pas seulement a la lecture.
    const result = mapReading({
      ...lectureType,
      hauteurSousPlafond: { valeurM: 4.2, texteSource: 'Hauteur sous plafond 2,50 m' },
    }, 'peintre-piece-25m2');

    expect(result.indications.some((i) => /Hauteur sous plafond/.test(i.texte))).toBe(false);
  });

  test('says nothing about height when the plan carries none', () => {
    const result = mapReading(lectureType, 'peintre-piece-25m2');

    expect(result.indications.some((i) => /Hauteur sous plafond/.test(i.texte))).toBe(false);
  });
});

// ── Estimation de la surface des murs ───────────────────────────────────────

/** Piece dont le modele a rattache les deux cotes de cote. */
const pieceCotee = (extra = {}) => ({
  libelle: 'SEJOUR',
  surface_m2: 18.5,
  texte_source_surface: 'SEJOUR 18,50 m2',
  longueur_m: 4.2,
  largeur_m: 5.1,
  texte_source_dimensions: '4,20 m / 5,10 m',
  ...extra,
});

describe('planReaderService - le prompt encadre les cotes de cote', () => {
  test('asks for the two sides only when written next to the room', () => {
    expect(PROMPT).toMatch(/longueur_m/);
    expect(PROMPT).toMatch(/largeur_m/);
    expect(PROMPT).toMatch(/texte_source_dimensions/);
    // Le rattachement doit etre visuel, pas raisonne.
    expect(PROMPT).toMatch(/juste à côté de cette pièce/i);
  });

  test('forbids attaching a dimension by elimination', () => {
    // C'est exactement le recollage apres coup qu'on a ecarte : il demanderait
    // au modele de raisonner sur le dessin, le regime a 34-51 % de justesse.
    expect(PROMPT).toMatch(/« par élimination »/i);
    expect(PROMPT).toMatch(/Dans le doute, null/i);
  });
});

describe('planReaderService - les longueurs se comparent en metres', () => {
  test('reads centimetres as metres', () => {
    // Un plan francais cote couramment en cm. Comparer 3,56 au chiffre nu 356
    // rejetait une lecture juste : on punissait le modele d'avoir converti.
    expect(extractLengthsInMetres('356 cm')).toContain(3.56);
    expect(extractLengthsInMetres('HSP 250 cm')).toContain(2.5);
  });

  test('reads millimetres too', () => {
    expect(extractLengthsInMetres('3560 mm')).toContain(3.56);
  });

  test('keeps metres as they are', () => {
    expect(extractLengthsInMetres('3,56 m')).toContain(3.56);
  });

  test('accepts a dimension written in centimetres', () => {
    expect(isLengthBackedBySource(3.56, '356 cm')).toBe(true);
    expect(isLengthBackedBySource(2.8, '280 cm')).toBe(true);
    expect(isLengthBackedBySource(2.5, 'HSP 250 cm')).toBe(true);
  });

  test('refuses the same digits read as the wrong unit', () => {
    // « 356 cm » ne vaut pas 356 m. L'ancienne comparaison, faite sur les
    // chiffres nus, laissait passer un mur de 356 metres.
    expect(isLengthBackedBySource(356, '356 cm')).toBe(false);
  });

  test('still refuses a length absent from its source', () => {
    expect(isLengthBackedBySource(9.9, '356 cm')).toBe(false);
    expect(isLengthBackedBySource(2.5, 'HSP 300 cm')).toBe(false);
  });

  test('accepts a bare number under either reading', () => {
    // Sans unite ecrite, on ne peut pas trancher : les deux lectures
    // plausibles sur un plan sont retenues plutot que d'en rejeter une juste.
    expect(isLengthBackedBySource(3.56, '3,56')).toBe(true);
    expect(isLengthBackedBySource(3.56, '356')).toBe(true);
  });
});

describe('planReaderService - parseDimensionsPiece', () => {
  test('keeps two sides that both appear in their source text', () => {
    expect(parseDimensionsPiece(pieceCotee())).toEqual({
      longueurM: 4.2, largeurM: 5.1, texteSource: '4,20 m / 5,10 m',
    });
  });

  test('rejects the pair when ONE side is not backed by the source', () => {
    // Tout ou rien : un perimetre calcule sur une cote verifiee et une cote
    // douteuse donnerait un chiffre a moitie fiable, indiscernable d'un bon.
    expect(parseDimensionsPiece(pieceCotee({ largeur_m: 9.9 }))).toBeNull();
    expect(parseDimensionsPiece(pieceCotee({ longueur_m: 9.9 }))).toBeNull();
  });

  test.each([
    ['only one side', { largeur_m: null }],
    ['no source text', { texte_source_dimensions: null }],
    ['a zero side', { longueur_m: 0 }],
    ['a negative side', { largeur_m: -5.1 }],
    ['a non-numeric side', { longueur_m: 'grande' }],
  ])('rejects %s', (_label, extra) => {
    expect(parseDimensionsPiece(pieceCotee(extra))).toBeNull();
  });

  test.each([
    ['a piece without dimensions', { libelle: 'WC', surface_m2: 2 }],
    ['null', null],
    ['a string', 'SEJOUR'],
  ])('rejects %s without crashing', (_label, brut) => {
    expect(parseDimensionsPiece(brut)).toBeNull();
  });
});

describe('planReaderService - estimation de la surface des murs', () => {
  const avecHauteur = (pieces) => ({
    pieces,
    cotations: [],
    hauteurSousPlafond: { valeurM: 2.5, texteSource: 'HSP 2,50 m' },
    illisible: [],
  });

  test('computes 2 x (L + l) x H when the height is known', () => {
    const result = mapReading(avecHauteur([pieceCotee()]), 'peintre-piece-25m2');
    const estimation = result.estimations[0];

    // 2 x (4,2 + 5,1) x 2,5 = 46,5
    expect(estimation.candidats[0].valeur).toBe(46.5);
    expect(estimation.unite).toBe('m²');
    expect(estimation.hauteur_utilisee).toBe(2.5);
    // Les deux cotes voyagent avec le total : la liste se remplit mur par mur.
    expect(estimation.candidats[0].longueur_m).toBe(4.2);
    expect(estimation.candidats[0].largeur_m).toBe(5.1);
  });

  test('never lets the figure travel without its caveat', () => {
    // Le chiffre suppose la piece rectangulaire et ignore les ouvertures :
    // presente seul, il passerait pour un releve.
    const result = mapReading(avecHauteur([pieceCotee()]), 'peintre-piece-25m2');

    expect(result.estimations[0].estimation).toBe(true);
    expect(result.estimations[0].mention)
      .toMatch(/portes et fenêtres.*rectangulaire.*vérifier et ajuster/i);
  });

  test('falls back to a perimeter in linear metres with no height', () => {
    const result = mapReading({
      pieces: [pieceCotee()], cotations: [], illisible: [],
    }, 'peintre-piece-25m2');

    // 2 x (4,2 + 5,1) = 18,6 metres de mur, pas de m².
    expect(result.estimations[0].candidats[0].valeur).toBe(18.6);
    expect(result.estimations[0].unite).toBe('ml');
    expect(result.estimations[0].hauteur_utilisee).toBeNull();
  });

  test('keeps the rank of each room so the selection can be matched', () => {
    // Une piece sans cotes n'est pas candidate : les rangs ne se suivent pas.
    const result = mapReading(avecHauteur([
      { libelle: 'WC', surface_m2: 2.1, texte_source_surface: 'WC 2,10 m2' },
      pieceCotee({ libelle: 'CHAMBRE' }),
    ]), 'peintre-piece-25m2');

    expect(result.estimations[0].candidats).toHaveLength(1);
    expect(result.estimations[0].candidats[0].piece_index).toBe(1);
    expect(result.estimations[0].candidats[0].libelle).toBe('CHAMBRE');
  });

  test('estimates nothing when the model attached no dimensions', () => {
    const result = mapReading(avecHauteur([
      { libelle: 'WC', surface_m2: 2.1, texte_source_surface: 'WC 2,10 m2' },
    ]), 'peintre-piece-25m2');

    expect(result.estimations).toEqual([]);
  });

  test('estimates nothing from a dimension the source does not carry', () => {
    // Meme garde-fou que partout ailleurs : le chiffre doit venir du texte.
    const result = mapReading(avecHauteur([pieceCotee({ longueur_m: 7.7 })]), 'peintre-piece-25m2');

    expect(result.estimations).toEqual([]);
  });

  test('does not offer wall estimates to a trade that has no such field', () => {
    const result = mapReading(avecHauteur([pieceCotee()]), 'carreleur-salle-de-bain-8m2');

    expect(result.estimations).toEqual([]);
  });
});

describe('planReaderService - cotations de repere', () => {
  test('shows the raw dimensions when no room carries its own', () => {
    // Repli prevu : on affiche l'information brute plutot que de recoller une
    // cotation a une piece apres coup.
    const result = mapReading({
      pieces: [{ libelle: 'WC', surface_m2: 2.1, texte_source_surface: 'WC 2,10 m2' }],
      cotations: [
        { valeur: 4.2, unite: 'm', texte_source: '4,20 m' },
        { valeur: 5.1, unite: 'm', texte_source: '5,10 m' },
      ],
      illisible: [],
    }, 'peintre-piece-25m2');

    const repere = result.indications.find((i) => /Cotations lues/.test(i.texte));
    expect(repere.champ_cible).toBe('murs');
    expect(repere.texte).toMatch(/4\.2 m/);
    expect(repere.texte).toMatch(/5\.1 m/);
    // Aucune n'est rattachee a une piece, et le texte le dit.
    expect(repere.texte).toMatch(/sans rattachement/i);
  });

  test('keeps a dimension whose source is written in centimetres', () => {
    // Releve sur un vrai plan : le modele convertit en metres, la source reste
    // en cm. Le comparateur de chiffres nus vidait le repli de toute cote.
    const result = mapReading({
      pieces: [],
      cotations: [
        { valeur: 3.3, unite: 'm', texte_source: '330cm' },
        { valeur: 0.72, unite: 'm', texte_source: '72cm' },
      ],
      illisible: [],
    }, 'peintre-piece-25m2');

    const repere = result.indications.find((i) => /Cotations lues/.test(i.texte));
    expect(repere.texte).toMatch(/3\.3 m/);
    expect(repere.texte).toMatch(/0\.72 m/);
  });

  test('filters out a dimension its own source does not carry', () => {
    const result = mapReading({
      pieces: [{ libelle: 'WC', surface_m2: 2.1, texte_source_surface: 'WC 2,10 m2' }],
      cotations: [
        { valeur: 4.2, unite: 'm', texte_source: '4,20 m' },
        { valeur: 99, unite: 'm', texte_source: '4,20 m' },
      ],
      illisible: [],
    }, 'peintre-piece-25m2');

    const repere = result.indications.find((i) => /Cotations lues/.test(i.texte));
    expect(repere.texte).toMatch(/4\.2 m/);
    expect(repere.texte).not.toMatch(/99/);
  });

  test('stays quiet once an estimation exists', () => {
    // L'estimation est plus utile que la liste brute : afficher les deux
    // reviendrait a demander a l'artisan de trancher entre elles.
    const result = mapReading({
      pieces: [pieceCotee()],
      cotations: [{ valeur: 4.2, unite: 'm', texte_source: '4,20 m' }],
      illisible: [],
    }, 'peintre-piece-25m2');

    expect(result.indications.some((i) => /Cotations lues/.test(i.texte))).toBe(false);
  });
});
