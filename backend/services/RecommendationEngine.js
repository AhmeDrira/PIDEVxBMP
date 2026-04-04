/**
 * RecommendationEngine v4 — BMP.tn B2B scoring engine
 * -----------------------------------------------------
 * PHASE 1 : Filtrage K.O. dans le contrôleur (MongoDB)
 * PHASE 2 : Scoring sur 100 points (5 critères)
 *   COMPATIBILITE SURFACE  = 25 pts fixes (tout produit ayant passé le filtre catégoriel)
 *   BUDGET                 = 0..25  (-2 pts / % au-dessus, 0 si > 12.5 %)
 *   CONTRAINTE TECHNIQUE   = 0..20  (correspondance texte contrainte ↔ produit)
 *   FIABILITE              = 0..15  (10 note + 5 bonus fidélité fabricant)
 *   PDF                    = 0..15  (normes / certifications liées à la contrainte)
 *
 * Bonus de ranking (hors score base /100):
 *   BONUS SEMANTIQUE PRODUIT↔PROJET = +10 max
 *   PENALITE GENERICITE             = -0..2
 *
 * Note : la quantité utilisée en Phase 2 est calculée PAR PRODUIT via
 * conversionFactors.calculateProductQuantity() dans le contrôleur.
 */

// ── Normalisation & tokenisation ─────────────────────────────────────────────

/** Supprime accents, ponctuation, met en minuscule */
function normaliseStr(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenise en mots significatifs (≥ 3 chars) */
function tokenise(str) {
  return normaliseStr(str).split(' ').filter((w) => w.length >= 3);
}

// ── Critère 1 : SCORE_COMPATIBILITE_SURFACE (25 pts fixes) ───────────────────

/**
 * Pour la v1 : tous les produits ayant passé le filtre catégoriel reçoivent
 * le score maximal de compatibilité (25 pts).
 * L'affinement de ce score est prévu dans une version ultérieure.
 *
 * @returns {{ total: number }}
 */
function scoreCompatibiliteSurface() {
  return { total: 25 };
}

// ── Critère 2 : SCORE_BUDGET (0..25) ─────────────────────────────────────────

/**
 * Compare le coût total estimé au budget global.
 *
 * @param {number} price    - Prix unitaire TND
 * @param {number} quantity - Quantité calculée par produit via conversionFactors
 * @param {number} budget   - Budget total TND
 * @returns {{ score: number, withinBudget: boolean|null, overPct: number|null, totalCost: number }}
 */
function scoreBudget(price, quantity, budget) {
  const totalCost = (price || 0) * (quantity || 0);

  if (!budget || budget <= 0) {
    return { score: 12, withinBudget: null, overPct: null, totalCost }; // neutre
  }
  if (!price || !quantity) {
    return { score: 0, withinBudget: false, overPct: null, totalCost };
  }

  if (totalCost <= budget) {
    return { score: 25, withinBudget: true, overPct: 0, totalCost };
  }

  const overPct = ((totalCost / budget) - 1) * 100;
  if (overPct > 12.5) {
    return { score: 0, withinBudget: false, overPct, totalCost };
  }

  // -2 pts par % de dépassement (max 25 pts → 0 à 12.5 % de dépassement)
  const score = Math.max(0, 25 - Math.round(overPct * 2));
  return { score, withinBudget: false, overPct, totalCost };
}

// ── Critère 3 : SCORE_CONTRAINTE_TECHNIQUE (0..20) ───────────────────────────

/**
 * Évalue la correspondance entre la contrainte technique et la fiche produit.
 *
 * @param {object} product    - { name, category, description }
 * @param {string} constraint - Contrainte technique saisie par l'artisan
 * @returns {{ score: number, matchCount: number }}
 */
function scoreContrainteTechnique(product, constraint) {
  if (!constraint || !constraint.trim()) {
    return { score: 0, matchCount: 0 }; // pas de contrainte → critère neutre (0)
  }

  const constraintTokens = tokenise(constraint);
  if (constraintTokens.length === 0) return { score: 0, matchCount: 0 };

  const productText   = [product.name, product.category, product.description].join(' ');
  const productTokens = new Set(tokenise(productText));

  const matchCount = constraintTokens.filter((t) => productTokens.has(t)).length;
  const ratio      = matchCount / constraintTokens.length;
  const score      = Math.min(20, Math.round(ratio * 20));

  return { score, matchCount };
}

// ── Critère 4 : SCORE_FIABILITE (0..15) ──────────────────────────────────────

/**
 * Note (0-10) + bonus de fidélité fabricant (0-5).
 *
 * @param {object} product           - { rating, manufacturer }
 * @param {Set}    purchasedManufIds - Set des IDs fabricants déjà achetés par l'artisan
 * @returns {{ reliability: number, loyaltyBonus: number, total: number }}
 */
function scoreFiabilite(product, purchasedManufIds) {
  const reliability = Math.round(Math.min(1, Math.max(0, (product.rating || 0) / 5)) * 10);

  const manufacturerId = (product.manufacturer || '').toString();
  const loyaltyBonus = purchasedManufIds.size > 0 && manufacturerId && purchasedManufIds.has(manufacturerId) ? 5 : 0;

  return { reliability, loyaltyBonus, total: reliability + loyaltyBonus };
}

// ── Critère 5 : SCORE_PDF (0..15) ────────────────────────────────────────────

/**
 * Vérifie si la fiche technique PDF contient des normes/certifications
 * en lien avec la contrainte technique de l'artisan.
 *
 * @param {object|null} techProfile - Profil extrait par TechSheetAnalyzer
 * @param {boolean}     pdfPresent  - Le produit a-t-il un PDF ?
 * @param {string}      constraint  - Contrainte technique artisan
 * @returns {{ score: number, badges: string[] }}
 */
function scorePdf(techProfile, pdfPresent, constraint) {
  if (!pdfPresent || !techProfile) return { score: 0, badges: [] };

  const allEntities = [
    ...(techProfile.norms         || []),
    ...(techProfile.certifications || []),
    ...(techProfile.safety         || []),
  ];

  if (!allEntities.length) return { score: 0, badges: [] };

  // Score de base selon le nombre d'entités (sature à 15 pour 5+ entités)
  const baseScore = Math.min(15, Math.round((allEntities.length / 5) * 15));

  if (constraint) {
    const constraintTokens = tokenise(constraint);
    if (constraintTokens.length > 0) {
      const profileText = [
        ...allEntities,
        ...(techProfile.resistance  || []),
        ...(techProfile.environment || []),
        ...(techProfile.materials   || []),
        ...(techProfile.keywords    || []),
      ].join(' ');

      const hasMatch = constraintTokens.some((t) => normaliseStr(profileText).includes(t));
      if (!hasMatch) {
        // PDF présent mais ne couvre pas la contrainte → score partiel
        return { score: Math.min(7, baseScore), badges: allEntities.slice(0, 5) };
      }
    }
  }

  return { score: baseScore, badges: allEntities.slice(0, 8) };
}

// ── Bonus de ranking : correspondance semantique produit/projet ────────────

/**
 * @param {object} semanticAnalysis - resultat de productAnalyzer
 * @returns {{ bonus: number, penalty: number, net: number, matchStrength: string, matchCount: number }}
 */
function scoreSemanticProjectMatch(semanticAnalysis = {}) {
  const matchStrength = semanticAnalysis.matchStrength || 'none';
  const matchCount    = Number(semanticAnalysis.matchCount || 0);
  const bonus         = Math.max(0, Number(semanticAnalysis.bonus || 0));
  const penalty       = Math.max(0, Number(semanticAnalysis.penalty || 0));

  return {
    bonus,
    penalty,
    net: bonus - penalty,
    matchStrength,
    matchCount,
  };
}

// ── Génération de justification ───────────────────────────────────────────────

/**
 * Génère une phrase professionnelle expliquant la recommandation.
 */
function generateJustification({ product, scoresDetail, constraint, category, hasPdfBadges, isNonStandard, semanticResult }) {
  const { budget, contrainte, fiabilite } = scoresDetail;
  const parts = [];

  // Compatibilité catégorie (toujours 25/25 en v1)
  parts.push(`Catégorie "${category}" correspondante`);

  // Avertissement produit non standard
  if (isNonStandard) {
    parts.push('quantité estimée (facteur non défini pour ce produit)');
  }

  // Contrainte technique
  if (constraint && contrainte && contrainte.matchCount > 0) {
    parts.push(
      contrainte.score >= 14
        ? `répond parfaitement à votre contrainte "${constraint}"`
        : `correspondance avec votre contrainte "${constraint}"`
    );
  }

  // Budget
  if (budget.withinBudget === true) {
    parts.push('respecte votre budget');
  } else if (budget.overPct !== null && budget.overPct <= 6) {
    parts.push(`légèrement au-dessus du budget (+${budget.overPct.toFixed(1)} %)`);
  } else if (budget.score === 0) {
    parts.push('dépasse significativement le budget');
  }

  // PDF
  if (hasPdfBadges) {
    parts.push('fiche technique avec certifications vérifiées');
  }

  // Note
  if (product.rating >= 4.5) {
    parts.push(`excellente note (${product.rating}/5)`);
  } else if (product.rating >= 4.0) {
    parts.push(`bien noté (${product.rating}/5)`);
  }

  // Fidélité fabricant
  if (fiabilite.loyaltyBonus > 0) {
    parts.push('fabricant déjà acheté (bonus fidélité)');
  }

  // Correspondance semantique produit/projet
  if (semanticResult?.matchStrength === 'strong') {
    parts.push('forte cohérence sémantique avec le projet');
  } else if (semanticResult?.matchStrength === 'weak') {
    parts.push('cohérence sémantique minimale avec le projet');
  }

  if ((semanticResult?.penalty || 0) > 0) {
    parts.push('description produit partiellement générique');
  }

  if (!parts.length) return 'Produit éligible selon vos critères.';

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const rest  = parts.slice(1);
  return first + (rest.length ? ', ' + rest.join(', ') : '') + '.';
}

// ── Scoring global ────────────────────────────────────────────────────────────

/**
 * Calcule le score global d'un produit (5 critères, 100 pts).
 *
 * @param {object} params
 * @param {object}  params.product
 * @param {string}  params.category          - Catégorie sélectionnée
 * @param {string}  params.unit              - Unité sélectionnée
 * @param {string}  params.constraint        - Contrainte technique (optionnel)
 * @param {number}  params.quantity          - Quantité calculée PAR PRODUIT
 * @param {number}  params.budget            - Budget total TND
 * @param {Set}     params.purchasedManufIds
 * @param {object}  params.techProfile
 * @param {boolean} params.pdfPresent
 * @param {boolean} params.isNonStandard     - true si le produit n'a pas de facteur connu
 * @param {object}  params.semanticAnalysis   - resultat de l'analyse produit/projet
 * @returns {{ scores, totalCost, justification, pdfBadges, scoresDetail }}
 */
function computeScore({
  product,
  category,
  unit,
  constraint,
  quantity,
  budget,
  purchasedManufIds,
  techProfile,
  pdfPresent,
  isNonStandard = false,
  semanticAnalysis = null,
}) {
  const compatResult     = scoreCompatibiliteSurface(); // 25 pts fixes en v1
  const budgetResult     = scoreBudget(product.price, quantity, budget);
  const contrainteResult = scoreContrainteTechnique(product, constraint);
  const fiabiliteResult  = scoreFiabilite(product, purchasedManufIds);
  const pdfResult        = scorePdf(techProfile, pdfPresent, constraint);
  const semanticResult   = scoreSemanticProjectMatch(semanticAnalysis || {});

  const baseTotal = compatResult.total + budgetResult.score + contrainteResult.score + fiabiliteResult.total + pdfResult.score;
  const rankingTotal = Math.max(0, baseTotal + semanticResult.net);

  const scores = {
    compatibilite: compatResult.total,
    budget:        budgetResult.score,
    contrainte:    contrainteResult.score,
    fiabilite:     fiabiliteResult.total,
    pdf:           pdfResult.score,
    total:         baseTotal,
    semanticBonus: semanticResult.bonus,
    genericPenalty: semanticResult.penalty,
    rankingTotal,
  };

  const justification = generateJustification({
    product,
    scoresDetail: {
      compat:    compatResult,
      budget:    budgetResult,
      contrainte: contrainteResult,
      fiabilite: fiabiliteResult,
    },
    constraint,
    category,
    hasPdfBadges: pdfResult.badges.length > 0,
    isNonStandard,
    semanticResult,
  });

  return {
    scores,
    totalCost:    budgetResult.totalCost,
    justification,
    pdfBadges:    pdfResult.badges,
    scoresDetail: {
      compat:    compatResult,
      budget:    budgetResult,
      contrainte: contrainteResult,
      fiabilite: fiabiliteResult,
      pdf:       pdfResult,
      semantic:  semanticResult,
    },
  };
}

module.exports = {
  // Phase 2 scoring
  tokenise,
  normaliseStr,
  scoreCompatibiliteSurface,
  scoreBudget,
  scoreContrainteTechnique,
  scoreFiabilite,
  scorePdf,
  scoreSemanticProjectMatch,
  generateJustification,
  computeScore,
};
