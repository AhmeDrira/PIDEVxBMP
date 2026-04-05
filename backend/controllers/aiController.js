/**
 * aiController.js — BMP.tn
 * ──────────────────────────────────────────────────────────────────────────────
 * Contrôleur pour les fonctionnalités d'IA locale.
 *
 * Routes exposées :
 *   POST /api/ai/project-autofill
 */

const { extractProjectData } = require('../services/aiService');

// ── POST /api/ai/project-autofill ─────────────────────────────────────────────

/**
 * Reçoit un texte libre décrivant un projet et retourne les champs extraits
 * automatiquement via le modèle DistilBERT (question-answering local).
 *
 * Body :
 *   { text: string }   — Description libre du projet (requis, 10 chars min)
 *
 * Réponse 200 :
 *   {
 *     title:       string | null,   — Nom du projet extrait
 *     location:    string | null,   — Ville / lieu extrait
 *     description: string | null,   — Description / tâche extraite
 *   }
 *
 * Réponses d'erreur :
 *   400  — texte manquant ou trop court
 *   500  — erreur interne du modèle IA
 */
const projectAutofill = async (req, res) => {
  try {
    // ─── Extraction explicite du champ text ──────────────────────────────────
    // req.body doit être un objet JSON parsé par express.json().
    // On isole la propriété "text" avant tout traitement pour s'assurer de
    // ne jamais transmettre un objet au service IA (causerait text.split error).
    const body = req.body;                        // objet parsé par express.json()
    const text = body && typeof body === 'object'  // sécurité si body est undefined
      ? body.text
      : undefined;

    // ─── Validation ───────────────────────────────────────────────────────────

    if (text === undefined || text === null) {
      return res.status(400).json({
        message: 'Le champ "text" est manquant dans le body JSON.',
        hint:    'Envoyez : { "text": "description du projet..." }',
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        message: `Le champ "text" doit être une chaîne de caractères, reçu : ${typeof text}.`,
      });
    }

    const trimmed = text.trim();
    if (trimmed.length < 10) {
      return res.status(400).json({
        message: 'Le texte est trop court. Fournissez au moins 10 caractères pour une extraction fiable.',
        minLength: 10,
        received: trimmed.length,
      });
    }

    // ─── Extraction IA (on passe uniquement la string) ────────────────────────

    // Le service retourne les résultats bruts : { answer: string|null, score: number }
    const raw = await extractProjectData(trimmed);

    // ─── Seuil de confiance : vide OU score < 0.05 → null ────────────────────
    const CONFIDENCE_THRESHOLD = 0.05;

    const resolve = (field) => {
      const result = raw[field];
      if (!result) return null;
      const { answer, score } = result;
      if (!answer || answer.trim() === '') return null;
      if (score < CONFIDENCE_THRESHOLD) return null;
      return answer.trim();
    };

    // ─── Réponse ──────────────────────────────────────────────────────────────

    return res.status(200).json({
      title:       resolve('title'),
      location:    resolve('location'),
      description: resolve('description'),
      date:        resolve('date'),
    });

  } catch (error) {
    console.error('[aiController] projectAutofill error:', error);
    return res.status(500).json({
      message: 'Erreur lors de l\'extraction des données par l\'IA.',
      detail:  error.message,
    });
  }
};

module.exports = { projectAutofill };
