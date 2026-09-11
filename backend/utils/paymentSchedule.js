/**
 * paymentSchedule.js — BMP.tn
 * ───────────────────────────
 * Echeancier de paiement d'un devis : N tranches librement nommees, chacune
 * calculee depuis le total du devis.
 *
 * Les montants sont TOUJOURS recalcules ici, cote serveur : ceux envoyes par le
 * client sont ignores, comme pour les lignes de devis.
 */

const TRANCHE_TYPES = ['fixed', 'percent', 'percentOfRemaining', 'remaining'];

/** Tolerance d'arrondi : deux montants a moins d'un centime sont equivalents. */
const BALANCE_TOLERANCE = 0.01;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Calcule le montant de chaque tranche, dans l'ordre.
 *
 * Le reste disponible diminue au fil des tranches : `percentOfRemaining` et
 * `remaining` s'appuient sur ce qu'il reste A LEUR POSITION, ce qui rend
 * l'echeancier lisible de haut en bas.
 *
 * @param {Array} schedule
 * @param {number} total montant total du devis
 * @returns {{ tranches: Array, sum: number, isBalanced: boolean }}
 */
function computePaymentSchedule(schedule, total) {
  const safeTotal = Math.max(round2(total), 0);
  const list = Array.isArray(schedule) ? schedule : [];

  let consumed = 0;
  const tranches = list.map((tranche) => {
    const remaining = Math.max(round2(safeTotal - consumed), 0);
    const value = Number(tranche?.value) || 0;
    let amount = 0;

    switch (tranche?.type) {
      case 'fixed':
        amount = value;
        break;
      case 'percent':
        amount = (safeTotal * value) / 100;
        break;
      case 'percentOfRemaining':
        amount = (remaining * value) / 100;
        break;
      case 'remaining':
        // Absorbe l'ecart : c'est ce qui garantit un echeancier toujours equilibre.
        amount = remaining;
        break;
      default:
        amount = 0;
    }

    amount = Math.max(round2(amount), 0);
    consumed = round2(consumed + amount);

    return {
      label: String(tranche?.label || '').trim(),
      type: tranche?.type,
      value: tranche?.type === 'remaining' ? 0 : value,
      amount,
      percentage: safeTotal > 0 ? round2((amount / safeTotal) * 100) : 0,
    };
  });

  const sum = round2(tranches.reduce((acc, t) => acc + t.amount, 0));

  return {
    tranches,
    sum,
    isBalanced: Math.abs(sum - safeTotal) <= BALANCE_TOLERANCE,
  };
}

module.exports = {
  TRANCHE_TYPES,
  BALANCE_TOLERANCE,
  computePaymentSchedule,
};
