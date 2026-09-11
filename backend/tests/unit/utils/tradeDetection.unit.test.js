const { detectTrade, TRADE_KEYWORDS } = require('../../../utils/tradeDetection');

/**
 * La detection de metier remplace un appel au modele par une regle. Ces tests
 * sont donc la seule garantie qu'elle se comporte bien : il n'y a pas de
 * « bon sens » d'un modele derriere pour rattraper une racine mal choisie.
 */

const CARRELAGE = 'carreleur-salle-de-bain-8m2';
const PEINTURE = 'peintre-piece-25m2';

describe('detectTrade - metier reconnu', () => {
  test.each([
    ['Carrelage salle de bain, pose diagonale', CARRELAGE],
    ['Poser de la faïence murale', CARRELAGE],
    ['Pose de carreaux 60x60 dans la cuisine', CARRELAGE],
    ['Grès cérame au sol', CARRELAGE],
    ['Peinture des murs et du plafond', PEINTURE],
    ['Repeindre la chambre', PEINTURE],
    ['Enduit et sous-couche avant peinture', PEINTURE],
  ])('« %s » -> %s', (description, attendu) => {
    const resultat = detectTrade(description);

    expect(resultat.templateId).toBe(attendu);
    expect(resultat.raison).toBe('métier reconnu');
    expect(resultat.motsCles.length).toBeGreaterThan(0);
  });

  test('ignores case and accents', () => {
    // L'artisan tape vite, souvent sans accent et parfois tout en majuscules.
    expect(detectTrade('FAIENCE').templateId).toBe(CARRELAGE);
    expect(detectTrade('faïence').templateId).toBe(CARRELAGE);
    expect(detectTrade('Apprêt et laque').templateId).toBe(PEINTURE);
  });
});

describe('detectTrade - on ne devine pas', () => {
  test('returns null when no keyword matches', () => {
    // Refaire une toiture n'est ni du carrelage ni de la peinture : proposer
    // l'un des deux ferait perdre plus de temps que la galerie.
    const resultat = detectTrade('Refaire la toiture');

    expect(resultat.templateId).toBeNull();
    expect(resultat.raison).toBe('aucun mot-clé reconnu');
  });

  test('returns null when two trades are mentioned', () => {
    // Deux metiers, deux devis. Choisir a la place de l'artisan reviendrait a
    // en escamoter un.
    const resultat = detectTrade('Carrelage et peinture de la salle de bain');

    expect(resultat.templateId).toBeNull();
    expect(resultat.raison).toBe('plusieurs métiers évoqués');
    expect(resultat.motsCles.length).toBeGreaterThan(1);
  });

  test.each([
    ['an empty string', ''],
    ['spaces only', '   '],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
  ])('handles %s without crashing', (_label, valeur) => {
    const resultat = detectTrade(valeur);

    expect(resultat.templateId).toBeNull();
    expect(Array.isArray(resultat.motsCles)).toBe(true);
  });

  test('does not match a keyword hidden inside an unrelated word', () => {
    // Garde-fou de non-regression : les racines sont courtes, il faut qu'elles
    // restent assez specifiques pour ne pas attraper n'importe quoi.
    expect(detectTrade('Devis pour une terrasse en bois').templateId).toBeNull();
    expect(detectTrade('Remplacement de la chaudière').templateId).toBeNull();
  });
});

describe('detectTrade - perimetre', () => {
  test('covers exactly the two trades readable on a plan', () => {
    // Plomberie et electricite sont hors perimetre : leurs champs sont des
    // listes de points qu'un plan ne porte pas en clair.
    expect(Object.keys(TRADE_KEYWORDS).sort()).toEqual([CARRELAGE, PEINTURE].sort());
  });

  test('never proposes a value for the form, only a trade', () => {
    // La description sert UNIQUEMENT a choisir le metier. Si elle mentionne
    // « renovation » ou « 12 m2 », rien de tout ca ne doit ressortir.
    const resultat = detectTrade('Carrelage 12 m2 en rénovation, pose droite');

    expect(Object.keys(resultat).sort()).toEqual(['motsCles', 'raison', 'templateId']);
  });
});
