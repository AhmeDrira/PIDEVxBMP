const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * planReaderService.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Lecture des cotations ECRITES sur un plan, pour pre-remplir le formulaire de
 * parametres d'un modele metier.
 *
 * ⚠ CE SERVICE LIT, IL NE MESURE PAS. Le modele recopie le texte deja present
 * sur le plan (surfaces indiquees, cotes chiffrees, libelles de pieces). Il ne
 * doit jamais deduire une surface de la geometrie du dessin, ni compter des
 * ouvertures a l'oeil. Cette limite vient d'une etude comparative : la lecture
 * de texte atteint ~95 % de justesse sur les modeles actuels, la mesure
 * geometrique visuelle tombe a 34-51 % — inexploitable pour un devis.
 *
 * Deux etapes distinctes, volontairement separees :
 *   - `readPlan` lit le fichier. C'est le SEUL appel au modele, donc le seul
 *     poste payant. Il ne connait aucun metier : au moment de l'import,
 *     l'artisan n'a pas encore choisi le sien.
 *   - `mapReading` projette cette lecture sur les champs d'un modele metier.
 *     Aucun appel a l'IA : mapping deterministe et garde-fou, instantanes et
 *     gratuits. Changer de metier ne relit donc jamais le plan.
 *
 * Trois garde-fous, dans cet ordre :
 *   1. Plancher de resolution. Sous le seuil, le modele invente des valeurs
 *      plausibles SANS le signaler. Mesure sur banc : parfait de 320 a 1400 px
 *      de large sur un plan aere, effondrement a 260 px avec des chiffres faux
 *      stables et un champ `illisible` vide. Le plancher par defaut est
 *      desormais a 300 px, DANS cet intervalle de decrochage : c'est un choix
 *      produit, pas une marge de securite. Voir le commentaire de
 *      DEFAULT_MIN_IMAGE_LONG_SIDE avant d'y toucher.
 *   2. Verification de source. Toute valeur dont le chiffre ne figure pas dans
 *      le `texte_source` cense l'avoir produite est rejetee, sans exception.
 *      Comparer le texte source a la liste des textes sources ne prouverait
 *      rien — ils viennent de la meme reponse. On confronte le NOMBRE au TEXTE.
 *   3. Mapping deterministe. C'est le serveur, pas le modele, qui decide quel
 *      champ du formulaire recoit quelle valeur.
 */

/**
 * Plus petit cote long accepte, en pixels.
 * En dessous, on refuse plutot que de risquer une hallucination silencieuse.
 *
 * ⚠ 300 PX EST UNE DECISION PRODUIT ASSUMEE, PAS UNE MARGE DE SECURITE.
 * A LIRE AVANT DE TOUCHER A CETTE VALEUR.
 *
 * Ce que le banc de degradation synthetique a mesure :
 *   - de 1400 a 320 px de large : 6 valeurs lues sur 6, sans erreur ;
 *   - a 260 px : DECROCHAGE. Le modele n'echoue pas, il INVENTE. Surfaces
 *     plausibles mais fausses (SEJOUR 16 au lieu de 18,5 ; CHAMBRE 10,2 au
 *     lieu de 14,25), identiques sur trois passages a temperature 0, et
 *     `illisible` reste vide. Rien, dans la reponse, ne signale le probleme.
 *
 * Le decrochage se situe donc quelque part ENTRE 260 ET 320 PX, sans qu'on
 * sache ou exactement. A 300 px on se place a l'interieur de cet intervalle,
 * a une trentaine de pixels d'un regime ou le service ment en silence — la
 * ou 1000 puis 700 px laissaient une marge large.
 *
 * Trois precisions qui aggravent le risque plutot qu'elles ne le reduisent :
 *   - la mesure a ete prise sur un plan de synthese propre et aere ; une
 *     photo de chantier prise de travers, avec des cotes serrees, decrochera
 *     bien plus tot ;
 *   - le seuil s'applique au PLUS GRAND cote : une image de 300x200 est
 *     acceptee alors qu'elle porte tres peu de pixels utiles ;
 *   - le garde-fou de source (le chiffre doit figurer dans son texte_source)
 *     ne rattrape PAS ce cas : le modele hallucine le texte source en meme
 *     temps que la valeur, de facon coherente.
 *
 * Autrement dit : sous ce plancher, une lecture fausse ne se voit pas.
 * Descendre en dessous de 300 demande une nouvelle mesure et un accord
 * explicite ; le supprimer (0, ou desactiver le controle) n'est pas une
 * option — une image illisible doit continuer d'etre refusee.
 *
 * Reglable par PLAN_MIN_RESOLUTION_PX, sans redeploiement : remonter a 700 ou
 * 1000 se fait en une variable et un redemarrage.
 *
 * Une valeur illisible est ignoree plutot que propagee : `Number('haut')`
 * donnerait NaN, et toute comparaison avec NaN etant fausse, le plancher
 * disparaitrait en silence — exactement le genre de panne qu'il sert a eviter.
 */
const DEFAULT_MIN_IMAGE_LONG_SIDE = 300;

const readMinLongSide = () => {
  const brut = Number(process.env.PLAN_MIN_RESOLUTION_PX);
  return Number.isFinite(brut) && brut > 0 ? brut : DEFAULT_MIN_IMAGE_LONG_SIDE;
};

const MIN_IMAGE_LONG_SIDE = readMinLongSide();

/** Types acceptes. Le DWG est exclu : voir le rapport d'exploration. */
const ACCEPTED_MIMETYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * Modeles essayes dans l'ordre, comme le fait deja services/geminiService.js.
 *
 * Un modele unique en dur ne tient pas : Google retire des versions sans
 * preavis — `gemini-2.0-flash` renvoie desormais un 404 « no longer available »
 * — et le quota gratuit est compte PAR MODELE. Basculer sur le suivant ressert
 * donc a la fois en cas de retrait et en cas de quota atteint.
 */
const MODEL_CANDIDATES = Array.from(new Set([
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-3.6-flash',
].filter(Boolean)));

/**
 * Budget de sortie. Large a dessein : les modeles recents consomment des
 * jetons de raisonnement AVANT d'ecrire leur reponse. A 4096, la lecture d'un
 * plan a beaucoup de pieces se faisait tronquer (`finishReason: MAX_TOKENS`)
 * et le JSON arrivait incomplet.
 */
const MAX_OUTPUT_TOKENS = 16384;

const isModelGone = (error) => /not found|no longer available|is not supported/i.test(String(error && error.message));
const isQuotaError = (error) => /429|quota|rate limit|resource_exhausted/i.test(String(error && error.message));

/**
 * Champs de formulaire alimentables par une surface de piece lue sur le plan.
 *
 * Volontairement limite : seuls les champs `number` en m² y figurent. Les
 * `select` (type de pose, etat du support, contexte neuf/renovation) restent
 * exclus — un plan ne les ecrit pas, les proposer reviendrait a deviner.
 *
 * Les murs sont absents a dessein : une surface de murs ne se deduit pas d'une
 * surface au sol sans hauteur ni perimetre. Ils passent par PERIMETER_TARGETS,
 * qui produit une ESTIMATION explicitement etiquetee comme telle, jamais une
 * valeur presentee comme lue.
 */
const SURFACE_TARGETS = {
  'carreleur-salle-de-bain-8m2': [
    {
      champ: 'surface',
      unite: 'm²',
      note: 'Surface au sol lue sur le plan',
    },
  ],
  'peintre-piece-25m2': [
    {
      champ: 'surfacePlafond',
      unite: 'm²',
      // Un plafond couvre la meme surface que le sol : ce n'est pas une mesure
      // du dessin, c'est la surface ecrite, reportee telle quelle.
      note: 'Surface au sol lue sur le plan — un plafond couvre la même surface',
    },
  ],
};

/**
 * Champs deduits d'un perimetre, par metier.
 *
 * A la difference de SURFACE_TARGETS, la valeur n'est PAS lue : elle est
 * calculee a partir de deux cotes que le modele a rattachees a la piece. C'est
 * une estimation, et elle doit se presenter comme telle jusqu'au formulaire.
 */
const PERIMETER_TARGETS = {
  'peintre-piece-25m2': {
    champ: 'murs',
    mention: 'Estimation avant déduction des portes et fenêtres, '
      + 'pièce supposée rectangulaire — à vérifier et ajuster.',
  },
};

const PROMPT = `Tu lis un plan de bâtiment, possiblement photographié ou scanné.

RÈGLE ABSOLUE : tu ne dois RIEN mesurer, RIEN estimer, RIEN déduire de la
géométrie du dessin. Tu recopies UNIQUEMENT le texte déjà écrit sur le plan :
cotations chiffrées, libellés de pièces, surfaces indiquées. Ne compte pas les
portes ni les fenêtres. Ne calcule aucune surface à partir des traits.

Si une valeur n'est pas lisible noir sur blanc, tu ne l'inventes pas : tu
l'omets et tu la décris dans "illisible".

Les champs "texte_source_*" doivent contenir EXACTEMENT le texte tel qu'il
apparaît sur le plan, sans reformulation.

Réponds en JSON strict, sans texte autour :
{
  "pieces": [{
    "libelle": "...",
    "surface_m2": nombre|null,
    "texte_source_surface": "...",
    "longueur_m": nombre|null,
    "largeur_m": nombre|null,
    "texte_source_dimensions": "..."|null
  }],
  "cotations": [{ "valeur": nombre, "unite": "m", "texte_source": "..." }],
  "hauteur_sous_plafond": { "valeur_m": nombre, "texte_source": "..." },
  "illisible": ["description de ce que tu n'arrives pas à lire"]
}

"hauteur_sous_plafond" ne se remplit QUE si le plan porte une mention explicite
du type « Hauteur sous plafond 2,50 m » ou « HSP 2,50 ». Sinon, mets null. Ne
la déduis jamais d'autre chose.

"longueur_m" et "largeur_m" ne se remplissent QUE si DEUX cotations chiffrées
sont écrites juste à côté de cette pièce et se rapportent visiblement à elle
— typiquement une cote horizontale et une cote verticale bordant ses murs.
Recopie-les dans "texte_source_dimensions" telles qu'elles sont écrites.

Dans TOUS les autres cas, mets les trois champs à null :
- si les cotations sont regroupées ailleurs sur le plan sans rattachement clair ;
- si tu n'en vois qu'une seule ;
- si tu devrais raisonner sur le dessin pour décider à quelle pièce elles vont.

Ne rattache jamais une cotation à une pièce « par élimination » ou parce que
le produit des deux tomberait juste. Dans le doute, null.`;

// ── Garde-fou 1 : resolution ─────────────────────────────────────────────────

/**
 * Verifie qu'une image est assez definie pour etre lue sans risque.
 *
 * Un PDF n'est pas controle : sharp ne sait pas le lire, et un PDF de plan est
 * vectoriel ou contient une image deja haute definition. Le risque
 * d'hallucination par manque de pixels ne s'y pose pas de la meme facon.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{width: number, height: number}|null>} null pour un PDF
 * @throws {Error} si l'image est trop petite ou illisible
 */
async function assertReadableResolution(buffer, mimeType) {
  if (mimeType === 'application/pdf') return null;

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    throw new Error("L'image n'a pas pu être lue.");
  }

  const { width, height } = metadata;
  if (!width || !height) {
    throw new Error("Les dimensions de l'image n'ont pas pu être déterminées.");
  }

  const longSide = Math.max(width, height);
  if (longSide < MIN_IMAGE_LONG_SIDE) {
    const err = new Error(
      `Image trop petite (${width}×${height} px). `
      + `Il faut au moins ${MIN_IMAGE_LONG_SIDE} px sur le plus grand côté : `
      + `en dessous, les cotations deviennent illisibles et le résultat n'est pas fiable. `
      + `Reprenez la photo de plus près, ou envoyez le PDF d'origine — `
      + `plus l'image est nette, plus la lecture est sûre.`
    );
    err.code = 'PLAN_RESOLUTION_TOO_LOW';
    throw err;
  }

  return { width, height };
}

// ── Appel du modele ──────────────────────────────────────────────────────────

/** Nettoie les cloture markdown que le modele ajoute en API v1. */
function parseJsonFromText(text) {
  let clean = String(text || '').trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Le modèle n'a pas renvoyé de JSON exploitable.");
    return JSON.parse(match[0]);
  }
}

/**
 * Interroge le modele vision et renvoie la lecture brute.
 * @returns {Promise<object>} { pieces, cotations, illisible }
 */
async function readPlanText(buffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY/GOOGLE_API_KEY manquante dans les variables d\'environnement.');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const apiVersion = process.env.GEMINI_API_VERSION || 'v1';

  let result = null;
  let derniereErreur = null;
  let quotaPartout = true;

  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel(
      {
        model: modelName,
        // Temperature nulle : on veut une transcription, pas de la creativite.
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
      },
      { apiVersion }
    );

    try {
      result = await model.generateContent([
        PROMPT,
        { inlineData: { mimeType, data: buffer.toString('base64') } },
      ]);
      break;
    } catch (error) {
      derniereErreur = error;
      if (!isQuotaError(error)) quotaPartout = false;
      // Modele retire ou quota atteint : le suivant a son propre quota.
      if (isModelGone(error) || isQuotaError(error)) continue;
      throw error;
    }
  }

  if (!result) {
    if (quotaPartout) {
      // Message destine a l'artisan : le palier gratuit est de 20 lectures par
      // jour et par modele. Ce n'est ni son plan ni une panne.
      const err = new Error(
        'La limite quotidienne de lecture de plans est atteinte. '
        + 'Réessayez demain, ou saisissez les valeurs à la main.'
      );
      err.code = 'GEMINI_QUOTA_EXHAUSTED';
      throw err;
    }
    throw derniereErreur || new Error('Aucun modèle de lecture disponible.');
  }

  // Une reponse tronquee produit du JSON invalide : on le dit clairement.
  const finishReason = result.response.candidates
    && result.response.candidates[0]
    && result.response.candidates[0].finishReason;
  if (finishReason === 'MAX_TOKENS') {
    const err = new Error(
      'Le plan comporte trop de texte pour être lu en une fois. '
      + 'Essayez de le recadrer sur la zone qui vous intéresse.'
    );
    err.code = 'PLAN_TOO_DENSE';
    throw err;
  }

  const parsed = parseJsonFromText(result.response.text());

  return {
    pieces: Array.isArray(parsed?.pieces) ? parsed.pieces : [],
    cotations: Array.isArray(parsed?.cotations) ? parsed.cotations : [],
    hauteurSousPlafond: parseHauteurSousPlafond(parsed?.hauteur_sous_plafond),
    illisible: Array.isArray(parsed?.illisible) ? parsed.illisible : [],
  };
}

/**
 * Valide la hauteur sous plafond lue.
 *
 * Elle passe par le MEME garde-fou que les surfaces : son chiffre doit figurer
 * dans le texte cense l'avoir produite. Sans ca, elle serait le seul champ du
 * contrat sans verification — et donc le seul endroit ou une hallucination
 * pourrait passer.
 *
 * @returns {{valeurM: number, texteSource: string}|null}
 */
function parseHauteurSousPlafond(brut) {
  if (!brut || typeof brut !== 'object') return null;

  const valeur = Number(brut.valeur_m);
  const texteSource = String(brut.texte_source || '');

  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  // « HSP 250 cm » vaut 2,50 m : c'est une longueur, pas un chiffre nu.
  if (!isLengthBackedBySource(valeur, texteSource)) return null;

  return { valeurM: valeur, texteSource };
}

// ── Garde-fou 2 : la valeur doit figurer dans son texte source ───────────────

/**
 * Nombres presents dans un texte, virgule decimale francaise comprise.
 *
 * Les suffixes d'unite sont retires AVANT extraction : sans ca, le « 2 » de
 * « m2 » passerait pour un nombre lu, et une surface de 2 m² serait validee
 * par n'importe quel texte.
 */
function extractNumbers(texte) {
  const sansUnites = String(texte || '')
    .replace(/m\s*(2|²)/gi, ' ')
    .replace(/\bml\b/gi, ' ');

  const trouves = sansUnites.match(/\d+(?:[.,]\d+)?/g) || [];
  return trouves
    .map((brut) => Number(brut.replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

/**
 * Verifie qu'une valeur proposee figure REELLEMENT dans le texte dont le
 * modele pretend l'avoir tiree.
 *
 * C'est le coeur du garde-fou, et il ne doit surtout pas etre tautologique :
 * comparer le texte source a la liste des textes sources ne prouve rien, ils
 * viennent de la meme reponse. On confronte ici le NOMBRE au TEXTE, deux
 * elements que le modele doit produire de facon coherente.
 *
 * Il attrape les deux defaillances observees au banc d'essai :
 *   - texte source invente : il ne contient pas le nombre ;
 *   - transcription correcte mais chiffre faux (« SEJOUR 18,50 m2 » -> 16),
 *     qui est exactement ce que fait le modele sur une image trop petite.
 *
 * @param {number} valeur
 * @param {string} texteSource
 * @returns {boolean}
 */
function isValueBackedBySource(valeur, texteSource) {
  const cible = Number(valeur);
  if (!Number.isFinite(cible)) return false;

  // Tolerance relative : « 18,50 » et 18.5 sont le meme nombre.
  return extractNumbers(texteSource).some((n) => Math.abs(n - cible) < 0.005);
}

/**
 * Valide les deux cotes de cote rattachees a une piece.
 *
 * Les deux chiffres doivent figurer dans `texte_source_dimensions` : c'est le
 * meme garde-fou que pour les surfaces et la hauteur, applique au seul endroit
 * ou le modele a le droit de rattacher une cotation a une piece.
 *
 * Le tout-ou-rien est deliberé : un perimetre demande les DEUX cotes. Garder
 * une longueur validee et une largeur douteuse produirait un chiffre a moitie
 * verifie, ce qui est pire qu'aucun chiffre — l'artisan ne verrait pas la
 * difference.
 *
 * @returns {{longueurM: number, largeurM: number, texteSource: string}|null}
 */
function parseDimensionsPiece(piece) {
  if (!piece || typeof piece !== 'object') return null;

  const longueurM = Number(piece.longueur_m);
  const largeurM = Number(piece.largeur_m);
  const texteSource = String(piece.texte_source_dimensions || '');

  if (!Number.isFinite(longueurM) || longueurM <= 0) return null;
  if (!Number.isFinite(largeurM) || largeurM <= 0) return null;

  if (!isLengthBackedBySource(longueurM, texteSource)) return null;
  if (!isLengthBackedBySource(largeurM, texteSource)) return null;

  return { longueurM, largeurM, texteSource };
}

/**
 * Estime la surface des murs, piece par piece, a partir des cotes rattachees.
 *
 * Formule : 2 x (longueur + largeur) x hauteur. Elle suppose une piece
 * rectangulaire et ignore portes et fenetres — d'ou la mention qui accompagne
 * obligatoirement le resultat.
 *
 * Sans hauteur lue sur le plan, on ne peut produire qu'un PERIMETRE, en metres
 * lineaires. L'unite le dit (`ml`), et c'est a l'appelant d'en tenir compte :
 * verser 22 ml dans un champ qui attend des m² donnerait un devis faux d'un
 * facteur egal a la hauteur, sans que rien ne le signale.
 *
 * @returns {{champ_cible, unite, estimation, mention, hauteur_utilisee, candidats}|null}
 */
function buildPerimeterEstimation(lecture, templateId) {
  const target = PERIMETER_TARGETS[templateId];
  if (!target) return null;

  const hauteur = lecture.hauteurSousPlafond ? lecture.hauteurSousPlafond.valeurM : null;

  const candidats = [];
  lecture.pieces.forEach((piece, index) => {
    const dimensions = parseDimensionsPiece(piece);
    if (!dimensions) return;

    const perimetre = 2 * (dimensions.longueurM + dimensions.largeurM);
    candidats.push({
      piece_index: index,
      libelle: String((piece && piece.libelle) || '').trim(),
      valeur: Math.round(perimetre * (hauteur || 1) * 100) / 100,
      // Les deux cotes voyagent avec le total : la liste de murs se remplit
      // mur par mur (2 x longueur, 2 x largeur), et non d'un bloc. C'est
      // l'hypothese rectangulaire rendue visible dans les donnees, corrigeable
      // ligne par ligne au lieu d'etre enfouie dans un seul nombre.
      longueur_m: dimensions.longueurM,
      largeur_m: dimensions.largeurM,
      texte_source: dimensions.texteSource,
    });
  });

  if (candidats.length === 0) return null;

  return {
    champ_cible: target.champ,
    unite: hauteur ? 'm²' : 'ml',
    estimation: true,
    mention: target.mention,
    hauteur_utilisee: hauteur,
    candidats,
  };
}

/**
 * Longueurs lues dans un texte, TOUTES converties en metres.
 *
 * Un plan francais cote couramment en centimetres (« 356 cm », « HSP 250 cm »)
 * alors que le contrat de lecture est en metres. Comparer 3,56 au chiffre nu
 * 356 rejetait donc une lecture parfaitement juste : le garde-fou punissait le
 * modele d'avoir bien fait la conversion.
 *
 * On lit donc chaque nombre AVEC son unite et on ramene tout en metres. Le
 * garde-fou reste entier : la valeur proposee doit toujours correspondre a une
 * longueur effectivement ecrite. Ce qui change, c'est qu'on compare des
 * grandeurs et non plus des suites de chiffres.
 *
 * Consequence voulue : une valeur de 356 « m » adossee a « 356 cm » est
 * desormais REJETEE — c'est la meme suite de chiffres, mais pas la meme
 * longueur. L'ancienne version l'acceptait.
 */
function extractLengthsInMetres(texte) {
  const brut = String(texte || '');
  const trouves = [];
  // Nombre, puis unite eventuelle collee ou separee par des espaces.
  const motif = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/gi;

  let m = motif.exec(brut);
  while (m !== null) {
    const valeur = Number(String(m[1]).replace(',', '.'));
    const unite = String(m[2] || '').toLowerCase();
    if (Number.isFinite(valeur)) {
      if (unite === 'cm') trouves.push(valeur / 100);
      else if (unite === 'mm') trouves.push(valeur / 1000);
      else if (unite === 'm') trouves.push(valeur);
      // Sans unite ecrite, on ne sait pas : on retient les deux lectures
      // plausibles sur un plan, le metre et le centimetre.
      else {
        trouves.push(valeur);
        trouves.push(valeur / 100);
      }
    }
    m = motif.exec(brut);
  }

  return trouves;
}

/**
 * Variante de `isValueBackedBySource` pour les LONGUEURS, en metres.
 * Meme exigence, mais sur des grandeurs converties.
 */
function isLengthBackedBySource(valeurM, texteSource) {
  const cible = Number(valeurM);
  if (!Number.isFinite(cible)) return false;
  return extractLengthsInMetres(texteSource).some((n) => Math.abs(n - cible) < 0.005);
}

// ── Garde-fou 3 : mapping deterministe ───────────────────────────────────────

/**
 * Construit les propositions de pre-remplissage pour un modele donne.
 *
 * Chaque champ cible recoit une LISTE de candidats, un par piece lue. Le choix
 * revient a l'artisan : rien n'indique sur un plan quelle piece il compte
 * carreler, et trancher a sa place serait deviner.
 *
 * @param {object} lecture - Sortie de readPlanText
 * @param {string} templateId
 * @returns {{propositions: Array, rejetees: Array}}
 */
function buildPropositions(lecture, templateId) {
  const targets = SURFACE_TARGETS[templateId];
  if (!targets) return { propositions: [], rejetees: [] };

  const rejetees = [];

  const candidatsBruts = lecture.pieces
    .filter((piece) => {
      const surface = Number(piece && piece.surface_m2);
      return Number.isFinite(surface) && surface > 0;
    })
    .map((piece, index) => ({
      piece_index: index,
      valeur: Math.round(Number(piece.surface_m2) * 100) / 100,
      libelle: String(piece.libelle || '').trim(),
      // `texte_source` reste accepte : une lecture faite avant le changement
      // de schema peut encore etre ouverte dans un onglet.
      texte_source: String(piece.texte_source_surface || piece.texte_source || ''),
    }));

  const candidats = candidatsBruts.filter((candidat) => {
    if (isValueBackedBySource(candidat.valeur, candidat.texte_source)) return true;
    rejetees.push({
      ...candidat,
      motif: `la valeur ${candidat.valeur} ne figure pas dans le texte source « ${candidat.texte_source} »`,
    });
    return false;
  });

  if (candidats.length === 0) return { propositions: [], rejetees };

  const propositions = targets.map((target) => ({
    champ_cible: target.champ,
    unite: target.unite,
    note: target.note,
    candidats,
  }));

  return { propositions, rejetees };
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Etape 1 — lit le plan. SEUL appel au modele, donc seul poste payant.
 *
 * Ne connait aucun metier : au moment de l'import, l'artisan n'a pas encore
 * choisi le sien. La projection sur les champs se fait ensuite, hors IA.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<object>} { lecture, dimensions, avertissements }
 * @throws {Error} type non supporte, image trop petite, ou echec du modele
 */
async function readPlan(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Aucun fichier reçu.');
  }
  if (!ACCEPTED_MIMETYPES.includes(mimeType)) {
    const err = new Error('Seuls les formats JPEG, PNG et PDF sont acceptés.');
    err.code = 'PLAN_TYPE_UNSUPPORTED';
    throw err;
  }

  const dimensions = await assertReadableResolution(buffer, mimeType);
  const lecture = await readPlanText(buffer, mimeType);

  const avertissements = [];
  if (lecture.illisible.length > 0) {
    // `illisible` n'est fiable QUE quand il est rempli : le banc d'essai montre
    // qu'il reste vide alors meme que le modele invente des valeurs. On le
    // remonte quand il parle, on n'en conclut rien quand il se tait.
    avertissements.push(
      `Le modèle signale des zones illisibles : ${lecture.illisible.join(' ; ')}`
    );
  }

  return { lecture, dimensions, avertissements };
}

/**
 * Etape 2 — projette une lecture sur les champs d'un modele metier.
 *
 * AUCUN appel a l'IA : mapping deterministe et garde-fou, instantanes et
 * gratuits. L'artisan peut donc changer de metier sans qu'on relise le plan.
 *
 * La lecture transite par le client entre les deux etapes. Ce n'est pas un
 * risque : le garde-fou est reapplique ici, et de toute facon l'artisan peut
 * saisir la valeur qu'il veut a la main dans le formulaire.
 *
 * @param {object} lecture - Sortie de readPlan
 * @param {string} templateId
 * @returns {object} { propositions, rejetees, avertissements }
 */
function mapReading(lecture, templateId) {
  const lectureSaine = {
    pieces: Array.isArray(lecture && lecture.pieces) ? lecture.pieces : [],
    cotations: Array.isArray(lecture && lecture.cotations) ? lecture.cotations : [],
    // La lecture transite par le client : la hauteur est revalidee ici aussi.
    hauteurSousPlafond: parseHauteurSousPlafond(
      lecture && lecture.hauteurSousPlafond
        ? { valeur_m: lecture.hauteurSousPlafond.valeurM, texte_source: lecture.hauteurSousPlafond.texteSource }
        : null
    ),
    illisible: Array.isArray(lecture && lecture.illisible) ? lecture.illisible : [],
  };

  const { propositions, rejetees } = buildPropositions(lectureSaine, templateId);

  const avertissements = [];
  if (rejetees.length > 0) {
    avertissements.push(
      `${rejetees.length} valeur(s) écartée(s) : le chiffre proposé ne figure pas dans le texte lu sur le plan.`
    );
  }
  if (propositions.length === 0) {
    avertissements.push(
      "Aucune surface exploitable n'a été lue sur ce plan. Saisissez les valeurs à la main."
    );
  }

  /**
   * Indication informative pour le peintre. `surfaceMurs` reste manuel : la
   * deduire demanderait le perimetre de la piece, qu'on ne peut pas
   * reconstituer sans raisonnement geometrique — le regime a 34-51 % de
   * justesse. On donne la hauteur, l'artisan fait le calcul qu'il maitrise.
   */
  const indications = [];
  if (lectureSaine.hauteurSousPlafond && SURFACE_TARGETS[templateId]) {
    indications.push({
      champ_cible: 'murs',
      texte: `Hauteur sous plafond indiquée sur le plan : ${lectureSaine.hauteurSousPlafond.valeurM} m`,
      texte_source: lectureSaine.hauteurSousPlafond.texteSource,
    });
  }

  const estimation = buildPerimeterEstimation(lectureSaine, templateId);
  const estimations = estimation ? [estimation] : [];

  /**
   * Faute de cotes rattachees a une piece, on retombe sur l'information brute.
   * Les cotations sont montrees comme repere, sans etre reliees a quoi que ce
   * soit : les recoller a une piece apres coup serait precisement le
   * raisonnement geometrique qu'on s'interdit.
   */
  if (!estimation && PERIMETER_TARGETS[templateId] && lectureSaine.cotations.length > 0) {
    const reperes = lectureSaine.cotations
      .filter((cote) => Number.isFinite(Number(cote && cote.valeur)) && Number(cote.valeur) > 0)
      // Une cotation est une longueur : « 330cm » adosse bien une valeur de
      // 3,3 m. Le comparateur de chiffres nus rejetait ici toutes les cotes
      // d'un plan cote en centimetres, et le repli ne montrait plus rien.
      .filter((cote) => isLengthBackedBySource(Number(cote.valeur), String(cote.texte_source || '')))
      .map((cote) => `${Number(cote.valeur)} ${String(cote.unite || 'm')}`);

    if (reperes.length > 0) {
      indications.push({
        champ_cible: 'murs',
        texte: `Cotations lues sur le plan, sans rattachement à une pièce : ${reperes.join(' · ')}`,
        texte_source: '',
      });
    }
  }

  return { propositions, rejetees, avertissements, indications, estimations };
}

module.exports = {
  readPlan,
  mapReading,
  // Exportes pour les tests : ce sont les garde-fous, ils doivent etre
  // verifiables isolement.
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
  readPlanText,
  MIN_IMAGE_LONG_SIDE,
  DEFAULT_MIN_IMAGE_LONG_SIDE,
  readMinLongSide,
  ACCEPTED_MIMETYPES,
  MODEL_CANDIDATES,
  MAX_OUTPUT_TOKENS,
  SURFACE_TARGETS,
  PERIMETER_TARGETS,
  PROMPT,
};
