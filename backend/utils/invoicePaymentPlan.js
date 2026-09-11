/**
 * invoicePaymentPlan.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Echeancier d'une FACTURE, a N tranches.
 *
 * Le devis acceptait deja un nombre libre de tranches (voir paymentSchedule.js).
 * La facture, elle, ne connaissait que `firstTranche*` et `secondTranche*` : un
 * devis en 30/40/30 y devenait une facture 30/70, la tranche du milieu
 * disparaissant a la conversion, sans erreur ni trace.
 *
 * La source de verite est desormais `paymentPlan.tranches`. Les champs
 * historiques sont CONSERVES en miroir, en lecture seule, le temps que le PDF
 * et l'ecran des factures soient repris — les vider casserait leur affichage.
 *
 * La reprise des factures deja en base se fait A LA LECTURE, sans script
 * prealable : `normalizePaymentPlan` reconstruit le tableau depuis les anciens
 * champs quand il est absent. Un script de rattrapage existe pour figer la
 * conversion en base, mais l'application n'en depend pas.
 */

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** Libelles donnes aux deux tranches d'une facture reprise. */
const MIGRATION_LABELS = ['Acompte', 'Solde'];

/** Repartition historique par defaut du schema Mongoose. */
const LEGACY_DEFAULT_PERCENT = 50;

/**
 * Reconstruit un tableau de tranches depuis les champs historiques.
 *
 * On ne redistribue rien : une facture reprise garde exactement la repartition
 * et l'etat de paiement qu'elle avait. Le defaut 50/50 n'est applique que
 * lorsque le plan est vide, parce que c'est ce que le schema appliquait deja
 * implicitement.
 */
function buildTranchesFromLegacy(legacy, amount, options = {}) {
  const plan = legacy && typeof legacy === 'object' ? legacy : {};
  const total = Math.max(roundMoney(amount), 0);
  /**
   * Repli historique : une facture pouvait etre `status: 'paid'` sans qu'aucun
   * drapeau de tranche ne soit leve. On le traduit ICI, au moment de la
   * reprise, plutot que de laisser `normalizePaymentPlan` consulter le statut
   * a chaque lecture — sans quoi annuler un marquage rendrait la facture
   * instantanement « payee » a nouveau.
   */
  const toutRegle = Boolean(options.fullyPaid);

  const premierPourcent = Number.isFinite(Number(plan.firstTranchePercent))
    ? Number(plan.firstTranchePercent)
    : LEGACY_DEFAULT_PERCENT;
  const secondPourcent = Number.isFinite(Number(plan.secondTranchePercent))
    ? Number(plan.secondTranchePercent)
    : 100 - premierPourcent;

  const premierMontant = Number.isFinite(Number(plan.firstTrancheAmount)) && Number(plan.firstTrancheAmount) > 0
    ? roundMoney(plan.firstTrancheAmount)
    : roundMoney((total * premierPourcent) / 100);

  return [
    {
      label: MIGRATION_LABELS[0],
      percent: premierPourcent,
      amount: premierMontant,
      paid: Boolean(plan.firstTranchePaid) || toutRegle,
      paidAt: plan.firstTranchePaidAt || null,
      dueDate: null,
    },
    {
      label: MIGRATION_LABELS[1],
      percent: secondPourcent,
      amount: roundMoney(total - premierMontant),
      paid: Boolean(plan.secondTranchePaid) || toutRegle,
      paidAt: plan.secondTranchePaidAt || null,
      dueDate: plan.secondTrancheDueDate || null,
    },
  ];
}

/**
 * Met le plan de paiement en etat : tableau present, montants recalcules,
 * `paidAmount` et progression deduits des tranches reellement reglees.
 *
 * Les montants sont TOUJOURS recalcules ici, comme pour l'echeancier du devis :
 * ce qui arrive du client n'est jamais cru sur parole.
 */
function normalizePaymentPlan(invoice) {
  if (!invoice.paymentPlan) invoice.paymentPlan = {};
  const plan = invoice.paymentPlan;
  const total = Math.max(roundMoney(invoice.amount), 0);

  // Reprise a la lecture : une facture d'avant la bascule n'a pas de tableau.
  if (!Array.isArray(plan.tranches) || plan.tranches.length === 0) {
    plan.tranches = buildTranchesFromLegacy(plan, total, {
      fullyPaid: invoice.status === 'paid',
    });
  }

  // La derniere tranche absorbe l'ecart d'arrondi : sans ca, trois tranches a
  // 33,33 % ne totaliseraient pas le montant de la facture.
  let consomme = 0;
  plan.tranches = plan.tranches.map((tranche, index) => {
    const dernier = index === plan.tranches.length - 1;
    const percent = Number(tranche?.percent) || 0;
    const amount = dernier
      ? roundMoney(total - consomme)
      : roundMoney((total * percent) / 100);
    consomme = roundMoney(consomme + amount);

    return {
      label: String(tranche?.label || `Tranche ${index + 1}`).trim(),
      percent,
      amount: Math.max(amount, 0),
      paid: Boolean(tranche?.paid),
      paidAt: tranche?.paidAt || null,
      dueDate: tranche?.dueDate || null,
    };
  });

  /**
   * Les tranches font foi, sans exception. Un compteur incremente a part finit
   * par deriver, et surtout : annuler un marquage doit rendre l'argent. Le cas
   * « facture payee sans drapeau » a deja ete traduit a la reprise.
   */
  invoice.paidAmount = roundMoney(
    plan.tranches.filter((t) => t.paid).reduce((acc, t) => acc + t.amount, 0)
  );

  invoice.paymentProgress = total > 0
    ? Math.min(100, Math.round((Number(invoice.paidAmount || 0) / total) * 100))
    : 0;

  return plan.tranches;
}

/**
 * Recopie l'etat dans les champs historiques, pour les lecteurs pas encore
 * repris — le PDF de facture et l'ecran des factures.
 *
 * `secondTranche*` y represente TOUT ce qui suit la premiere tranche : c'est la
 * seule projection honnete d'un echeancier a N tranches sur un lecteur qui n'en
 * connait que deux. Elle n'est jamais relue comme source.
 */
function mirrorLegacyFields(invoice) {
  const tranches = invoice?.paymentPlan?.tranches;
  if (!Array.isArray(tranches) || tranches.length === 0) return;

  const plan = invoice.paymentPlan;
  const [premiere, ...suivantes] = tranches;

  plan.firstTranchePercent = premiere.percent;
  plan.firstTrancheAmount = premiere.amount;
  plan.firstTranchePaid = premiere.paid;
  plan.firstTranchePaidAt = premiere.paidAt || null;

  const resteMontant = roundMoney(suivantes.reduce((acc, t) => acc + t.amount, 0));
  plan.secondTranchePercent = roundMoney(suivantes.reduce((acc, t) => acc + t.percent, 0));
  plan.secondTrancheAmount = resteMontant;
  // « Payé » ne vaut que si TOUT le reste l'est : annoncer le solde regle alors
  // qu'une tranche court encore serait faux.
  plan.secondTranchePaid = suivantes.length > 0 && suivantes.every((t) => t.paid);
  plan.secondTranchePaidAt = suivantes.length > 0
    ? (suivantes[suivantes.length - 1].paidAt || null)
    : null;
  plan.secondTrancheDueDate = suivantes.length > 0 ? (suivantes[0].dueDate || null) : null;
}

/**
 * Dit si une tranche peut etre reglee maintenant.
 *
 * Le sequencement est la regle metier : une tranche ne s'ouvre que lorsque la
 * precedente est encaissee. C'est la generalisation du « Upfront tranche must
 * be paid first » a N tranches.
 *
 * @returns {{ok: true} | {ok: false, message: string}}
 */
function canSettleTranche(invoice, index) {
  const tranches = invoice?.paymentPlan?.tranches;
  if (!Array.isArray(tranches) || tranches.length === 0) {
    return { ok: false, message: 'Cette facture n\'a pas d\'échéancier.' };
  }

  // `Number(null)` vaut 0 : sans ce filtre, une absence de rang passerait pour
  // la premiere tranche et ouvrirait un reglement que personne n'a demande.
  const rang = index === null || index === undefined || index === '' ? NaN : Number(index);
  if (!Number.isInteger(rang) || rang < 0 || rang >= tranches.length) {
    return { ok: false, message: `Tranche inconnue : la facture en compte ${tranches.length}.` };
  }

  if (tranches[rang].paid) {
    return { ok: false, message: `La tranche ${rang + 1} est déjà réglée.` };
  }

  const precedenteNonReglee = tranches.slice(0, rang).findIndex((t) => !t.paid);
  if (precedenteNonReglee !== -1) {
    return {
      ok: false,
      message: `La tranche ${precedenteNonReglee + 1} doit être réglée avant la tranche ${rang + 1}.`,
    };
  }

  return { ok: true };
}

/**
 * Retrouve la tranche visee par une requete.
 *
 * `trancheIndex` est la forme nouvelle. `phase` reste acceptee pour les appels
 * existants : `upfront` designe la premiere tranche, `completion` la derniere —
 * c'est ce que ces mots ont toujours voulu dire.
 */
function resolveTrancheIndex(invoice, body) {
  const tranches = invoice?.paymentPlan?.tranches;
  if (!Array.isArray(tranches) || tranches.length === 0) return -1;

  const brut = body && body.trancheIndex;
  if (brut !== undefined && brut !== null && brut !== '') {
    const rang = Number(brut);
    return Number.isInteger(rang) && rang >= 0 && rang < tranches.length ? rang : -1;
  }

  const phase = String((body && body.phase) || '').trim();
  if (phase === 'upfront') return 0;
  if (phase === 'completion') return tranches.length - 1;
  return -1;
}

module.exports = {
  MIGRATION_LABELS,
  LEGACY_DEFAULT_PERCENT,
  roundMoney,
  buildTranchesFromLegacy,
  normalizePaymentPlan,
  mirrorLegacyFields,
  canSettleTranche,
  resolveTrancheIndex,
};
