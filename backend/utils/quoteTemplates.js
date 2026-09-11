/**
 * quoteTemplates.js — BMP.tn
 * ──────────────────────────
 * Modeles de devis par corps de metier (« devis prets »), issus du PV d'equipe,
 * section « Use cases metiers ».
 *
 * Les prix unitaires valent 0 : il n'existe pas encore de catalogue de prix de
 * reference, c'est l'artisan qui les saisit. Une etape ulterieure pourra brancher
 * un catalogue ici sans toucher au reste de la chaine.
 *
 * `domain` reprend exactement les cles de SPECIALIZATION_SYNONYMS
 * (services/artisanAiSearchService.js), qui alimentent le champ `domain` de
 * l'artisan — c'est ce qui permet de mettre en avant le bon modele.
 */

/** Unites autorisees sur une ligne de devis. `ml` = metre lineaire. */
const QUOTE_UNITS = [
  'ml',
  'unité',
  'heure',
  'm²',
  'sac',
  'sachet',
  'bidon',
  'kit',
  'rouleau',
  'kg',
  'litre',
  'forfait',
  'jours',
  'semaine',
  'aucun',
];

const QUOTE_LINE_TYPES = ['labor', 'material'];

const QUOTE_TEMPLATES = [
  {
    id: 'electricien-5-points',
    domain: 'Electrical Installation',
    title: 'Installation électrique — points',
    /**
     * Modele auto-calcule combinant les DEUX formes : des champs scalaires de
     * premier niveau (tableau, longueur de cable) et une liste repetable de
     * points, a plat. Le regroupement en circuits n'est pas saisi : il est
     * calcule dans quoteCalculators.computeElectricalLines a partir du nombre
     * de points de chaque type de circuit.
     *
     * Les `value` des types de circuit doivent rester alignees sur les cles de
     * CIRCUITS (quoteCalculationFactors) — un test le verifie.
     */
    parameters: [
      {
        key: 'typeTableau',
        label: 'Type de tableau',
        type: 'select',
        default: 'neuf',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'extension', label: 'Extension sur tableau existant' },
        ],
      },
      {
        key: 'tableauPlein',
        label: 'Tableau déjà plein ?',
        type: 'select',
        default: 'non',
        help: 'Déclenche la ligne « rangée additionnelle ».',
        showIf: { key: 'typeTableau', equals: 'extension' },
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' },
        ],
      },
      {
        key: 'longueurCableMl',
        label: 'Longueur totale de câble estimée',
        type: 'number',
        unit: 'ml',
        min: 0,
        step: 1,
        default: 0,
        help: "Saisie manuelle : aucune formule fiable n'existe pour l'estimer.",
      },
      {
        key: 'pointsElectriques',
        type: 'list',
        label: 'Points électriques',
        addLabel: 'Ajouter un point',
        itemLabel: 'Point',
        min: 1,
        default: [{ typeCircuit: 'eclairage', typePoint: 'point_lumineux', modePose: 'apparent' }],
        itemFields: [
          {
            key: 'typeCircuit',
            label: 'Type de circuit',
            type: 'select',
            default: 'eclairage',
            options: [
              { value: 'eclairage', label: 'Éclairage' },
              { value: 'prise_courante', label: 'Prise courante' },
              { value: 'prise_specialisee', label: 'Prise spécialisée' },
            ],
          },
          {
            key: 'typePoint',
            label: 'Type de point',
            type: 'select',
            default: 'point_lumineux',
            options: [
              { value: 'prise_simple', label: 'Prise simple' },
              { value: 'point_lumineux', label: 'Point lumineux' },
              { value: 'interrupteur', label: 'Interrupteur' },
            ],
          },
          {
            key: 'modePose',
            label: 'Mode de pose',
            type: 'select',
            default: 'apparent',
            options: [
              { value: 'apparent', label: 'Apparent' },
              { value: 'encastre', label: 'Encastré' },
              { value: 'goulotte', label: 'Goulotte' },
            ],
          },
        ],
      },
    ],
    lines: [
      { designation: 'Câble électrique 2,5mm²', quantity: 15, unit: 'ml', lineType: 'material' },
      { designation: "Boîte d'encastrement simple", quantity: 5, unit: 'unité', lineType: 'material' },
      { designation: 'Gaine ICTA 20mm', quantity: 15, unit: 'ml', lineType: 'material' },
      { designation: 'Connecteurs Wago', quantity: 15, unit: 'unité', lineType: 'material' },
      { designation: "Main d'œuvre installation", quantity: 5, unit: 'heure', lineType: 'labor' },
    ],
  },
  {
    id: 'carreleur-salle-de-bain-8m2',
    domain: 'Tiling',
    title: 'Carrelage — pose de carreaux',
    /**
     * Modele auto-calcule : au lieu d'inserer directement `lines`, le frontend
     * affiche d'abord ce formulaire, puis appelle
     * POST /api/quotes/templates/:id/compute (services/quoteCalculators.js).
     * `lines` reste present comme repli et comme apercu dans la galerie.
     *
     * Un modele sans bloc `parameters` garde le comportement d'origine :
     * selection -> insertion directe de ses lignes figees.
     */
    parameters: [
      {
        key: 'surface',
        label: 'Surface à carreler',
        type: 'number',
        unit: 'm²',
        min: 0.1,
        step: 0.1,
        default: 8,
      },
      {
        key: 'formatCarreau',
        label: 'Format du carreau',
        type: 'select',
        default: 'petit',
        help: 'Les grands formats imposent un double encollage.',
        options: [
          { value: 'petit', label: 'Moins de 60 cm' },
          { value: 'grand', label: '60 cm et plus' },
        ],
      },
      {
        key: 'typePose',
        label: 'Type de pose',
        type: 'select',
        default: 'droite',
        help: 'Determine le pourcentage de chute en coupe.',
        options: [
          { value: 'droite', label: 'Droite' },
          { value: 'diagonale', label: 'Diagonale' },
          { value: 'chevrons', label: 'Chevrons' },
        ],
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        default: 'sol',
        options: [
          { value: 'sol', label: 'Sol' },
          { value: 'mur', label: 'Mur' },
        ],
      },
      {
        key: 'etatSupport',
        label: 'Etat du support',
        type: 'select',
        default: 'plan',
        help: 'Un support plan ne genere pas de ligne de ragreage.',
        options: [
          { value: 'plan', label: 'Plan' },
          { value: 'a_ragreer', label: 'À ragréer' },
        ],
      },
    ],
    lines: [
      { designation: 'Carreaux céramique 30×30', quantity: 8.8, unit: 'm²', lineType: 'material' },
      { designation: 'Colle carrelage C1 25kg', quantity: 2, unit: 'sac', lineType: 'material' },
      { designation: 'Joint de carrelage 5kg', quantity: 1, unit: 'sac', lineType: 'material' },
      { designation: 'Croisillons 2mm', quantity: 1, unit: 'sachet', lineType: 'material' },
      { designation: "Main d'œuvre pose carrelage", quantity: 8, unit: 'm²', lineType: 'labor' },
    ],
  },
  {
    id: 'peintre-piece-25m2',
    domain: 'Painting',
    title: 'Peinture intérieure',
    /**
     * Modele auto-calcule, meme mecanique que le carreleur.
     *
     * `showIf` masque un champ tant que la condition n'est pas remplie : le
     * changement de couleur ne veut rien dire sur un chantier neuf.
     */
    parameters: [
      {
        /**
         * Les murs se saisissent un par un, comme les points d'eau en
         * plomberie. Un seul nombre obligeait l'artisan a faire l'addition
         * dans sa tete et a la refaire entierement des qu'un mur changeait ;
         * le detail, lui, se relit et se corrige mur par mur.
         *
         * Chaque mur se donne au choix en surface, ou en longueur multipliee
         * par une hauteur — c'est la forme sous laquelle un plan les porte.
         */
        key: 'murs',
        type: 'list',
        label: 'Murs à peindre',
        addLabel: 'Ajouter un mur',
        itemLabel: 'Mur',
        // Le nom de chaque mur est saisi par l'artisan : lui seul connait
        // l'orientation sur place. Deduire une gauche et une droite des
        // cotations serait exactement l'inference geometrique qu'on refuse
        // partout ailleurs dans cette fonctionnalite.
        itemNameKey: 'nom',
        min: 1,
        default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
        itemFields: [
          {
            key: 'nom',
            label: 'Nom du mur',
            type: 'text',
            default: '',
          },
          {
            key: 'mode',
            label: 'Saisie',
            type: 'select',
            default: 'surface',
            options: [
              { value: 'surface', label: 'Surface (m²)' },
              { value: 'longueur', label: 'Longueur × hauteur' },
            ],
          },
          {
            key: 'surfaceM2',
            label: 'Surface du mur',
            type: 'number',
            unit: 'm²',
            min: 0,
            step: 0.1,
            default: 0,
            showIf: { key: 'mode', equals: 'surface' },
            // Basculer de « longueur x hauteur » vers « m² » conserve la
            // valeur : 3,56 ml sous 2,50 m donnent bien 8,9 m².
            derivedFrom: { multiply: ['longueurM', 'hauteurM'] },
          },
          {
            key: 'longueurM',
            label: 'Longueur',
            type: 'number',
            unit: 'ml',
            min: 0,
            step: 0.1,
            default: 0,
            showIf: { key: 'mode', equals: 'longueur' },
            // Et retour : 8,9 m² sous 2,50 m redonnent 3,56 ml. `hauteurM`
            // reste masque en mode surface, donc sa valeur est intacte.
            derivedFrom: { divide: ['surfaceM2', 'hauteurM'] },
          },
          {
            key: 'hauteurM',
            label: 'Hauteur sous plafond',
            type: 'number',
            unit: 'ml',
            min: 0,
            step: 0.05,
            default: 2.5,
            showIf: { key: 'mode', equals: 'longueur' },
          },
        ],
      },
      {
        key: 'surfacePlafond',
        label: 'Surface du plafond',
        type: 'number',
        unit: 'm²',
        min: 0,
        step: 0.1,
        default: 0,
        help: 'Laissez 0 si le plafond n\'est pas peint.',
      },
      {
        key: 'etatSupport',
        label: 'État du support',
        type: 'select',
        default: 'bon',
        help: 'Détermine la quantité d\'enduit de rebouchage.',
        options: [
          { value: 'bon', label: 'Bon' },
          { value: 'moyen', label: 'Moyen' },
          { value: 'mauvais', label: 'Mauvais' },
        ],
      },
      {
        key: 'contexte',
        label: 'Contexte',
        type: 'select',
        default: 'renovation',
        help: 'Le neuf demande un apprêt fixateur, la rénovation un ponçage.',
        options: [
          { value: 'neuf', label: 'Neuf' },
          { value: 'renovation', label: 'Rénovation' },
        ],
      },
      {
        key: 'typeFinition',
        label: 'Type de finition',
        type: 'select',
        default: 'mat',
        options: [
          { value: 'mat', label: 'Mat' },
          { value: 'satine', label: 'Satiné' },
          { value: 'brillant', label: 'Brillant' },
        ],
      },
      {
        key: 'changementCouleur',
        label: 'Changement de couleur radical',
        type: 'select',
        default: 'non',
        help: 'Ajoute une sous-couche opacifiante.',
        showIf: { key: 'contexte', equals: 'renovation' },
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' },
        ],
      },
    ],
    lines: [
      { designation: 'Peinture murale blanche 15L', quantity: 2, unit: 'bidon', lineType: 'material' },
      { designation: 'Apprêt fixateur 5L', quantity: 1, unit: 'bidon', lineType: 'material' },
      { designation: 'Enduit de rebouchage 5kg', quantity: 1, unit: 'sac', lineType: 'material' },
      { designation: 'Rouleau + bac + manchon', quantity: 1, unit: 'kit', lineType: 'material' },
      { designation: "Main d'œuvre peinture", quantity: 25, unit: 'm²', lineType: 'labor' },
    ],
  },
  {
    id: 'plombier-3-points-eau',
    domain: 'Plumbing',
    title: "Installation plomberie — points d'eau",
    /**
     * Modele auto-calcule a STRUCTURE DE LISTE, contrairement au carreleur et
     * au peintre qui exposent un formulaire a plat.
     *
     * `type: 'list'` decrit une liste d'elements repetables : l'artisan clique
     * « Ajouter un point » autant de fois qu'il en faut, et chaque element rend
     * le sous-formulaire decrit par `itemFields`. Ces sous-champs reprennent
     * exactement le meme vocabulaire de descripteur que les champs de premier
     * niveau, `showIf` compris — evalue dans ce cas sur les valeurs de
     * l'element, pas sur celles du formulaire.
     *
     * Une liste ne contient que des champs scalaires : jamais une autre liste.
     *
     * Le reseau amont (compteur, vanne, nourrice) n'est pas un parametre : il
     * est inconditionnel, et la nourrice se deduit du nombre de points.
     *
     * Les `value` des sous-types doivent rester alignees sur les cles de
     * RECETTE_BASE (quoteCalculationFactors.Plumbing) — un test le verifie.
     */
    parameters: [
      {
        key: 'pointsEau',
        type: 'list',
        label: "Points d'eau",
        addLabel: 'Ajouter un point',
        itemLabel: 'Point',
        min: 1,
        default: [{ sousType: 'lavabo', modePose: 'apparent', distanceMl: 0 }],
        itemFields: [
          {
            key: 'sousType',
            label: 'Type de point',
            type: 'select',
            default: 'lavabo',
            options: [
              { value: 'point_simple', label: 'Point simple (robinet, lave-linge)' },
              { value: 'lavabo', label: 'Lavabo' },
              { value: 'evier', label: 'Évier' },
              { value: 'wc', label: 'WC' },
              { value: 'douche_receveur', label: 'Douche receveur' },
              { value: 'douche_italienne', label: "Douche à l'italienne" },
              { value: 'baignoire', label: 'Baignoire' },
            ],
          },
          {
            key: 'modePose',
            label: 'Mode de pose',
            type: 'select',
            default: 'apparent',
            help: "L'encastré double la main d'œuvre et ajoute une saignée.",
            options: [
              { value: 'apparent', label: 'Apparent' },
              { value: 'encastre', label: 'Encastré' },
            ],
          },
          {
            key: 'distanceMl',
            label: 'Distance de saignée',
            type: 'number',
            unit: 'ml',
            min: 0,
            step: 0.5,
            default: 0,
            help: 'Devient directement la quantité de la ligne saignée.',
            showIf: { key: 'modePose', equals: 'encastre' },
          },
        ],
      },
    ],
    lines: [
      { designation: 'Tube cuivre 14/16mm', quantity: 9, unit: 'ml', lineType: 'material' },
      { designation: 'Raccords à compression', quantity: 15, unit: 'unité', lineType: 'material' },
      { designation: "Robinet d'arrêt 1/4 tour", quantity: 3, unit: 'unité', lineType: 'material' },
      { designation: 'Joint téflon 12m', quantity: 3, unit: 'rouleau', lineType: 'material' },
      { designation: "Main d'œuvre installation point d'eau", quantity: 3, unit: 'unité', lineType: 'labor' },
    ],
  },
];

/**
 * Modeles prets a etre envoyes au client : chaque ligne recoit un prix unitaire
 * et un total a 0, que l'artisan completera dans le formulaire.
 * @returns {Array}
 */
function listQuoteTemplates() {
  return QUOTE_TEMPLATES.map((template) => ({
    ...template,
    lines: template.lines.map((line) => ({ ...line, unitPrice: 0, total: 0 })),
  }));
}

module.exports = {
  QUOTE_UNITS,
  QUOTE_LINE_TYPES,
  QUOTE_TEMPLATES,
  listQuoteTemplates,
};
