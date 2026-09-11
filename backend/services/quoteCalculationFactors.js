/**
 * quoteCalculationFactors.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Coefficients metier utilises par les modeles de devis auto-calcules
 * (services/quoteCalculators.js).
 *
 * ⚠️ CE FICHIER NE CONTIENT QUE DES VALEURS. Aucune logique de calcul ici :
 * les formules vivent dans quoteCalculators.js. C'est volontaire — ces
 * coefficients sont provisoires et seront recalibres sur retour terrain, on
 * doit pouvoir les ajuster sans relire une ligne d'algorithme.
 *
 * Structure : une entree par metier, dont la cle reprend exactement le `domain`
 * du modele dans utils/quoteTemplates.js (lui-meme aligne sur les cles de
 * SPECIALIZATION_SYNONYMS). Ajouter un metier = ajouter une entree ici puis un
 * calculateur dans quoteCalculators.js, sans toucher a l'existant.
 *
 * Carrelage est le premier cas pilote ; Electrical Installation, Painting et
 * Plumbing suivront le meme principe.
 */

/**
 * Multiplicateur de main d'oeuvre en pose encastree.
 *
 * Partage entre la plomberie et l'electricite : le referentiel precise pour
 * l'electricite « meme logique, pas a reinventer ». Une seule valeur, pour
 * qu'une recalibration s'applique aux deux metiers.
 *
 * Le referentiel donne la fourchette 1,8-2,2 « a calibrer pilote ».
 */
const MULTIPLICATEUR_ENCASTRE = 2.0;  // provisoire — milieu de la fourchette 1,8-2,2 du referentiel, a calibrer

const QUOTE_CALCULATION_FACTORS = {

  // ── Carrelage ───────────────────────────────────────────────────────────────
  Tiling: {
    /**
     * Coefficient de chute par type de pose : proportion de matiere perdue en
     * coupe. Une pose droite gaspille peu, les poses obliques beaucoup plus.
     * Applique en multiplicateur : surface x (1 + chute).
     */
    chute: {
      droite:    0.06,  // provisoire — a recalibrer sur retour terrain
      diagonale: 0.12,  // provisoire — a recalibrer sur retour terrain
      chevrons:  0.15,  // provisoire — a recalibrer sur retour terrain
    },

    /**
     * Consommation de colle en kg par m², selon la position.
     * Un mur demande une couche plus fine qu'un sol.
     */
    colleKgParM2: {
      mur: 3,    // provisoire — a recalibrer sur retour terrain
      sol: 4.5,  // provisoire — a recalibrer sur retour terrain
    },

    /**
     * Majoration de colle pour les grands formats (>= 60 cm), qui imposent un
     * double encollage : le dos du carreau est encolle en plus du support.
     */
    colleMajorationGrandFormat: 1.3,  // provisoire — a recalibrer sur retour terrain

    /** Marge de securite sur la colle, toutes configurations confondues. */
    colleMarge: 1.10,  // provisoire — a recalibrer sur retour terrain

    /** Consommation de joint en kg par m². */
    jointKgParM2: 0.5,  // provisoire — a recalibrer sur retour terrain

    /**
     * Ragreage en kg par m² selon l'etat du support. Un support deja plan ne
     * consomme rien : la ligne n'est alors pas generee du tout.
     */
    ragreageKgParM2: {
      plan:       0,  // provisoire — a recalibrer sur retour terrain
      a_ragreer:  5,  // provisoire — a recalibrer sur retour terrain
    },

    /** Nombre de croisillons par m². Taux multiplicateur, pas un diviseur. */
    croisillonsParM2: 20,  // provisoire — a recalibrer sur retour terrain

    /**
     * Conditionnement commercial des produits en vrac, en kg par sac.
     * Sert uniquement a indiquer a l'artisan combien de sacs commander : la
     * quantite de la ligne reste exprimee en kg. Varie d'un fournisseur a
     * l'autre, d'ou sa presence ici et non en dur dans le moteur.
     */
    conditionnementKg: {
      colle:    25,  // provisoire — a recalibrer sur retour terrain
      joint:     5,  // provisoire — a recalibrer sur retour terrain
      ragreage: 25,  // provisoire — a recalibrer sur retour terrain
    },
  },

  // ── Peinture ─────────────────────────────────────────────────────────
  //
  // ⚠⚠ ATTENTION — STATUT DIFFERENT DU CARRELAGE ⚠⚠
  //
  // Le referentiel metier ne fournit AUCUNE valeur numerique pour la peinture :
  // il ne donne que les noms de variables. Les chiffres ci-dessous sont des
  // ordres de grandeur du secteur peinture batiment proposes par defaut pour
  // que la fonctionnalite tourne — ils n'ont ete valides par personne.
  //
  // Chacun porte la mention :
  //   provisoire — aucune valeur donnee dans le referentiel, a valider avec un
  //   peintre professionnel
  //
  // A la difference des coefficients Carrelage, qui viennent du PV d'equipe et
  // ne demandent qu'une recalibration, ceux-ci demandent une VALIDATION avant
  // toute mise en production.
  Painting: {
    /**
     * Rendements en m² couverts par litre. Plus la valeur est haute, plus le
     * produit couvre loin. Le calcul divise la surface par ce rendement.
     */
    rendementM2ParLitre: {
      // Appret fixateur, applique sur support neuf.
      appret: 10,      // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      // Sous-couche opacifiante, uniquement en cas de changement de couleur radical.
      sousCouche: 9,   // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      /**
       * Peinture de finition. Une finition plus brillante forme un film plus
       * mince et couvre donc un peu plus loin qu'un mat.
       */
      finition: {
        mat:       10,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
        satine:    11,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
        brillant:  12,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      },
    },

    /** Nombre de couches de finition appliquees. */
    couchesFinition: 2,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel

    /**
     * Enduit de rebouchage en kg par m², selon l'etat du support. L'enduit
     * s'applique ponctuellement, pas sur toute la surface : d'ou des valeurs
     * bien inferieures a 1. Un support en bon etat ne genere aucune ligne.
     */
    enduitKgParM2: {
      bon:      0,     // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      moyen:    0.3,   // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      mauvais:  0.8,   // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
    },

    /**
     * Conditionnement commercial, en litres par bidon. Sert uniquement a
     * indiquer combien de bidons commander : la ligne reste exprimee en litres.
     */
    conditionnementLitres: {
      appret:      5,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      sousCouche: 10,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
      finition:   10,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
    },

    /** Conditionnement de l'enduit, en kg par sac. */
    conditionnementKg: {
      enduit: 5,  // provisoire — aucune valeur donnee dans le referentiel, a valider avec un peintre professionnel
    },
  },

  // ── Plomberie ───────────────────────────────────────────────────────────────
  //
  // Cette entree melange DEUX statuts differents, clairement separes ci-dessous.
  // Ne pas les confondre au moment de recalibrer.
  Plumbing: {

    // ═══ SOURCE : Referentiel section 1.2, tableau des points d'eau ═══════════
    //
    // Le referentiel ne donne QUE des nombres de points de raccordement. Pas de
    // designation produit, pas d'unite, pas de quantite de main d'oeuvre.
    // Ces comptages-la sont sourcés ; tout le reste de cette entree ne l'est pas.
    //
    // `evacuation` : le referentiel donne parfois une fourchette. Retenu :
    //   - point simple  « 0-1 » -> 0 (pas d'evacuation systematique)
    //   - evier         « 1-2 » -> 1 (bac simple ; le double-bac en demande 2)
    //   - WC alimentation « 1-2 » -> 1
    RECETTE_BASE: {
      point_simple: {
        alimentation: 1, evacuation: 0, siphon: false, diametreEvacuationMm: 40,
      },
      lavabo: {
        alimentation: 2, evacuation: 1, siphon: true, diametreEvacuationMm: 40,
      },
      evier: {
        alimentation: 2, evacuation: 1, siphon: true, diametreEvacuationMm: 40,
      },
      wc: {
        // Garde d'eau integree : pas de siphon a fournir.
        alimentation: 1, evacuation: 1, siphon: false, diametreEvacuationMm: 100,
      },
      douche_receveur: {
        alimentation: 2, evacuation: 1, siphon: true, diametreEvacuationMm: 40,
        receveur: true,
      },
      douche_italienne: {
        // Etancheite et pente sont partagees avec le lot carrelage : hors devis.
        alimentation: 2, evacuation: 1, siphon: true, diametreEvacuationMm: 50,
        siphonDeSol: true,
      },
      baignoire: {
        alimentation: 2, evacuation: 1, siphon: true, diametreEvacuationMm: 40,
        fixation: true,
      },
    },

    /**
     * Reseau amont, pose une fois par chantier.
     * SOURCE : referentiel, litteralement (quantites et unites comprises).
     */
    reseauAmont: {
      raccordementCompteur:  { quantity: 1, unit: 'forfait' },
      vanneArretGenerale:    { quantity: 1, unit: 'unité' },
      nourrice:              { quantity: 1, unit: 'unité' },
    },

    /** Nourrice ajoutee si le nombre de points est STRICTEMENT superieur. */
    seuilNourrice: 3,  // SOURCE : referentiel, « si > 3 points »

    /** Voir MULTIPLICATEUR_ENCASTRE en tete de fichier : valeur partagee. */
    multiplicateurEncastre: MULTIPLICATEUR_ENCASTRE,

    // ═══ NON SOURCE : extrapolation a partir de l'exemple agrege du PV ════════
    //
    // Le PV donne un seul exemple, agrege pour « 3 points d'eau » :
    //   Tube cuivre 14/16mm 9 ml | Raccords a compression 15 u
    //   Robinet d'arret 1/4 tour 3 u | Joint teflon 12m 3 rouleaux
    //
    // Les taux ci-dessous en derivent en les rapportant au nombre de points de
    // raccordement, de sorte qu'un lavabo (2 alimentations) consomme environ le
    // double d'un point simple (1 alimentation). C'est une extrapolation, pas
    // une donnee : aucun de ces chiffres ne figure dans le referentiel.
    composantsParPoint: {
      /** Alimentation en cuivre, en ml par point de raccordement alimente. */
      tubeCuivreMlParAlimentation: 3,      // provisoire — non source du referentiel, a valider avec un plombier
      /** Raccords a compression, par point de raccordement alimente. */
      raccordsParAlimentation: 4,          // provisoire — non source du referentiel, a valider avec un plombier
      /** Robinet d'arret, un par arrivee. */
      robinetArretParAlimentation: 1,      // provisoire — non source du referentiel, a valider avec un plombier
      /** Evacuation PVC, en ml par point de raccordement evacue. */
      tubeEvacuationMlParEvacuation: 2,    // provisoire — non source du referentiel, a valider avec un plombier
      /** Consommable d'etancheite, forfaitaire par point d'eau. */
      tefloneRouleauParPoint: 1,           // provisoire — non source du referentiel, a valider avec un plombier
    },

    /**
     * Main d'oeuvre de base par point d'eau, en heures, avant le multiplicateur
     * d'encastrement. Echelonnee sur la complexite de pose.
     */
    mainOeuvreHeuresParPoint: {
      point_simple:      1.5,  // provisoire — non source du referentiel, a valider avec un plombier
      lavabo:            2.5,  // provisoire — non source du referentiel, a valider avec un plombier
      evier:             3,    // provisoire — non source du referentiel, a valider avec un plombier
      wc:                3,    // provisoire — non source du referentiel, a valider avec un plombier
      douche_receveur:   4,    // provisoire — non source du referentiel, a valider avec un plombier
      douche_italienne:  6,    // provisoire — non source du referentiel, a valider avec un plombier
      baignoire:         5,    // provisoire — non source du referentiel, a valider avec un plombier
    },
  },

  // ── Electricite ─────────────────────────────────────────────────────────────
  //
  // La cle reprend le `domain` du modele, qui vaut litteralement
  // 'Electrical Installation' dans utils/quoteTemplates.js.
  //
  // Comme pour la plomberie, deux statuts cohabitent : les regles de circuit
  // viennent du referentiel, la majoration « goulotte » non.
  'Electrical Installation': {

    /**
     * Regles de repartition en circuits.
     * SOURCE : referentiel — nombre de points maximum par circuit et calibre du
     * disjoncteur associe. Au-dela du maximum, il faut un circuit de plus.
     */
    CIRCUITS: {
      eclairage:         { pointsMax: 8, calibreA: 10 },
      prise_courante:    { pointsMax: 8, calibreA: 16 },
      prise_specialisee: { pointsMax: 1, calibreA: 32 },
    },

    /**
     * Bloc tableau, pose une fois par chantier, selon qu'il est neuf ou etendu.
     * SOURCE : referentiel, quantites et unites comprises.
     */
    tableauNeuf: [
      { designation: 'Coffret tableau',            quantity: 1, unit: 'unité' },
      { designation: 'Disjoncteur général',        quantity: 1, unit: 'unité' },
      { designation: 'Différentiel 30mA',          quantity: 1, unit: 'unité' },
      { designation: 'Raccordement compteur STEG', quantity: 1, unit: 'forfait' },
    ],
    tableauExtension: {
      diagnostic:        { designation: 'Diagnostic tableau existant', quantity: 1, unit: 'forfait' },
      // Uniquement si l'artisan declare le tableau plein.
      rangeeAdditionnelle: { designation: 'Rangée additionnelle',      quantity: 1, unit: 'unité' },
      // Quantite = nombre total de circuits, calcule depuis la liste de points.
      disjoncteurNouveauCircuit: { designation: 'Disjoncteur nouveau circuit', unit: 'unité' },
    },

    /**
     * Multiplicateur de main d'oeuvre selon le mode de pose.
     * `encastre` est la valeur partagee avec la plomberie ; `goulotte` ne figure
     * pas dans le referentiel.
     */
    multiplicateurPose: {
      apparent: 1.0,
      encastre: MULTIPLICATEUR_ENCASTRE,
      goulotte: 1.3,  // provisoire — non donne par le referentiel, a valider avec un electricien
    },
  },

};

module.exports = { QUOTE_CALCULATION_FACTORS };
