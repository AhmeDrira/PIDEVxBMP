/**
 * Échéancier de paiement d'un devis — calcul côté client, pour l'affichage vivant
 * dans le formulaire.
 *
 * ⚠️ Source de vérité : backend/utils/paymentSchedule.js. Le serveur RECALCULE
 * systématiquement les montants et refuse un échéancier déséquilibré ; ce module
 * doit rester aligné sur lui, sinon l'artisan verra des montants différents de
 * ceux enregistrés.
 */

export type TrancheType = 'fixed' | 'percent' | 'percentOfRemaining' | 'remaining';

export interface PaymentTranche {
  label: string;
  type: TrancheType;
  value: number;
  amount: number;
  percentage: number;
}

export const TRANCHE_TYPES: TrancheType[] = ['fixed', 'percent', 'percentOfRemaining', 'remaining'];

/** Tolérance d'arrondi : deux montants à moins d'un centime sont équivalents. */
export const BALANCE_TOLERANCE = 0.01;

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Calcule le montant de chaque tranche, dans l'ordre. Le reste disponible
 * diminue au fil des tranches : `percentOfRemaining` et `remaining` s'appuient
 * sur ce qu'il reste à leur position.
 */
export function computePaymentSchedule(
  schedule: Array<Partial<PaymentTranche>>,
  total: number
): { tranches: PaymentTranche[]; sum: number; isBalanced: boolean } {
  const safeTotal = Math.max(round2(total), 0);
  let consumed = 0;

  const tranches = (schedule || []).map((tranche) => {
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
        amount = remaining;
        break;
      default:
        amount = 0;
    }

    amount = Math.max(round2(amount), 0);
    consumed = round2(consumed + amount);

    return {
      label: String(tranche?.label || ''),
      type: (tranche?.type || 'percent') as TrancheType,
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

/** Échéancier par défaut : reproduit visuellement l'ancien comportement. */
export const defaultPaymentSchedule = (): Array<Pick<PaymentTranche, 'label' | 'type' | 'value'>> => [
  { label: 'Acompte', type: 'percent', value: 50 },
  { label: 'Solde à la livraison', type: 'remaining', value: 0 },
];
