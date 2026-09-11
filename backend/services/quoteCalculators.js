/**
 * quoteCalculators.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Moteurs de calcul des modeles de devis auto-calcules.
 *
 * A partir des parametres saisis par l'artisan (surface, format, type de pose…),
 * un calculateur produit les lignes de devis pre-remplies. Les prix unitaires
 * restent a 0 : il n'existe pas de catalogue de prix, c'est l'artisan qui les
 * saisit ensuite. Les lignes generees sont un point de depart, pas un verrou —
 * elles restent entierement editables dans le formulaire.
 *
 * ⚠️ Tous les coefficients viennent de services/quoteCalculationFactors.js.
 * Ne jamais ecrire une valeur numerique metier ici : elles sont provisoires et
 * doivent rester regroupees dans un seul fichier pour la recalibration.
 *
 * Ajouter un metier : ecrire son calculateur, puis l'enregistrer dans
 * TEMPLATE_CALCULATORS sous l'id de son modele.
 */

const { QUOTE_CALCULATION_FACTORS } = require('./quoteCalculationFactors');

/** Arrondi a 2 decimales, pour les quantites continues (m², kg). */
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Fabrique une ligne de devis au format attendu par quoteLineSchema.
 * Le prix unitaire est toujours 0 : pas de catalogue de prix.
 */
const buildLine = (designation, quantity, unit, lineType) => ({
  designation,
  quantity,
  unit,
  unitPrice: 0,
  lineType,
  total: 0,
});

/**
 * Fabrique une ligne de produit en vrac (colle, joint, ragreage).
 *
 * Ces produits ne se commandent ni au gramme ni au kilo : la quantite est
 * arrondie au kilo entier superieur, et la designation rappelle combien de sacs
 * cela represente. Sans ce rappel, un artisan qui saisit un prix au sac sur une
 * ligne exprimee en kg obtient un total faux d'un facteur egal a la contenance.
 *
 * @param {string} designation - Libelle sans l'equivalence
 * @param {number} rawKg       - Quantite brute issue du calcul
 * @param {number} sacKg       - Contenance d'un sac, en kg (facteur configurable)
 * @returns {object} ligne de devis
 */
const buildPackagedLine = (designation, rawQuantity, unit, packaging) => {
  const { contenance, contenant, uniteAffichee } = packaging;
  // round2 avant le plafond : sans lui, le bruit flottant (20 x 4.5 x 1.10 vaut
  // 99.000000000000014) ferait grimper un resultat entier a l'unite superieure.
  const quantity = Math.ceil(round2(rawQuantity));
  const nombre = Math.ceil(quantity / contenance);
  const equivalence = `≈ ${nombre} ${contenant}${nombre > 1 ? 's' : ''} de ${contenance} ${uniteAffichee}`;
  return buildLine(`${designation} — ${equivalence}`, quantity, unit, 'material');
};

/** Produit vendu au sac : quantite en kg, equivalence en sacs. */
const buildBulkLine = (designation, rawKg, sacKg) =>
  buildPackagedLine(designation, rawKg, 'kg', {
    contenance: sacKg,
    contenant: 'sac',
    uniteAffichee: 'kg',
  });

/** Produit vendu au bidon : quantite en litres, equivalence en bidons. */
const buildLiquidLine = (designation, rawLitres, bidonLitres) =>
  buildPackagedLine(designation, rawLitres, 'litre', {
    contenance: bidonLitres,
    contenant: 'bidon',
    uniteAffichee: 'L',
  });

/**
 * Fusionne les lignes identiques en sommant leurs quantites.
 *
 * Un chantier de plomberie a six points d'eau produit sinon une trentaine de
 * lignes dont la moitie repete « Tube cuivre 14/16mm ». On agrege sur le triplet
 * (designation, unite, type) et on conserve l'ordre de premiere apparition, qui
 * suit l'ordre du chantier.
 *
 * L'artisan garde la main : il peut toujours scinder une ligne agregee.
 *
 * @param {Array<object>} lines
 * @returns {Array<object>} lignes fusionnees
 */
const aggregateLines = (lines) => {
  const parCle = new Map();

  lines.forEach((line) => {
    const cle = `${line.designation}|${line.unit}|${line.lineType}`;
    const existante = parCle.get(cle);
    if (existante) {
      existante.quantity = round2(existante.quantity + line.quantity);
    } else {
      parCle.set(cle, { ...line });
    }
  });

  return Array.from(parCle.values());
};

/**
 * Valide et normalise la surface.
 * @throws {Error} si la surface est absente, non numerique ou <= 0
 */
const parseSurface = (raw) => {
  const surface = Number(raw);
  if (!Number.isFinite(surface) || surface <= 0) {
    throw new Error('surface must be a number greater than 0');
  }
  return surface;
};

/**
 * Valide une surface qui peut legitimement valoir zero : un chantier
 * « murs seuls » n'a pas de plafond a peindre.
 * @throws {Error} si la valeur est negative ou non numerique
 */
const parseSurfaceOrZero = (raw, fieldName) => {
  if (raw === undefined || raw === null || raw === '') return 0;
  const surface = Number(raw);
  if (!Number.isFinite(surface) || surface < 0) {
    throw new Error(`${fieldName} must be a number greater than or equal to 0`);
  }
  return surface;
};

/**
 * Valide un parametre a choix ferme contre les cles d'un bareme.
 * @throws {Error} si la valeur ne fait pas partie des choix connus
 */
const parseChoice = (raw, allowed, fieldName) => {
  const value = String(raw || '');
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }
  return value;
};

/**
 * Calculateur Carrelage.
 *
 * Formules (coefficients dans quoteCalculationFactors.Tiling) :
 *   carreaux    = surface x (1 + chute[typePose])
 *   colle       = surface x colleKgParM2[position] x majorationGrandFormat x marge
 *   joint       = surface x jointKgParM2
 *   ragreage    = surface x ragreageKgParM2[etatSupport]   (omis si support plan)
 *   croisillons = surface x croisillonsParM2               (arrondi au superieur)
 *   main d'oeuvre = surface                                 (quantite en m²)
 *
 * Les plinthes ne sont pas calculees : elles demandent le perimetre de la piece
 * moins les ouvertures, donnees qui n'existent nulle part dans l'application.
 * L'artisan ajoute cette ligne a la main si elle le concerne.
 *
 * @param {object} params
 * @param {number} params.surface       - Surface a carreler, en m²
 * @param {string} params.formatCarreau - 'petit' (< 60 cm) | 'grand' (>= 60 cm)
 * @param {string} params.typePose      - 'droite' | 'diagonale' | 'chevrons'
 * @param {string} params.position      - 'mur' | 'sol'
 * @param {string} params.etatSupport   - 'plan' | 'a_ragreer'
 * @returns {Array<object>} lignes de devis pretes a etre inserees
 * @throws {Error} si un parametre est invalide
 */
function computeTilingLines(params = {}) {
  const factors = QUOTE_CALCULATION_FACTORS.Tiling;

  const surface = parseSurface(params.surface);
  const formatCarreau = parseChoice(params.formatCarreau, ['petit', 'grand'], 'formatCarreau');
  const typePose = parseChoice(params.typePose, Object.keys(factors.chute), 'typePose');
  const position = parseChoice(params.position, Object.keys(factors.colleKgParM2), 'position');
  const etatSupport = parseChoice(params.etatSupport, Object.keys(factors.ragreageKgParM2), 'etatSupport');

  const lines = [];

  // Carreaux : la surface plus la chute de coupe.
  const carreaux = surface * (1 + factors.chute[typePose]);
  lines.push(buildLine(
    `Carreaux (pose ${typePose}, chute ${Math.round(factors.chute[typePose] * 100)} %)`,
    round2(carreaux),
    'm²',
    'material'
  ));

  // Colle : ratio selon la position, majore en grand format (double encollage).
  const majorationFormat = formatCarreau === 'grand' ? factors.colleMajorationGrandFormat : 1;
  const colle = surface * factors.colleKgParM2[position] * majorationFormat * factors.colleMarge;
  lines.push(buildBulkLine(
    formatCarreau === 'grand'
      ? `Colle carrelage (${position}, double encollage)`
      : `Colle carrelage (${position})`,
    colle,
    factors.conditionnementKg.colle
  ));

  // Joint.
  lines.push(buildBulkLine(
    'Joint de carrelage',
    surface * factors.jointKgParM2,
    factors.conditionnementKg.joint
  ));

  // Ragreage : uniquement si le support n'est pas deja plan.
  const ragreageRatio = factors.ragreageKgParM2[etatSupport];
  if (ragreageRatio > 0) {
    lines.push(buildBulkLine(
      'Ragreage du support',
      surface * ragreageRatio,
      factors.conditionnementKg.ragreage
    ));
  }

  // Croisillons : on ne commande pas une fraction de croisillon.
  lines.push(buildLine(
    'Croisillons',
    Math.ceil(surface * factors.croisillonsParM2),
    'unité',
    'material'
  ));

  // Main d'oeuvre : facturee au m², prix unitaire saisi par l'artisan.
  lines.push(buildLine(
    "Main d'œuvre pose carrelage",
    round2(surface),
    'm²',
    'labor'
  ));

  return lines;
}

/**
 * Calculateur Peinture.
 *
 * ⚠ Les coefficients Painting de quoteCalculationFactors.js sont des ordres
 * de grandeur proposes par defaut : le referentiel metier n'en fournit aucun.
 * Ils demandent une VALIDATION par un peintre professionnel, pas seulement une
 * recalibration comme ceux du carrelage.
 *
 * Formules (coefficients dans quoteCalculationFactors.Painting) :
 *   surfaceMurs   = somme des murs saisis (surface, ou longueur x hauteur)
 *   surfaceTotale = surfaceMurs + surfacePlafond
 *   appret     = surfaceTotale / rendement.appret            (neuf uniquement)
 *   poncage    = surfaceTotale, ligne de main d'oeuvre       (renovation uniquement)
 *   sousCouche = surfaceTotale / rendement.sousCouche        (renovation + couleur radicale)
 *   enduit     = surfaceTotale x enduitKgParM2[etatSupport]  (omis si support bon)
 *   finition   = surfaceTotale x couchesFinition / rendement.finition[typeFinition]
 *   main d'oeuvre = surfaceTotale                            (quantite en m²)
 *
 * Deux lignes ne sont volontairement pas calculees : l'adhesif de protection
 * (ml) et les baches (m²) dependent du perimetre des ouvertures et de la surface
 * au sol, donnees absentes de l'application. L'artisan les ajoute a la main,
 * comme les plinthes en carrelage.
 *
 * 'param {object} params
 * 'param {Array}  params.murs                - Murs a peindre, un par element
 * 'param {number} [params.surfaceMurs]       - Surface de murs en m², accepte
 *   en repli quand `murs` est absent (anciens appels et devis en cours)
 * 'param {number} params.surfacePlafond      - Surface de plafond, en m² (0 admis)
 * 'param {string} params.etatSupport         - 'bon' | 'moyen' | 'mauvais'
 * 'param {string} params.contexte            - 'neuf' | 'renovation'
 * 'param {string} params.typeFinition        - 'mat' | 'satine' | 'brillant'
 * 'param {string} [params.changementCouleur] - 'oui' | 'non', pertinent en renovation
 * 'returns {Array<object>} lignes de devis pretes a etre inserees
 * 'throws {Error} si un parametre est invalide
 */
/** Libelles d'affichage des finitions ; les cles, elles, restent sans accent. */
const LIBELLE_FINITION = {
  mat: 'mat',
  satine: 'satiné',
  brillant: 'brillant',
};

/**
 * Somme les murs saisis.
 *
 * Chaque mur vaut soit sa surface, soit sa longueur multipliee par sa hauteur.
 * Les deux formes coexistent dans une meme liste : un plan donne parfois la
 * surface d'un pignon et la longueur des trois autres murs.
 *
 * `surfaceMurs` en nombre reste accepte quand `murs` est absent : les devis
 * ouverts avant le passage a la liste, et les appels directs au calculateur,
 * continuent de fonctionner.
 *
 * @throws {Error} en designant le mur fautif : murs[2].longueurM must be...
 */
function parseSurfaceMurs(params) {
  const murs = params.murs;
  if (!Array.isArray(murs)) {
    return parseSurfaceOrZero(params.surfaceMurs, 'surfaceMurs');
  }

  return murs.reduce((total, mur, index) => {
    const prefixe = `murs[${index}]`;
    const mode = parseChoice(
      mur && mur.mode ? mur.mode : 'surface',
      ['surface', 'longueur'],
      `${prefixe}.mode`
    );

    if (mode === 'surface') {
      return total + parseSurfaceOrZero(mur && mur.surfaceM2, `${prefixe}.surfaceM2`);
    }

    const longueur = parseSurfaceOrZero(mur && mur.longueurM, `${prefixe}.longueurM`);
    const hauteur = parseSurfaceOrZero(mur && mur.hauteurM, `${prefixe}.hauteurM`);
    return total + longueur * hauteur;
  }, 0);
}

function computePaintingLines(params = {}) {
  const factors = QUOTE_CALCULATION_FACTORS.Painting;

  const surfaceMurs = parseSurfaceMurs(params);
  const surfacePlafond = parseSurfaceOrZero(params.surfacePlafond, 'surfacePlafond');
  const surfaceTotale = round2(surfaceMurs + surfacePlafond);
  if (surfaceTotale <= 0) {
    throw new Error('surfaceMurs + surfacePlafond must be greater than 0');
  }

  const etatSupport = parseChoice(params.etatSupport, Object.keys(factors.enduitKgParM2), 'etatSupport');
  const contexte = parseChoice(params.contexte, ['neuf', 'renovation'], 'contexte');
  const typeFinition = parseChoice(
    params.typeFinition,
    Object.keys(factors.rendementM2ParLitre.finition),
    'typeFinition'
  );
  // Champ masque hors renovation : absent vaut « non ».
  const changementCouleurRaw = params.changementCouleur === undefined || params.changementCouleur === ''
    ? 'non'
    : params.changementCouleur;
  const changementCouleur = parseChoice(changementCouleurRaw, ['oui', 'non'], 'changementCouleur');

  const lines = [];

  // 1. Enduit de rebouchage : rien a reboucher sur un support en bon etat.
  const enduitRatio = factors.enduitKgParM2[etatSupport];
  if (enduitRatio > 0) {
    lines.push(buildBulkLine(
      `Enduit de rebouchage (support ${etatSupport})`,
      surfaceTotale * enduitRatio,
      factors.conditionnementKg.enduit
    ));
  }

  // 2. Poncage : forfait de preparation, uniquement en renovation.
  if (contexte === 'renovation') {
    lines.push(buildLine(
      'Ponçage et préparation du support',
      round2(surfaceTotale),
      'm²',
      'labor'
    ));
  }

  // 3. Appret fixateur : uniquement sur du neuf.
  if (contexte === 'neuf') {
    lines.push(buildLiquidLine(
      'Apprêt fixateur',
      surfaceTotale / factors.rendementM2ParLitre.appret,
      factors.conditionnementLitres.appret
    ));
  }

  // 4. Sous-couche : seulement pour couvrir un changement de couleur radical.
  if (contexte === 'renovation' && changementCouleur === 'oui') {
    lines.push(buildLiquidLine(
      'Sous-couche opacifiante (changement de couleur)',
      surfaceTotale / factors.rendementM2ParLitre.sousCouche,
      factors.conditionnementLitres.sousCouche
    ));
  }

  // 5. Peinture de finition, en plusieurs couches.
  const finition = (surfaceTotale * factors.couchesFinition)
    / factors.rendementM2ParLitre.finition[typeFinition];
  lines.push(buildLiquidLine(
    `Peinture de finition ${LIBELLE_FINITION[typeFinition]} (${factors.couchesFinition} couches)`,
    finition,
    factors.conditionnementLitres.finition
  ));

  // 6. Consommables : forfait, non calcule.
  lines.push(buildLine('Rouleau + bac + manchon', 1, 'kit', 'material'));

  // 7. Main d'oeuvre : facturee au m², prix unitaire saisi par l'artisan.
  lines.push(buildLine(
    "Main d'œuvre peinture",
    round2(surfaceTotale),
    'm²',
    'labor'
  ));

  return lines;
}

/**
 * Calculateur Plomberie.
 *
 * Structure differente des deux autres metiers : l'artisan ne remplit pas un
 * formulaire a plat mais construit une LISTE de points d'eau, chacun avec son
 * sous-type et son mode de pose. Le devis se compose de deux blocs :
 *
 *   1. Reseau amont, une fois par chantier : raccordement au compteur, vanne
 *      d'arret generale, et une nourrice si le nombre de points depasse le seuil.
 *   2. Un jeu de lignes par point d'eau, derive de sa recette.
 *
 * Les lignes sont ensuite agregees : trois lavabos donnent une seule ligne de
 * tube cuivre a la quantite cumulee, pas trois lignes identiques.
 *
 * ⚠ STATUT DES COEFFICIENTS — voir quoteCalculationFactors.Plumbing. Le
 * referentiel ne fournit que les comptages alimentation / evacuation et le bloc
 * reseau amont. Les designations produit, les taux par point de raccordement et
 * la main d'oeuvre sont extrapoles de l'exemple agrege du PV : ils demandent une
 * validation par un plombier.
 *
 * @param {object} params
 * @param {Array<object>} params.pointsEau - Au moins un point
 * @param {string} params.pointsEau[].sousType - Cle de RECETTE_BASE
 * @param {string} params.pointsEau[].modePose - 'apparent' | 'encastre'
 * @param {number} [params.pointsEau[].distanceMl] - Saignee, si encastre
 * @returns {Array<object>} lignes de devis agregees
 * @throws {Error} si un parametre est invalide
 */
function computePlumbingLines(params = {}) {
  const factors = QUOTE_CALCULATION_FACTORS.Plumbing;
  const taux = factors.composantsParPoint;

  const pointsEau = params.pointsEau;
  if (!Array.isArray(pointsEau) || pointsEau.length === 0) {
    throw new Error('pointsEau must contain at least one water point');
  }

  const lines = [];

  // ── 1. Reseau amont, une fois par chantier ─────────────────────────────────
  const amont = factors.reseauAmont;
  lines.push(buildLine(
    'Raccordement au compteur',
    amont.raccordementCompteur.quantity,
    amont.raccordementCompteur.unit,
    'material'
  ));
  lines.push(buildLine(
    "Vanne d'arrêt générale",
    amont.vanneArretGenerale.quantity,
    amont.vanneArretGenerale.unit,
    'material'
  ));
  if (pointsEau.length > factors.seuilNourrice) {
    lines.push(buildLine(
      'Nourrice de distribution',
      amont.nourrice.quantity,
      amont.nourrice.unit,
      'material'
    ));
  }

  // ── 2. Un jeu de lignes par point d'eau ────────────────────────────────────
  pointsEau.forEach((point, index) => {
    // Les erreurs designent l'element fautif : pointsEau[2].sousType must be...
    const prefixe = `pointsEau[${index}]`;
    const sousType = parseChoice(
      point && point.sousType,
      Object.keys(factors.RECETTE_BASE),
      `${prefixe}.sousType`
    );
    const modePose = parseChoice(
      point && point.modePose,
      ['apparent', 'encastre'],
      `${prefixe}.modePose`
    );

    const recette = factors.RECETTE_BASE[sousType];

    // Alimentation.
    if (recette.alimentation > 0) {
      lines.push(buildLine(
        'Tube cuivre 14/16mm',
        round2(recette.alimentation * taux.tubeCuivreMlParAlimentation),
        'ml',
        'material'
      ));
      lines.push(buildLine(
        'Raccords à compression',
        recette.alimentation * taux.raccordsParAlimentation,
        'unité',
        'material'
      ));
      lines.push(buildLine(
        "Robinet d'arrêt 1/4 tour",
        recette.alimentation * taux.robinetArretParAlimentation,
        'unité',
        'material'
      ));
    }

    // Evacuation. Le diametre fait partie de la designation : un WC en Ø100 ne
    // s'agrege pas avec un lavabo en Ø40, ce sont deux produits differents.
    if (recette.evacuation > 0) {
      lines.push(buildLine(
        `Tube évacuation PVC Ø${recette.diametreEvacuationMm}`,
        round2(recette.evacuation * taux.tubeEvacuationMlParEvacuation),
        'ml',
        'material'
      ));
    }

    // Siphon. Celui d'une douche a l'italienne est un siphon de sol.
    if (recette.siphon) {
      lines.push(buildLine(
        recette.siphonDeSol
          ? `Siphon de sol Ø${recette.diametreEvacuationMm}`
          : 'Siphon',
        1,
        'unité',
        'material'
      ));
    }

    // Pieces propres a certains sous-types.
    if (recette.receveur) {
      lines.push(buildLine('Receveur de douche préfabriqué', 1, 'unité', 'material'));
    }
    if (recette.fixation) {
      lines.push(buildLine('Kit de fixation baignoire', 1, 'kit', 'material'));
    }

    // Consommable d'etancheite, forfaitaire par point.
    lines.push(buildLine(
      'Joint téflon 12m',
      taux.tefloneRouleauParPoint,
      'rouleau',
      'material'
    ));

    // Main d'oeuvre, majoree en pose encastree.
    const heuresBase = factors.mainOeuvreHeuresParPoint[sousType];
    const majoration = modePose === 'encastre' ? factors.multiplicateurEncastre : 1;
    lines.push(buildLine(
      "Main d'œuvre installation point d'eau",
      round2(heuresBase * majoration),
      'heure',
      'labor'
    ));

    // Saignee : declaratif, la distance saisie devient directement la quantite.
    if (modePose === 'encastre') {
      const distance = parseSurfaceOrZero(point && point.distanceMl, `${prefixe}.distanceMl`);
      if (distance > 0) {
        lines.push(buildLine('Saignée et rebouchage', round2(distance), 'ml', 'material'));
      }
    }
  });

  // ── 3. Un devis lisible plutot qu'une liste repetitive ─────────────────────
  return aggregateLines(lines);
}

/** Libelles d'affichage des types de point electrique. */
const LIBELLE_POINT_ELECTRIQUE = {
  prise_simple: 'Prise simple',
  point_lumineux: 'Point lumineux',
  interrupteur: 'Interrupteur',
};

/**
 * Calculateur Electricite.
 *
 * Meme structure de liste que la plomberie, mais la liste est PLATE : l'artisan
 * saisit des points, pas des circuits. Le regroupement en circuits est fait ici,
 * en comptant les points par type de circuit et en divisant par le nombre
 * maximum de points admis — c'est un calcul, pas une saisie.
 *
 * Le devis se compose de cinq blocs :
 *   1. Bloc tableau, une fois : neuf (4 lignes) ou extension (diagnostic,
 *      rangee additionnelle si le tableau est plein, disjoncteurs de circuit).
 *   2. Un disjoncteur par circuit necessaire, au calibre du type.
 *   3. Une ligne par type de point, quantites cumulees.
 *   4. Une ligne de main d'oeuvre, ponderee par le mode de pose de chaque point.
 *   5. Le cable, dont la longueur est declaree par l'artisan.
 *
 * ⚠ La longueur de cable n'est PAS calculee. Le referentiel indique lui-meme
 * que cette valeur est « non forfaitaire, a tester au pilote » : aucune formule
 * fiable n'existe, l'artisan la saisit.
 *
 * @param {object} params
 * @param {string} params.typeTableau - 'neuf' | 'extension'
 * @param {string} [params.tableauPlein] - 'oui' | 'non', pertinent en extension
 * @param {number} [params.longueurCableMl] - Longueur declaree, en ml
 * @param {Array<object>} params.pointsElectriques - Au moins un point
 * @param {string} params.pointsElectriques[].typeCircuit - Cle de CIRCUITS
 * @param {string} params.pointsElectriques[].typePoint - Type de point
 * @param {string} params.pointsElectriques[].modePose - 'apparent' | 'encastre' | 'goulotte'
 * @returns {Array<object>} lignes de devis agregees
 * @throws {Error} si un parametre est invalide
 */
function computeElectricalLines(params = {}) {
  const factors = QUOTE_CALCULATION_FACTORS['Electrical Installation'];

  const typeTableau = parseChoice(params.typeTableau, ['neuf', 'extension'], 'typeTableau');
  // Champ masque hors extension : absent vaut « non ».
  const tableauPleinRaw = params.tableauPlein === undefined || params.tableauPlein === ''
    ? 'non'
    : params.tableauPlein;
  const tableauPlein = parseChoice(tableauPleinRaw, ['oui', 'non'], 'tableauPlein');
  const longueurCableMl = parseSurfaceOrZero(params.longueurCableMl, 'longueurCableMl');

  const points = params.pointsElectriques;
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('pointsElectriques must contain at least one point');
  }

  // ── Validation et depouillement de la liste ────────────────────────────────
  const parCircuit = {};                  // typeCircuit -> nombre de points
  const parTypePoint = {};                // typePoint  -> nombre de points
  let mainOeuvrePonderee = 0;

  points.forEach((point, index) => {
    const prefixe = `pointsElectriques[${index}]`;
    const typeCircuit = parseChoice(
      point && point.typeCircuit,
      Object.keys(factors.CIRCUITS),
      `${prefixe}.typeCircuit`
    );
    const typePoint = parseChoice(
      point && point.typePoint,
      Object.keys(LIBELLE_POINT_ELECTRIQUE),
      `${prefixe}.typePoint`
    );
    const modePose = parseChoice(
      point && point.modePose,
      Object.keys(factors.multiplicateurPose),
      `${prefixe}.modePose`
    );

    parCircuit[typeCircuit] = (parCircuit[typeCircuit] || 0) + 1;
    parTypePoint[typePoint] = (parTypePoint[typePoint] || 0) + 1;
    mainOeuvrePonderee += factors.multiplicateurPose[modePose];
  });

  // ── 2. Regroupement en circuits ───────────────────────────────────────────
  // Un type de circuit qui depasse son maximum de points en demande plusieurs.
  // Calcule avant le bloc tableau, dont l'extension a besoin du total.
  const circuits = Object.keys(factors.CIRCUITS)
    .filter((typeCircuit) => parCircuit[typeCircuit] > 0)
    .map((typeCircuit) => {
      const regle = factors.CIRCUITS[typeCircuit];
      return {
        typeCircuit,
        calibreA: regle.calibreA,
        nombre: Math.ceil(parCircuit[typeCircuit] / regle.pointsMax),
      };
    });
  const totalCircuits = circuits.reduce((somme, c) => somme + c.nombre, 0);

  const lines = [];

  // ── 1. Bloc tableau, une fois par chantier ────────────────────────────────
  if (typeTableau === 'neuf') {
    factors.tableauNeuf.forEach((ligne) => {
      lines.push(buildLine(ligne.designation, ligne.quantity, ligne.unit, 'material'));
    });
  } else {
    const extension = factors.tableauExtension;
    lines.push(buildLine(
      extension.diagnostic.designation,
      extension.diagnostic.quantity,
      extension.diagnostic.unit,
      'material'
    ));
    if (tableauPlein === 'oui') {
      lines.push(buildLine(
        extension.rangeeAdditionnelle.designation,
        extension.rangeeAdditionnelle.quantity,
        extension.rangeeAdditionnelle.unit,
        'material'
      ));
    }
    lines.push(buildLine(
      extension.disjoncteurNouveauCircuit.designation,
      totalCircuits,
      extension.disjoncteurNouveauCircuit.unit,
      'material'
    ));
  }

  // ── 2 bis. Un disjoncteur par circuit, au calibre du type ─────────────────
  circuits.forEach(({ calibreA, nombre }) => {
    lines.push(buildLine(
      // La precision n'apparait qu'au-dela d'un circuit, comme le double
      // encollage en carrelage : on ne surcharge pas le cas nominal.
      nombre > 1 ? `Disjoncteur ${calibreA}A (${nombre} circuits)` : `Disjoncteur ${calibreA}A`,
      nombre,
      'unité',
      'material'
    ));
  });

  // ── 3. Une ligne par type de point, tous circuits confondus ───────────────
  Object.keys(LIBELLE_POINT_ELECTRIQUE)
    .filter((typePoint) => parTypePoint[typePoint] > 0)
    .forEach((typePoint) => {
      lines.push(buildLine(
        LIBELLE_POINT_ELECTRIQUE[typePoint],
        parTypePoint[typePoint],
        'unité',
        'material'
      ));
    });

  // ── 4. Main d'oeuvre, ponderee point par point selon le mode de pose ──────
  lines.push(buildLine(
    "Main d'œuvre installation électrique",
    round2(mainOeuvrePonderee),
    'unité',
    'labor'
  ));

  // ── 5. Cable : declaratif, la longueur saisie devient la quantite ─────────
  if (longueurCableMl > 0) {
    lines.push(buildLine('Câble électrique', round2(longueurCableMl), 'ml', 'material'));
  }

  return aggregateLines(lines);
}

/**
 * Calculateurs disponibles, indexes par id de modele
 * (utils/quoteTemplates.js). Un modele absent de cette table n'est pas
 * auto-calcule et garde son comportement d'origine : ses lignes figees.
 */
const TEMPLATE_CALCULATORS = {
  'carreleur-salle-de-bain-8m2': computeTilingLines,
  'peintre-piece-25m2': computePaintingLines,
  'plombier-3-points-eau': computePlumbingLines,
  'electricien-5-points': computeElectricalLines,
};

/**
 * Indique si un modele sait calculer ses lignes.
 * @param {string} templateId
 * @returns {boolean}
 */
function hasCalculator(templateId) {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_CALCULATORS, templateId);
}

/**
 * Calcule les lignes d'un modele a partir des parametres saisis.
 * @param {string} templateId
 * @param {object} params
 * @returns {Array<object>}
 * @throws {Error} si le modele n'a pas de calculateur ou si un parametre est invalide
 */
function computeTemplateLines(templateId, params) {
  const calculator = TEMPLATE_CALCULATORS[templateId];
  if (!calculator) {
    throw new Error(`Template ${templateId} is not auto-calculated`);
  }
  return calculator(params);
}

module.exports = {
  computeTilingLines,
  computePaintingLines,
  computePlumbingLines,
  computeElectricalLines,
  aggregateLines,
  computeTemplateLines,
  hasCalculator,
  TEMPLATE_CALCULATORS,
};
