const {
  MIGRATION_LABELS,
  buildTranchesFromLegacy,
  normalizePaymentPlan,
  mirrorLegacyFields,
  canSettleTranche,
  resolveTrancheIndex,
} = require('../../../utils/invoicePaymentPlan');

/**
 * Echeancier d'une FACTURE, a N tranches.
 *
 * Le devis acceptait deja un nombre libre de tranches ; la facture, elle, ne
 * connaissait que `firstTranche*` et `secondTranche*`. Un devis en 30/40/30 y
 * devenait une facture 30/70, la tranche du milieu disparaissant en silence.
 *
 * Ces tests sont ecrits AVANT le modele : ils decrivent le contrat attendu, y
 * compris la reprise des factures deja en base, qui n'ont pas de tableau.
 */

const facture = (over = {}) => ({
  amount: 1000,
  status: 'pending',
  paidAmount: 0,
  paymentPlan: {},
  ...over,
});

describe('buildTranchesFromLegacy — reprise des factures existantes', () => {
  test('turns a legacy two-tranche plan into a tranche array', () => {
    const tranches = buildTranchesFromLegacy({
      firstTranchePercent: 40,
      secondTranchePercent: 60,
      firstTrancheAmount: 400,
      secondTrancheAmount: 600,
      firstTranchePaid: true,
      firstTranchePaidAt: new Date('2026-01-10'),
      secondTranchePaid: false,
      secondTrancheDueDate: new Date('2026-03-01'),
    }, 1000);

    expect(tranches).toHaveLength(2);
    expect(tranches[0]).toMatchObject({ percent: 40, amount: 400, paid: true });
    expect(tranches[1]).toMatchObject({ percent: 60, amount: 600, paid: false });
  });

  test('keeps the payment dates already recorded', () => {
    // Une facture a moitie payee doit rester a moitie payee apres reprise.
    const paidAt = new Date('2026-01-10');
    const tranches = buildTranchesFromLegacy({
      firstTranchePercent: 50, firstTranchePaid: true, firstTranchePaidAt: paidAt,
      secondTranchePaid: false, secondTrancheDueDate: new Date('2026-03-01'),
    }, 1000);

    expect(tranches[0].paidAt).toEqual(paidAt);
    expect(tranches[1].dueDate).toEqual(new Date('2026-03-01'));
  });

  test('names the two tranches so the artisan recognises them', () => {
    const tranches = buildTranchesFromLegacy({ firstTranchePercent: 50 }, 1000);

    expect(tranches.map((t) => t.label)).toEqual(MIGRATION_LABELS);
  });

  test('falls back to 50/50 when the legacy plan is empty', () => {
    // C'est le defaut historique du schema : on ne change pas la repartition
    // d'une facture existante sous pretexte qu'elle etait implicite.
    const tranches = buildTranchesFromLegacy({}, 1000);

    expect(tranches.map((t) => t.percent)).toEqual([50, 50]);
    expect(tranches.map((t) => t.amount)).toEqual([500, 500]);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
  ])('survives a plan that is %s', (_label, plan) => {
    expect(buildTranchesFromLegacy(plan, 1000)).toHaveLength(2);
  });
});

describe('normalizePaymentPlan — N tranches', () => {
  test('keeps three tranches instead of collapsing them to two', () => {
    // Le coeur du correctif : 30/40/30 restait 30/70 auparavant.
    const inv = facture({
      paymentPlan: {
        tranches: [
          { label: 'Acompte', percent: 30 },
          { label: 'Mi-chantier', percent: 40 },
          { label: 'Solde', percent: 30 },
        ],
      },
    });

    normalizePaymentPlan(inv);

    expect(inv.paymentPlan.tranches).toHaveLength(3);
    expect(inv.paymentPlan.tranches.map((t) => t.amount)).toEqual([300, 400, 300]);
  });

  test('lets the last tranche absorb the rounding gap', () => {
    // 3 x 33,333 % de 1000 ne tombe pas rond : le total doit rester exact.
    const inv = facture({
      amount: 1000,
      paymentPlan: {
        tranches: [
          { label: 'T1', percent: 33.33 },
          { label: 'T2', percent: 33.33 },
          { label: 'T3', percent: 33.34 },
        ],
      },
    });

    normalizePaymentPlan(inv);

    const somme = inv.paymentPlan.tranches.reduce((a, t) => a + t.amount, 0);
    expect(Math.round(somme * 100) / 100).toBe(1000);
  });

  test('migrates a legacy invoice on the fly', () => {
    // Une facture deja en base n'a pas de tableau : la reprise se fait a la
    // lecture, sans script prealable.
    const inv = facture({
      paymentPlan: {
        firstTranchePercent: 40,
        secondTranchePercent: 60,
        firstTranchePaid: true,
      },
    });

    normalizePaymentPlan(inv);

    expect(inv.paymentPlan.tranches).toHaveLength(2);
    expect(inv.paymentPlan.tranches[0].paid).toBe(true);
    expect(inv.paymentPlan.tranches[0].amount).toBe(400);
  });

  test('derives paidAmount from the tranches actually settled', () => {
    const inv = facture({
      paymentPlan: {
        tranches: [
          { label: 'T1', percent: 30, paid: true },
          { label: 'T2', percent: 40, paid: true },
          { label: 'T3', percent: 30, paid: false },
        ],
      },
    });

    normalizePaymentPlan(inv);

    expect(inv.paidAmount).toBe(700);
    expect(inv.paymentProgress).toBe(70);
  });

  test('keeps a fully paid invoice at 100 % even without tranche flags', () => {
    // Repli historique : `status: 'paid'` faisait foi.
    const inv = facture({ status: 'paid', paidAmount: 0 });

    normalizePaymentPlan(inv);

    expect(inv.paidAmount).toBe(1000);
    expect(inv.paymentProgress).toBe(100);
  });

  test('handles an invoice with no amount without dividing by zero', () => {
    const inv = facture({ amount: 0 });

    normalizePaymentPlan(inv);

    expect(inv.paymentProgress).toBe(0);
  });
});

describe('mirrorLegacyFields — compatibilite le temps de la bascule', () => {
  test('keeps firstTranche* readable while the UI still uses it', () => {
    // Le PDF et l'ecran des factures lisent encore ces champs : les laisser
    // vides casserait l'affichage avant que l'UI ne soit reprise.
    const inv = facture({
      paymentPlan: {
        tranches: [
          { label: 'Acompte', percent: 30, paid: true },
          { label: 'Mi-chantier', percent: 40 },
          { label: 'Solde', percent: 30 },
        ],
      },
    });

    normalizePaymentPlan(inv);
    mirrorLegacyFields(inv);

    expect(inv.paymentPlan.firstTranchePercent).toBe(30);
    expect(inv.paymentPlan.firstTrancheAmount).toBe(300);
    expect(inv.paymentPlan.firstTranchePaid).toBe(true);
    // Tout ce qui suit la premiere tranche, vu par un lecteur a deux tranches.
    expect(inv.paymentPlan.secondTranchePercent).toBe(70);
    expect(inv.paymentPlan.secondTrancheAmount).toBe(700);
    expect(inv.paymentPlan.secondTranchePaid).toBe(false);
  });

  test('reports the legacy second tranche as paid only when everything after the first is', () => {
    const inv = facture({
      paymentPlan: {
        tranches: [
          { label: 'T1', percent: 30, paid: true },
          { label: 'T2', percent: 40, paid: true },
          { label: 'T3', percent: 30, paid: true },
        ],
      },
    });

    normalizePaymentPlan(inv);
    mirrorLegacyFields(inv);

    expect(inv.paymentPlan.secondTranchePaid).toBe(true);
  });
});

describe('canSettleTranche — deblocage sequentiel a N tranches', () => {
  const troisTranches = (paid = [false, false, false]) => {
    const inv = facture({
      paymentPlan: {
        tranches: [
          { label: 'T1', percent: 30, paid: paid[0] },
          { label: 'T2', percent: 40, paid: paid[1] },
          { label: 'T3', percent: 30, paid: paid[2] },
        ],
      },
    });
    normalizePaymentPlan(inv);
    return inv;
  };

  test('opens the first tranche straight away', () => {
    expect(canSettleTranche(troisTranches(), 0)).toEqual({ ok: true });
  });

  test('keeps the second locked until the first is settled', () => {
    const refus = canSettleTranche(troisTranches(), 1);

    expect(refus.ok).toBe(false);
    expect(refus.message).toMatch(/tranche 1/i);
  });

  test('opens each tranche as soon as the previous one is settled', () => {
    expect(canSettleTranche(troisTranches([true, false, false]), 1)).toEqual({ ok: true });
    expect(canSettleTranche(troisTranches([true, true, false]), 2)).toEqual({ ok: true });
  });

  test('never lets a tranche be settled twice', () => {
    const refus = canSettleTranche(troisTranches([true, false, false]), 0);

    expect(refus.ok).toBe(false);
    expect(refus.message).toMatch(/déjà/i);
  });

  test('still refuses the third when only the first is settled', () => {
    // Le saut de tranche est exactement ce que le sequencement interdit.
    expect(canSettleTranche(troisTranches([true, false, false]), 2).ok).toBe(false);
  });

  test.each([-1, 3, 99, NaN, null])('refuses the out-of-range index %s', (index) => {
    expect(canSettleTranche(troisTranches(), index).ok).toBe(false);
  });
});

describe('resolveTrancheIndex — les anciens appels continuent de marcher', () => {
  const inv = () => {
    const i = facture({
      paymentPlan: {
        tranches: [
          { label: 'T1', percent: 30 },
          { label: 'T2', percent: 40 },
          { label: 'T3', percent: 30 },
        ],
      },
    });
    normalizePaymentPlan(i);
    return i;
  };

  test('maps upfront to the first tranche', () => {
    expect(resolveTrancheIndex(inv(), { phase: 'upfront' })).toBe(0);
  });

  test('maps completion to the last tranche', () => {
    // « completion » a toujours voulu dire « la derniere echeance ».
    expect(resolveTrancheIndex(inv(), { phase: 'completion' })).toBe(2);
  });

  test('prefers an explicit index over a phase', () => {
    expect(resolveTrancheIndex(inv(), { phase: 'upfront', trancheIndex: 1 })).toBe(1);
  });

  test('accepts an index sent as a string, as a query string would', () => {
    expect(resolveTrancheIndex(inv(), { trancheIndex: '2' })).toBe(2);
  });

  test('returns -1 when neither is usable', () => {
    expect(resolveTrancheIndex(inv(), {})).toBe(-1);
    expect(resolveTrancheIndex(inv(), { phase: 'milieu' })).toBe(-1);
  });
});
