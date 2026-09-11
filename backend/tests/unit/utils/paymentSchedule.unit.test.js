const {
  TRANCHE_TYPES,
  BALANCE_TOLERANCE,
  computePaymentSchedule,
} = require('../../../utils/paymentSchedule');

describe('paymentSchedule utility', () => {
  test('exposes the four tranche types', () => {
    expect(TRANCHE_TYPES).toEqual(['fixed', 'percent', 'percentOfRemaining', 'remaining']);
  });

  test('computes a fixed amount as-is', () => {
    const { tranches } = computePaymentSchedule([{ label: 'A', type: 'fixed', value: 250 }], 1000);

    expect(tranches[0].amount).toBe(250);
    expect(tranches[0].percentage).toBe(25);
  });

  test('computes a percentage of the quote total', () => {
    const { tranches } = computePaymentSchedule([{ label: 'A', type: 'percent', value: 30 }], 1000);

    expect(tranches[0].amount).toBe(300);
  });

  test('computes a percentage of what is left at that position', () => {
    // 40% de 1000 = 400, puis 50% des 600 restants = 300.
    const { tranches } = computePaymentSchedule(
      [
        { label: 'A', type: 'percent', value: 40 },
        { label: 'B', type: 'percentOfRemaining', value: 50 },
      ],
      1000
    );

    expect(tranches[0].amount).toBe(400);
    expect(tranches[1].amount).toBe(300);
  });

  test('the remaining tranche absorbs the balance', () => {
    const { tranches, sum, isBalanced } = computePaymentSchedule(
      [
        { label: 'Acompte', type: 'percent', value: 50 },
        { label: 'Intermediaire', type: 'fixed', value: 200 },
        { label: 'Solde', type: 'remaining' },
      ],
      1000
    );

    expect(tranches.map((t) => t.amount)).toEqual([500, 200, 300]);
    expect(sum).toBe(1000);
    expect(isBalanced).toBe(true);
  });

  test('forces the value of a remaining tranche to zero', () => {
    const { tranches } = computePaymentSchedule(
      [{ label: 'Solde', type: 'remaining', value: 999 }],
      1000
    );

    expect(tranches[0].value).toBe(0);
    expect(tranches[0].amount).toBe(1000);
  });

  test('reports an unbalanced schedule when tranches fall short', () => {
    const { sum, isBalanced } = computePaymentSchedule(
      [{ label: 'A', type: 'percent', value: 40 }],
      1000
    );

    expect(sum).toBe(400);
    expect(isBalanced).toBe(false);
  });

  test('reports an unbalanced schedule when tranches overshoot, even with a remaining one', () => {
    // Les deux premieres depassent deja le total : « Solde restant » ne peut pas
    // rattraper un depassement, il vaut alors 0.
    const { tranches, sum, isBalanced } = computePaymentSchedule(
      [
        { label: 'A', type: 'fixed', value: 800 },
        { label: 'B', type: 'fixed', value: 500 },
        { label: 'Solde', type: 'remaining' },
      ],
      1000
    );

    expect(tranches[2].amount).toBe(0);
    expect(sum).toBe(1300);
    expect(isBalanced).toBe(false);
  });

  test('never produces a negative amount', () => {
    const { tranches } = computePaymentSchedule(
      [{ label: 'A', type: 'fixed', value: -50 }],
      1000
    );

    expect(tranches[0].amount).toBe(0);
  });

  test('tolerates rounding differences up to one cent', () => {
    const { isBalanced } = computePaymentSchedule(
      [{ label: 'A', type: 'fixed', value: 999.995 }],
      1000
    );

    expect(BALANCE_TOLERANCE).toBe(0.01);
    expect(isBalanced).toBe(true);
  });

  test('handles a zero total without dividing by zero', () => {
    const { tranches, isBalanced } = computePaymentSchedule(
      [{ label: 'A', type: 'percent', value: 50 }],
      0
    );

    expect(tranches[0].percentage).toBe(0);
    expect(isBalanced).toBe(true);
  });
});
