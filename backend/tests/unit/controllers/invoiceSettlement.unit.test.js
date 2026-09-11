const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

/**
 * Reglement d'une facture : Stripe, marquage manuel, annulation.
 *
 * ⚠ CES TESTS SONT ECRITS AVANT TOUTE MODIFICATION, sur le code a deux
 * tranches, et ils y passent. C'est leur seul interet : ils decrivent le
 * comportement REEL, pas celui qu'on imagine. La generalisation a N tranches
 * devra les laisser verts — c'est le filet, ce code de paiement n'en avait
 * aucun jusqu'ici.
 */

const mockSessionCreate = jest.fn();
const mockSessionRetrieve = jest.fn();

jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
  checkout: { sessions: { create: mockSessionCreate, retrieve: mockSessionRetrieve } },
})));

jest.mock('../../../models/Invoice', () => ({
  create: jest.fn(), findById: jest.fn(), findOne: jest.fn(), find: jest.fn(),
}));
jest.mock('../../../models/Quote', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../../../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../../../utils/actionLogger', () => ({ logAction: jest.fn() }));

const Invoice = require('../../../models/Invoice');
const Notification = require('../../../models/Notification');
const {
  createInvoicePaymentSession,
  confirmInvoicePaymentSession,
  markTranchePaid,
  unmarkTranchePaid,
} = require('../../../controllers/invoiceController');

/** Facture a deux tranches, telle qu'elle existe aujourd'hui. */
const facture = (plan = {}, over = {}) => ({
  _id: 'inv1',
  invoiceNumber: 'INV-2026-1111',
  amount: 1000,
  status: 'pending',
  paidAmount: 0,
  paymentProgress: 0,
  artisan: { toString: () => 'u1' },
  paymentSessions: [],
  delivery: { status: 'none', timeline: [] },
  paymentPlan: {
    firstTranchePercent: 40,
    secondTranchePercent: 60,
    firstTranchePaid: false,
    secondTranchePaid: false,
    ...plan,
  },
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const brancher = (invoice) => Invoice.findById.mockReturnValue(chainableQuery(invoice));

const appeler = async (fn, { body = {}, id = 'inv1' } = {}) => {
  const res = buildRes();
  await fn(buildReq({ user: { _id: 'u1' }, params: { id }, body }), res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  Notification.create.mockResolvedValue({});
  mockSessionCreate.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/cs_1' });
});

// ── Stripe : ouverture de la session ────────────────────────────────────────

describe('createInvoicePaymentSession — comportement actuel', () => {
  test('404 when the invoice does not exist', async () => {
    brancher(null);
    expect((await appeler(createInvoicePaymentSession, { body: { phase: 'upfront' } })).statusCode).toBe(404);
  });

  test('403 when the invoice belongs to someone else', async () => {
    brancher(facture({}, { artisan: { toString: () => 'autre' } }));
    expect((await appeler(createInvoicePaymentSession, { body: { phase: 'upfront' } })).statusCode).toBe(403);
  });

  test.each([['nothing', ''], ['an unknown phase', 'milieu']])('400 on %s', async (_l, phase) => {
    brancher(facture());
    const res = await appeler(createInvoicePaymentSession, { body: { phase } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Invalid phase/i);
  });

  test('400 when the upfront tranche is already paid', async () => {
    brancher(facture({ firstTranchePaid: true }));
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already paid/i);
  });

  test('400 when completion is asked before upfront — the sequencing rule', async () => {
    brancher(facture());
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'completion' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/must be paid first/i);
  });

  test('400 when the completion tranche is already paid', async () => {
    brancher(facture({ firstTranchePaid: true, secondTranchePaid: true }));
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'completion' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already paid/i);
  });

  test('400 when the tranche amount would be zero', async () => {
    brancher(facture({}, { amount: 0 }));
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Invalid installment amount/i);
  });

  test('opens a Stripe session for the upfront amount', async () => {
    brancher(facture());
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sessionId: 'cs_1', amount: 400, phase: 'upfront' });

    const envoye = mockSessionCreate.mock.calls[0][0];
    // Le montant part en centimes : une erreur de facteur se voit ici.
    expect(envoye.line_items[0].price_data.unit_amount).toBe(40000);
    expect(envoye.metadata).toMatchObject({ invoiceId: 'inv1', phase: 'upfront', userId: 'u1' });
  });

  test('opens a Stripe session for the completion amount once upfront is paid', async () => {
    brancher(facture({ firstTranchePaid: true }));
    const res = await appeler(createInvoicePaymentSession, { body: { phase: 'completion' } });

    expect(res.body.amount).toBe(600);
  });
});

// ── Stripe : confirmation du paiement ───────────────────────────────────────

describe('confirmInvoicePaymentSession — comportement actuel', () => {
  const sessionPayee = (phase = 'upfront') => ({
    payment_status: 'paid',
    metadata: { invoiceId: 'inv1', phase },
  });

  const confirmer = async (body = { sessionId: 'cs_1' }) => {
    const res = buildRes();
    await confirmInvoicePaymentSession(buildReq({ user: { _id: 'u1' }, body }), res);
    return res;
  };

  test('400 without a session id', async () => {
    expect((await confirmer({})).statusCode).toBe(400);
  });

  test('400 when Stripe says the payment is not completed', async () => {
    mockSessionRetrieve.mockResolvedValue({ payment_status: 'unpaid', metadata: {} });
    const res = await confirmer();

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not completed/i);
  });

  test('400 when the Stripe metadata does not name a valid phase', async () => {
    mockSessionRetrieve.mockResolvedValue({ payment_status: 'paid', metadata: { invoiceId: 'inv1', phase: 'milieu' } });

    expect((await confirmer()).statusCode).toBe(400);
  });

  test('settles the upfront tranche and schedules the next deadline', async () => {
    mockSessionRetrieve.mockResolvedValue(sessionPayee('upfront'));
    const inv = facture();
    brancher(inv);

    const res = await confirmer();

    expect(res.statusCode).toBe(200);
    expect(inv.paymentPlan.tranches[0].paid).toBe(true);
    expect(inv.paidAmount).toBe(400);
    expect(inv.paymentProgress).toBe(40);
    expect(inv.status).toBe('pending');
    expect(inv.paymentPlan.tranches[1].dueDate).toBeInstanceOf(Date);
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice_second_tranche_due' })
    );
  });

  test('settles the completion tranche and closes the invoice', async () => {
    mockSessionRetrieve.mockResolvedValue(sessionPayee('completion'));
    const inv = facture({ firstTranchePaid: true }, { paidAmount: 400 });
    brancher(inv);

    await confirmer();

    expect(inv.paymentPlan.tranches[1].paid).toBe(true);
    expect(inv.paidAmount).toBe(1000);
    expect(inv.status).toBe('paid');
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice_payment_completed' })
    );
  });

  test('never counts the same Stripe session twice', async () => {
    // Le client peut rouvrir l'URL de retour : l'encaissement doit rester unique.
    mockSessionRetrieve.mockResolvedValue(sessionPayee('upfront'));
    // La fixture porte le drapeau de tranche : une session enregistree comme
    // traitee implique forcement que la tranche a ete marquee reglee, les deux
    // etant poses ensemble. Sans lui, l'etat decrit serait impossible.
    const inv = facture({ firstTranchePaid: true }, {
      paidAmount: 400,
      paymentSessions: [{ sessionId: 'cs_1', phase: 'upfront', amount: 400 }],
    });
    brancher(inv);

    const res = await confirmer();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/already processed/i);
    expect(inv.paidAmount).toBe(400);
    expect(inv.save).not.toHaveBeenCalled();
  });

  test('records the session so the payment can be traced', async () => {
    mockSessionRetrieve.mockResolvedValue(sessionPayee('upfront'));
    const inv = facture();
    brancher(inv);

    await confirmer();

    expect(inv.paymentSessions).toHaveLength(1);
    expect(inv.paymentSessions[0]).toMatchObject({ sessionId: 'cs_1', amount: 400 });
  });
});

// ── Marquage manuel ─────────────────────────────────────────────────────────

describe('markTranchePaid — comportement actuel', () => {
  test('400 on an unknown phase', async () => {
    brancher(facture());
    expect((await appeler(markTranchePaid, { body: { phase: 'milieu' } })).statusCode).toBe(400);
  });

  test('400 when completion is marked before upfront', async () => {
    brancher(facture());
    const res = await appeler(markTranchePaid, { body: { phase: 'completion' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/must be confirmed first/i);
  });

  test('400 when the tranche is already marked', async () => {
    brancher(facture({ firstTranchePaid: true }));
    const res = await appeler(markTranchePaid, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already marked/i);
  });

  test('marks the upfront tranche as received', async () => {
    const inv = facture();
    brancher(inv);

    const res = await appeler(markTranchePaid, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(200);
    expect(inv.paymentPlan.tranches[0].paid).toBe(true);
    expect(inv.paidAmount).toBe(400);
    expect(inv.status).toBe('pending');
    expect(inv.save).toHaveBeenCalled();
  });

  test('closes the invoice once the completion tranche is marked', async () => {
    const inv = facture({ firstTranchePaid: true }, { paidAmount: 400 });
    brancher(inv);

    await appeler(markTranchePaid, { body: { phase: 'completion' } });

    expect(inv.paymentPlan.tranches[1].paid).toBe(true);
    expect(inv.paidAmount).toBe(1000);
    expect(inv.status).toBe('paid');
  });
});

// ── Annulation d'un marquage ────────────────────────────────────────────────

describe('unmarkTranchePaid — comportement actuel', () => {
  test('400 when the tranche was not marked in the first place', async () => {
    brancher(facture());
    const res = await appeler(unmarkTranchePaid, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not marked as paid/i);
  });

  test('400 when cancelling the upfront while completion is already received', async () => {
    // Regle inverse du sequencement : on ne retire pas une marche du bas.
    brancher(facture({ firstTranchePaid: true, secondTranchePaid: true }, { paidAmount: 1000 }));
    const res = await appeler(unmarkTranchePaid, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Cancel completion first/i);
  });

  test('cancels the upfront mark and gives the money back', async () => {
    const inv = facture({ firstTranchePaid: true }, { paidAmount: 400 });
    brancher(inv);

    const res = await appeler(unmarkTranchePaid, { body: { phase: 'upfront' } });

    expect(res.statusCode).toBe(200);
    expect(inv.paymentPlan.tranches[0].paid).toBe(false);
    expect(inv.paidAmount).toBe(0);
    expect(inv.paymentProgress).toBe(0);
    expect(inv.paymentPlan.tranches[1].dueDate).toBeNull();
  });

  test('cancels the completion mark and reopens the invoice', async () => {
    const inv = facture(
      { firstTranchePaid: true, secondTranchePaid: true },
      { paidAmount: 1000, status: 'paid' }
    );
    brancher(inv);

    await appeler(unmarkTranchePaid, { body: { phase: 'completion' } });

    expect(inv.paymentPlan.tranches[1].paid).toBe(false);
    expect(inv.paidAmount).toBe(400);
    expect(inv.status).toBe('pending');
  });
});

// ── N tranches : ce que la generalisation apporte ───────────────────────────

describe('reglement a N tranches', () => {
  /** Facture en 30/40/30, telle qu'un devis a trois tranches la produit. */
  const troisTranches = (paid = [false, false, false]) => facture({}, {
    paymentPlan: {
      tranches: [
        { label: 'Acompte', percent: 30, paid: paid[0] },
        { label: 'Mi-chantier', percent: 40, paid: paid[1] },
        { label: 'Solde', percent: 30, paid: paid[2] },
      ],
    },
  });

  test('keeps the three tranches instead of collapsing them', async () => {
    const inv = troisTranches();
    brancher(inv);

    await appeler(createInvoicePaymentSession, { body: { trancheIndex: 0 } });

    expect(inv.paymentPlan.tranches.map((t) => t.amount)).toEqual([300, 400, 300]);
  });

  test('opens a session for the middle tranche once the first is settled', async () => {
    brancher(troisTranches([true, false, false]));

    const res = await appeler(createInvoicePaymentSession, { body: { trancheIndex: 1 } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ amount: 400, trancheIndex: 1 });
  });

  test('refuses to skip a tranche', async () => {
    // Le sequencement vaut pour toutes les marches, pas seulement la premiere.
    brancher(troisTranches([true, false, false]));

    const res = await appeler(createInvoicePaymentSession, { body: { trancheIndex: 2 } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/tranche 2 doit être réglée avant/i);
  });

  test('names the tranche on the Stripe line so the client recognises it', async () => {
    brancher(troisTranches([true, false, false]));

    await appeler(createInvoicePaymentSession, { body: { trancheIndex: 1 } });

    const envoye = mockSessionCreate.mock.calls[0][0];
    expect(envoye.line_items[0].price_data.product_data.name).toMatch(/Mi-chantier/);
    expect(envoye.metadata.trancheIndex).toBe('1');
  });

  test('marks the middle tranche manually and stops short of closing', async () => {
    const inv = troisTranches([true, false, false]);
    brancher(inv);

    await appeler(markTranchePaid, { body: { trancheIndex: 1 } });

    expect(inv.paymentPlan.tranches[1].paid).toBe(true);
    expect(inv.paidAmount).toBe(700);
    expect(inv.paymentProgress).toBe(70);
    // Deux tranches sur trois : la facture reste ouverte.
    expect(inv.status).toBe('pending');
  });

  test('closes the invoice only when the last tranche is settled', async () => {
    const inv = troisTranches([true, true, false]);
    brancher(inv);

    await appeler(markTranchePaid, { body: { trancheIndex: 2 } });

    expect(inv.paidAmount).toBe(1000);
    expect(inv.status).toBe('paid');
  });

  test('refuses to cancel a tranche while a later one is settled', async () => {
    // Sequencement inverse : retirer une marche du bas laisserait un trou.
    brancher(troisTranches([true, true, false]));

    const res = await appeler(unmarkTranchePaid, { body: { trancheIndex: 0 } });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/tranche 2 est déjà réglée/i);
  });

  test('cancels the last settled tranche and gives the money back', async () => {
    const inv = troisTranches([true, true, false]);
    brancher(inv);

    await appeler(unmarkTranchePaid, { body: { trancheIndex: 1 } });

    expect(inv.paymentPlan.tranches[1].paid).toBe(false);
    expect(inv.paidAmount).toBe(300);
    expect(inv.status).toBe('pending');
  });

  test('schedules a deadline for the tranche that follows, whichever it is', async () => {
    const inv = troisTranches([true, false, false]);
    brancher(inv);

    await appeler(markTranchePaid, { body: { trancheIndex: 1 } });

    expect(inv.paymentPlan.tranches[2].dueDate).toBeInstanceOf(Date);
  });

  test('schedules nothing after the last tranche', async () => {
    const inv = troisTranches([true, true, false]);
    brancher(inv);

    await appeler(markTranchePaid, { body: { trancheIndex: 2 } });

    // Rien ne suit : pas d'echeance fantome ni de notification inutile.
    expect(Notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice_second_tranche_due' })
    );
  });

  test('still understands the old phase words on a three-tranche invoice', async () => {
    // Le frontend envoie encore `phase` : « completion » vise la derniere.
    const inv = troisTranches([true, true, false]);
    brancher(inv);

    await appeler(markTranchePaid, { body: { phase: 'completion' } });

    expect(inv.paymentPlan.tranches[2].paid).toBe(true);
    expect(inv.status).toBe('paid');
  });

  test('refuses an index the invoice does not have', async () => {
    brancher(troisTranches());

    const res = await appeler(markTranchePaid, { body: { trancheIndex: 7 } });

    expect(res.statusCode).toBe(400);
  });
});
