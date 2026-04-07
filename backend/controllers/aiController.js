/**
 * aiController.js — BMP.tn
 * ──────────────────────────────────────────────────────────────────────────────
 * Contrôleur pour les fonctionnalités d'IA locale.
 *
 * Routes exposées :
 *   POST /api/ai/project-autofill
 */

const { extractProjectData } = require('../services/aiService');
const axios = require('axios');
const Invoice = require('../models/Invoice');

const BMP_BOT_SYSTEM_PROMPT = `Tu es Bmp-Bot, l assistant intelligent de bmp.tn pour artisans, experts et fabricants.

Objectif principal:
- Aider l utilisateur de maniere professionnelle, claire et actionnable.
- Comprendre le contexte metier (chantier, devis, factures, commandes, navigation).
- Toujours repondre a la question, meme si le profil est incomplet.

Style de reponse:
- Francais clair, ton professionnel, logique et efficace.
- Reponses detaillees, structurees en etapes numerotees quand utile.
- Eviter les phrases trop courtes ou vagues.
- Donner des actions concretes et une prochaine etape recommandee.`;

const safeText = (value) => (typeof value === 'string' ? value.trim() : '');

const getCompletionFields = (user) => {
  const role = safeText(user?.role) || 'artisan';

  if (role === 'expert') {
    return [
      { weight: 10, ok: Boolean(safeText(user?.firstName) && safeText(user?.lastName)) },
      { weight: 5, ok: Boolean(safeText(user?.email)) },
      { weight: 15, ok: Boolean(safeText(user?.profilePhoto)) },
      { weight: 10, ok: Boolean(safeText(user?.phone)) },
      { weight: 15, ok: Boolean(safeText(user?.location)) },
      { weight: 15, ok: Boolean(safeText(user?.bio)) },
      { weight: 15, ok: Boolean(safeText(user?.domain) || safeText(user?.specialization)) },
      { weight: 15, ok: Boolean(safeText(user?.institution)) },
    ];
  }

  if (role === 'manufacturer') {
    return [
      { weight: 10, ok: Boolean(safeText(user?.firstName) && safeText(user?.lastName)) },
      { weight: 5, ok: Boolean(safeText(user?.email)) },
      { weight: 10, ok: Boolean(safeText(user?.profilePhoto)) },
      { weight: 15, ok: Boolean(safeText(user?.companyName)) },
      { weight: 10, ok: Boolean(safeText(user?.phone)) },
      { weight: 15, ok: Boolean(safeText(user?.location)) },
      { weight: 20, ok: Boolean(safeText(user?.description)) },
      { weight: 15, ok: Boolean(safeText(user?.certificationNumber)) },
    ];
  }

  return [
    { weight: 10, ok: Boolean(safeText(user?.firstName) && safeText(user?.lastName)) },
    { weight: 5, ok: Boolean(safeText(user?.email)) },
    { weight: 15, ok: Boolean(safeText(user?.profilePhoto)) },
    { weight: 10, ok: Boolean(safeText(user?.phone)) },
    { weight: 15, ok: Boolean(safeText(user?.location)) },
    { weight: 15, ok: Boolean(safeText(user?.bio)) },
    { weight: 15, ok: Boolean(safeText(user?.domain) || safeText(user?.specialization)) },
    { weight: 10, ok: Number.isFinite(Number(user?.yearsExperience)) && Number(user?.yearsExperience) > 0 },
    { weight: 5, ok: Array.isArray(user?.skills) && user.skills.length > 0 },
  ];
};

const computeProfileCompletion = (user) => {
  const fields = getCompletionFields(user);
  return fields.reduce((score, field) => score + (field.ok ? field.weight : 0), 0);
};

const compactInvoiceSummary = (invoices) => {
  const list = Array.isArray(invoices) ? invoices : [];
  const summary = {
    total: list.length,
    paid: 0,
    pending: 0,
    overdue: 0,
    pendingAmountTnd: 0,
    overdueAmountTnd: 0,
    latest: [],
  };

  list.forEach((invoice) => {
    const amount = Number(invoice?.amount || 0);
    const status = safeText(invoice?.status) || 'pending';

    if (status === 'paid') summary.paid += 1;
    if (status === 'pending') {
      summary.pending += 1;
      summary.pendingAmountTnd += Number.isFinite(amount) ? amount : 0;
    }
    if (status === 'overdue') {
      summary.overdue += 1;
      summary.overdueAmountTnd += Number.isFinite(amount) ? amount : 0;
    }
  });

  summary.latest = list.slice(0, 5).map((invoice) => ({
    invoiceNumber: safeText(invoice?.invoiceNumber) || String(invoice?._id || '').slice(-6),
    status: safeText(invoice?.status) || 'pending',
    amount: Number(invoice?.amount || 0),
    dueDate: invoice?.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : null,
  }));

  return summary;
};

const normalizeHistory = (rawHistory) => {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((entry) => {
      const role = safeText(entry?.role).toLowerCase() === 'assistant' ? 'assistant' : 'user';
      const text = safeText(entry?.text);
      if (!text) return null;
      return {
        role,
        text: text.length > 500 ? `${text.slice(0, 500)}...` : text,
      };
    })
    .filter(Boolean)
    .slice(-10);
};

const parseOpenAIResult = (payload) => {
  const choice = payload?.choices?.[0] || {};
  const content = choice?.message?.content;

  let text = '';
  if (typeof content === 'string') {
    text = content.trim();
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }

  return {
    text,
    finishReason: safeText(choice?.finish_reason).toLowerCase(),
  };
};

const callOpenAIChat = async ({ apiKey, model, messages, temperature, maxTokens }) => {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const { data } = await axios.post(endpoint, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 35000,
  });

  return parseOpenAIResult(data);
};

const looksCut = ({ text, finishReason }) => {
  const clean = safeText(text);
  if (!clean) return false;
  if (finishReason === 'length') return true;
  if (clean.length < 120) return false;
  return !/[.!?)]$/.test(clean);
};

const buildRecoveryReply = ({ firstName, message }) => {
  const lower = safeText(message).toLowerCase();

  const asksExpert = /expert|experts|architect|ingenieur|consultant|annuaire/.test(lower);
  const asksChoose = /chois|chosi|selection|comparer|compare|trouv|recherch|meilleur/.test(lower);
  const asksContact = /contact|contacter|message|messagerie|chat|appel|telephone|tel|email/.test(lower);

  if (asksExpert && asksChoose) {
    return [
      `Bonjour ${firstName}, voici une methode professionnelle pour choisir les bons experts:`,
      '1) Definir votre besoin exact: type de projet, domaine (structure, architecture, fluides, etc.), budget et delai cible.',
      '2) Faire une preselection de 3 a 5 experts selon specialite, zone geographique et disponibilite.',
      '3) Evaluer chaque profil avec une grille simple: competence technique (40%), reactivite (20%), references/avis (20%), adequation budget-delai (20%).',
      '4) Comparer des preuves concretes: projets similaires, qualite des echanges, clarte des recommandations et niveau de detail.',
      '5) Garder 2 experts finalistes et leur envoyer le meme brief pour comparer objectivement leurs reponses.',
      '6) Choisir l expert qui propose la meilleure solution technique realiste, pas seulement le prix le plus bas.',
      'Si vous voulez, je peux vous preparer maintenant une grille de comparaison prete a copier-coller.',
    ].join('\n');
  }

  if (asksExpert && asksContact) {
    return [
      `Bonjour ${firstName}, pour contacter un expert rapidement et efficacement:`,
      '1) Ouvrir son profil expert depuis la recherche/annuaire (ou depuis vos recommandations).',
      '2) Cliquer sur l action de contact (message/contacter). Si non visible, passer par le menu Messages et creer une nouvelle conversation.',
      '3) Envoyer un brief court et complet: type de projet, localisation, budget, delai, et niveau d urgence.',
      '4) Poser 4 questions cles: disponibilite, delai estimatif, methode de travail, cout indicatif.',
      '5) Demander une reponse structuree en etapes pour comparer facilement plusieurs experts.',
      'Modele de premier message:',
      '"Bonjour, j ai un projet [type] a [ville], budget ~[montant], delai [date]. Pouvez-vous me proposer une approche en etapes avec estimation de delai et de cout ?"',
    ].join('\n');
  }

  if (asksExpert) {
    return [
      `Bonjour ${firstName}, je peux vous aider sur les experts de maniere tres concrete.`,
      'Donnez-moi votre objectif precise: "choisir un expert", "contacter un expert", ou "comparer plusieurs experts", et je vous donne un plan detaille immediat.',
    ].join('\n');
  }

  if (/projet|construction|chantier|maison/.test(lower)) {
    return [
      `Bonjour ${firstName}, voici un plan professionnel pour demarrer votre projet de construction:`,
      '1) Definir clairement le besoin: surface, niveau de finition, budget, delai et priorites.',
      '2) Creer le projet dans BMP avec un titre precis, la localisation et une description technique complete.',
      '3) Decouper le chantier en lots: gros oeuvre, second oeuvre, finitions, fournitures et main-d oeuvre.',
      '4) Etablir un devis detaille poste par poste, avec marge, TVA et conditions de paiement.',
      '5) Planifier les phases d execution avec jalons hebdomadaires, suivi qualite et gestion des risques.',
      '6) Suivre factures, depenses et avancee reelle pour garder la rentabilite du chantier.',
      'Si vous voulez, je peux maintenant vous donner un exemple de devis maison en TND, pret a adapter.',
    ].join('\n');
  }

  if (/devis|quote/.test(lower)) {
    return [
      `Bonjour ${firstName}, voici une methode professionnelle pour un devis fiable:`,
      '1) Definir le perimetre exact des travaux et les exclusions.',
      '2) Calculer quantites, materiaux, main-d oeuvre, transport et location materiel.',
      '3) Ajouter frais indirects, marge, TVA et conditions commerciales.',
      '4) Inclure delai d execution, modalites de paiement et validite du devis.',
      'Je peux vous preparer un modele de devis detaille en format chantier.',
    ].join('\n');
  }

  if (/facture|invoice|paiement/.test(lower)) {
    return [
      `Bonjour ${firstName}, pour gerer vos factures efficacement:`,
      '1) Prioriser les echeances proches et les factures en retard.',
      '2) Identifier les montants critiques pour la tresorerie.',
      '3) Organiser un plan de paiement et de relance client.',
      '4) Mettre a jour le suivi chaque semaine pour anticiper les tensions de cash.',
      'Je peux vous proposer un plan de priorites immediat selon vos factures.',
    ].join('\n');
  }

  return [
    `Bonjour ${firstName}, je suis la pour vous aider de facon professionnelle.`,
    'Expliquez votre objectif principal (projet, devis, factures, commandes ou navigation BMP) et je vous donnerai un plan d action detaille.',
  ].join('\n');
};

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

// ── POST /api/ai/copilot-chat ────────────────────────────────────────────────
const copilotChat = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const quickAction = typeof body.quickAction === 'string' ? body.quickAction.trim() : '';
    const context = body.context && typeof body.context === 'object' ? body.context : {};
    const history = normalizeHistory(body.history);

    if (!message) {
      return res.status(400).json({ message: 'Le champ "message" est obligatoire.' });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        message: 'Configuration IA manquante: ajoutez OPENAI_API_KEY dans backend/.env.',
      });
    }

    const model = safeText(process.env.OPENAI_MODEL) || 'gpt-4o-mini';

    const role = safeText(req.user?.role) || safeText(context.role) || 'artisan';
    const firstName = safeText(req.user?.firstName) || 'Utilisateur';
    const lastName = safeText(req.user?.lastName);
    const fullName = `${firstName} ${lastName}`.trim();
    const currentView = safeText(context.currentView) || 'home';
    const profileCompletion = computeProfileCompletion(req.user || {});
    const subscriptionStatus = safeText(req.user?.subscription?.status) || 'inactive';

    let invoiceSummary = null;
    if (role === 'artisan' && (quickAction === 'check-invoices' || /facture|invoice|paiement/i.test(message))) {
      const invoices = await Invoice.find({ artisan: req.user?._id })
        .select('invoiceNumber amount status dueDate createdAt')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
      invoiceSummary = compactInvoiceSummary(invoices);
    }

    const roleHint =
      role === 'artisan'
        ? 'Utilisateur artisan: priorite a la gestion chantier, devis, factures, execution et rentabilite.'
        : role === 'expert'
          ? 'Utilisateur expert: priorite a la bibliotheque technique, collaboration artisans et conseil professionnel.'
          : 'Utilisateur fabricant: priorite a la gestion produits, commandes, stock et delais de livraison.';

    const profileHint =
      profileCompletion < 100
        ? 'Le profil n est pas complet. Suggere des ameliorations de profil de maniere optionnelle, sans bloquer la reponse principale.'
        : 'Le profil est complet. Aller directement a une reponse metier detaillee.';

    const systemPrompt = [
      BMP_BOT_SYSTEM_PROMPT,
      `Contexte utilisateur: nom=${fullName || firstName}, role=${role}, vue=${currentView}, profil=${profileCompletion}%, abonnement=${subscriptionStatus}.`,
      roleHint,
      profileHint,
      'Toujours fournir une reponse structuree et assez developpee pour etre directement exploitable.',
    ].join('\n\n');

    const userPrompt = [
      `Question utilisateur: ${message}`,
      `Contexte: vue=${currentView}, actionRapide=${quickAction || 'none'}`,
      invoiceSummary ? `Contexte factures API: ${JSON.stringify(invoiceSummary)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((entry) => ({ role: entry.role, content: entry.text })),
      { role: 'user', content: userPrompt },
    ];

    const first = await callOpenAIChat({
      apiKey,
      model,
      messages,
      temperature: 0.65,
      maxTokens: 900,
    });

    let reply = first.text;
    let finishReason = first.finishReason;
    let continued = false;

    if (looksCut(first)) {
      continued = true;
      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: safeText(reply) || 'Je continue.' },
        { role: 'user', content: 'Continue la reponse precedente sans repetition, termine clairement et ajoute une prochaine etape pratique.' },
      ];

      const second = await callOpenAIChat({
        apiKey,
        model,
        messages: continuationMessages,
        temperature: 0.55,
        maxTokens: 600,
      });

      if (safeText(second.text)) {
        reply = [safeText(reply), safeText(second.text)].filter(Boolean).join('\n');
      }
      finishReason = second.finishReason || finishReason;
    }

    if (!safeText(reply)) {
      reply = buildRecoveryReply({ firstName, message });
    }

    if (looksCut({ text: reply, finishReason })) {
      reply = buildRecoveryReply({ firstName, message });
    }

    return res.status(200).json({
      reply,
      meta: {
        provider: 'openai',
        model,
        finishReason: finishReason || null,
        profileCompletion,
        subscriptionStatus,
        continued,
      },
      invoiceSummary,
    });
  } catch (error) {
    console.error('[aiController] copilotChat error:', error?.response?.data || error?.message || error);

    const firstName = safeText(req.user?.firstName) || 'Utilisateur';
    const message = safeText(req.body?.message);

    return res.status(200).json({
      reply: buildRecoveryReply({ firstName, message }),
      meta: { fallback: true, provider: 'resilience' },
    });
  }
};

module.exports = { projectAutofill, copilotChat };
