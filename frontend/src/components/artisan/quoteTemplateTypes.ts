/**
 * Types partages des modeles de devis.
 *
 * Ils vivent a part pour une raison precise : la galerie decrit un modele
 * (donc ses `parameters`) et le formulaire de parametres decrit un modele
 * (donc son `QuoteTemplate`). Les laisser chacun dans son composant creait une
 * dependance circulaire entre les deux fichiers — invisible au build de
 * production, mais fatale en developpement, ou le graphe de modules ESM natif
 * ne tolere pas qu'un module lise les exports d'un autre encore en cours de
 * chargement.
 *
 * Aucun composant ici, aucun import de composant : ce module est une feuille
 * du graphe, il ne peut donc participer a aucun cycle.
 */

// ── Lignes d'un modele ───────────────────────────────────────────────────────

export interface QuoteTemplateLine {
  designation: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineType: 'labor' | 'material';
  total: number;
}

// ── Champs du formulaire de parametres ───────────────────────────────────────

export interface QuoteTemplateParamOption {
  value: string;
  label: string;
}

/**
 * Comment retrouver la valeur d'un champ a partir de ses voisins.
 *
 * Sert aux champs qui expriment la MEME grandeur sous deux formes : une
 * surface de mur se donne en m², ou en longueur multipliee par une hauteur.
 * Quand l'artisan bascule de l'une a l'autre, la valeur doit suivre.
 */
export interface QuoteTemplateDerivation {
  /** Produit des champs cites. */
  multiply?: string[];
  /** Quotient du premier champ par le second. */
  divide?: [string, string];
}

export interface QuoteTemplateParam {
  key: string;
  label: string;
  type: 'number' | 'select' | 'list' | 'text';
  default: string | number | ItemValues[];
  unit?: string;
  min?: number;
  step?: number;
  help?: string;
  options?: QuoteTemplateParamOption[];
  /**
   * Rend ce champ conditionnel a la valeur d'un autre : il n'apparait que si
   * `values[key] === equals`. Sert aux parametres qui n'ont de sens que dans
   * certains cas (le changement de couleur ne veut rien dire sur du neuf).
   *
   * Dans un `itemFields`, la condition est evaluee sur les valeurs de
   * l'ELEMENT, pas sur celles du formulaire.
   */
  showIf?: { key: string; equals: string };
  /**
   * Valeur equivalente, calculee a partir des champs voisins au moment ou ce
   * champ devient visible et qu'il est encore vide. Un champ deja renseigne
   * n'est jamais ecrase.
   */
  derivedFrom?: QuoteTemplateDerivation;

  // ── Propres au type 'list' ─────────────────────────────────────────────────
  /**
   * Sous-formulaire rendu pour chaque element. Ces descripteurs utilisent
   * exactement le meme vocabulaire que les champs de premier niveau.
   *
   * Volontairement limite a des champs scalaires : une liste ne contient jamais
   * une autre liste, faute de quoi le composant devient un moteur de formulaire
   * recursif.
   */
  itemFields?: QuoteTemplateParam[];
  /** Libelle du bouton d'ajout. */
  addLabel?: string;
  /** Prefixe du titre de chaque element, numerote : « Point 1 », « Point 2 »… */
  itemLabel?: string;
  /**
   * Sous-champ qui porte le nom de l'element. Quand il est declare, l'en-tete
   * de chaque element devient ce champ, editable, au lieu du libelle numerote.
   *
   * Le nom sert a s'y retrouver, pas au calcul : il n'est pas envoye au
   * backend. Il vit dans l'element, donc il suit son mur a la suppression
   * comme au reordonnancement.
   */
  itemNameKey?: string;
}

/** Valeurs d'un element de liste : un scalaire par sous-champ. */
export type ItemValues = Record<string, string>;

/** Une valeur de formulaire est soit un scalaire, soit une liste d'elements. */
export type ParamValue = string | ItemValues[];

// ── Le modele lui-meme ───────────────────────────────────────────────────────

export interface QuoteTemplate {
  id: string;
  domain: string;
  title: string;
  lines: QuoteTemplateLine[];
  /**
   * Present uniquement sur les modeles auto-calcules : decrit le formulaire de
   * parametres a afficher avant de remplir le tableau.
   * Absent => le modele insere directement ses lignes figees.
   */
  parameters?: QuoteTemplateParam[];
}

// ── Pre-remplissage ──────────────────────────────────────────────────────────

/**
 * Valeur de depart d'un champ, avec de quoi la verifier.
 *
 * Volontairement agnostique : le formulaire ignore d'ou vient la valeur. Il
 * affiche un nombre et l'indice qui l'accompagne, quelle qu'en soit l'origine.
 * L'appelant est seul responsable de ce qu'il fournit.
 */
export interface PrefilledField {
  /**
   * Nombre pour un champ scalaire ; tableau d'elements pour un parametre
   * `type: 'list'`, auquel cas chaque element est pose tel quel dans la liste.
   */
  value: number | Array<Record<string, string | number>>;
  /** Justification montree a l'artisan pour qu'il puisse controler. */
  hint?: string;
}
