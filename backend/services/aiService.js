/**
 * aiService.js — BMP.tn
 * ──────────────────────────────────────────────────────────────────────────────
 * Service d'IA locale basé sur @xenova/transformers.
 *
 * Modèle : Xenova/distilbert-base-cased-distilled-squad
 * Tâche  : question-answering (lecture du contexte fourni par l'artisan)
 *
 * Pattern Singleton : le pipeline est chargé une seule fois au premier appel,
 * puis réutilisé. Le chargement peut prendre 10-30 s à la toute première
 * requête (téléchargement des poids ~80 Mo mis en cache ensuite).
 */

// ── Singleton state ───────────────────────────────────────────────────────────

let _pipeline      = null;  // instance réutilisable une fois chargée
let _loadingPromise = null; // Promise en cours (évite les chargements parallèles)

// ── Questions posées au modèle ────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'title',       question: 'What is the project name?' },
  { key: 'location',    question: 'What is the location or city?' },
  { key: 'description', question: 'What is the description or task?' },
  { key: 'date',        question: 'When does the project start or what is the date?' },
];

// ── Chargement du pipeline (Singleton) ───────────────────────────────────────

/**
 * Retourne le pipeline question-answering, en le chargeant si nécessaire.
 * Les appels concurrents partagent la même Promise de chargement.
 *
 * @returns {Promise<import('@xenova/transformers').QuestionAnsweringPipeline>}
 */
async function getPipeline() {
  // Déjà chargé → retour immédiat
  if (_pipeline) return _pipeline;

  // Chargement en cours → attendre la même Promise
  if (_loadingPromise) return _loadingPromise;

  // Premier appel : lancer le chargement
  _loadingPromise = (async () => {
    console.log('[aiService] Chargement du modèle Xenova/distilbert-base-cased-distilled-squad…');
    const startMs = Date.now();

    // @xenova/transformers est un module ES ; import() dynamique requis en CJS
    const { pipeline } = await import('@xenova/transformers');

    _pipeline = await pipeline(
      'question-answering',
      'Xenova/distilbert-base-cased-distilled-squad'
    );

    console.log(`[aiService] Modèle prêt (${((Date.now() - startMs) / 1000).toFixed(1)} s)`);
    return _pipeline;
  })();

  // En cas d'échec, libérer le verrou pour permettre une nouvelle tentative
  _loadingPromise.catch(() => {
    _loadingPromise = null;
    _pipeline       = null;
  });

  return _loadingPromise;
}

// ── Extraction principale ─────────────────────────────────────────────────────

/**
 * Extrait les données structurées d'un texte libre décrivant un projet.
 *
 * @param {string} text - Texte brut de l'artisan (description libre du projet)
 * @returns {Promise<{
 *   title:       string | null,
 *   location:    string | null,
 *   description: string | null,
 * }>}
 *
 * @example
 * const data = await extractProjectData(
 *   "Je dois rénover la salle de bain de l'appartement situé à Tunis Lac 2. " +
 *   "Le projet s'appelle Rénovation SDB et inclut le carrelage et la plomberie."
 * );
 * // → { title: 'Rénovation SDB', location: 'Tunis Lac 2', description: 'carrelage et la plomberie' }
 */
async function extractProjectData(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Le texte fourni est vide ou invalide.');
  }

  const context = text.trim();
  const pipe    = await getPipeline();

  // Poser les 3 questions en parallèle sur le même contexte.
  // ⚠️  @xenova/transformers attend deux arguments positionnels STRING :
  //       pipe(questionString, contextString)
  // Passer un objet { question, context } comme premier argument fait que le
  // tokeniseur reçoit l'objet entier en guise de texte → "text.split is not a function".
  const rawResults = await Promise.all(
    QUESTIONS.map(({ question }) =>
      pipe(question, context)        // ← deux strings positionnels
        .catch((err) => {
          console.error(`[aiService] Erreur question "${question}" :`, err.message);
          return { answer: null, score: 0 };
        })
    )
  );

  // Retourner les résultats bruts { answer, score } par clé.
  // C'est le contrôleur qui applique le seuil de confiance et décide du null.
  const raw = {};
  QUESTIONS.forEach(({ key }, i) => {
    const { answer, score } = rawResults[i];
    raw[key] = {
      answer: (answer && typeof answer === 'string') ? answer.trim() : null,
      score:  typeof score === 'number' ? score : 0,
    };
  });

  return raw;
}

// ── Pré-chauffage optionnel ───────────────────────────────────────────────────

/**
 * Charge le modèle en avance au démarrage du serveur (warm-up).
 * Appeler dans server.js pour éviter la latence au premier vrai appel.
 * Non bloquant : les erreurs sont loggées mais n'interrompent pas le démarrage.
 */
async function warmUp() {
  try {
    await getPipeline();
  } catch (err) {
    console.warn('[aiService] Pré-chauffage échoué (non bloquant) :', err.message);
  }
}

module.exports = { extractProjectData, warmUp };
