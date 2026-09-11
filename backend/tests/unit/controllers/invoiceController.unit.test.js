const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Invoice', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../../models/Quote', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const Invoice = require('../../../models/Invoice');
const Notification = require('../../../models/Notification');
const { logAction } = require('../../../utils/actionLogger');
const Quote = require('../../../models/Quote');
const {
  createInvoice,
  markTranchePaid,
  createInvoiceFromQuote,
} = require('../../../controllers/invoiceController');

describe('invoiceController', () => {
  test('createInvoice -> 400 when required fields are missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { project: 'p1' } });
    const res = buildRes();

    await createInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/Please add all fields/i);
  });

  test('createInvoice -> 201 on success', async () => {
    const invoiceDoc = {
      _id: 'inv1',
      invoiceNumber: 'INV-2026-1111',
      amount: 1000,
      status: 'pending',
      paymentPlan: { firstTranchePercent: 50 },
      save: jest.fn().mockResolvedValue(),
    };
    Invoice.create.mockResolvedValue(invoiceDoc);

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        project: 'p1',
        clientName: 'Client A',
        amount: 1000,
        description: 'Travaux',
        issueDate: '2026-04-10',
        dueDate: '2026-04-30',
        upfrontPercent: 40,
      },
    });
    const res = buildRes();

    await createInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logAction).toHaveBeenCalled();
    expect(invoiceDoc.save).toHaveBeenCalled();
  });

  test('markTranchePaid -> 404 when invoice does not exist', async () => {
    Invoice.findById.mockReturnValue(chainableQuery(null));

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'missing' }, body: { phase: 'upfront' } });
    const res = buildRes();

    await markTranchePaid(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('markTranchePaid -> 403 when ownership check fails', async () => {
    const invoiceDoc = {
      artisan: { toString: () => 'other' },
      paymentPlan: { firstTranchePaid: false, secondTranchePaid: false },
    };
    Invoice.findById.mockReturnValue(chainableQuery(invoiceDoc));

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'inv1' }, body: { phase: 'upfront' } });
    const res = buildRes();

    await markTranchePaid(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('markTranchePaid -> 200 for valid upfront tranche', async () => {
    const invoiceDoc = {
      _id: 'inv1',
      invoiceNumber: 'INV-2026-1111',
      artisan: { toString: () => 'u1' },
      amount: 1000,
      paidAmount: 0,
      status: 'pending',
      paymentPlan: {
        firstTranchePercent: 50,
        firstTranchePaid: false,
        secondTranchePaid: false,
      },
      save: jest.fn().mockResolvedValue(),
    };

    Invoice.findById.mockReturnValue(chainableQuery(invoiceDoc));

    const req = buildReq({
      user: { _id: 'u1' },
      params: { id: 'inv1' },
      body: { phase: 'upfront' },
    });
    const res = buildRes();

    await markTranchePaid(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(invoiceDoc.save).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
  });

  test('markTranchePaid -> 500 on unexpected error', async () => {
    Invoice.findById.mockImplementation(() => {
      throw new Error('db error');
    });

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'inv1' }, body: { phase: 'upfront' } });
    const res = buildRes();

    await markTranchePaid(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toMatch(/Failed to mark tranche as paid/i);
  });

  describe('createInvoiceFromQuote with a multi-tranche quote', () => {
    /**
     * L'echeancier du devis passe tel quel dans la facture, quel que soit le
     * nombre de tranches. C'etait le bug de fond : la facture ne retenait que
     * `upfrontPercent` et un devis 30/20/50 devenait une facture 30/70.
     */
    const buildQuote = (overrides = {}) => ({
      _id: 'q1',
      quoteNumber: 'QT-2026-1111',
      artisan: 'u1',
      status: 'approved',
      amount: 1000,
      clientName: 'Client A',
      description: 'Work',
      project: { _id: 'p1', title: 'Villa' },
      upfrontPercent: 30,
      paymentSchedule: [
        { label: 'Acompte', type: 'percent', value: 30, amount: 300, percentage: 30 },
        { label: 'Apres pose', type: 'fixed', value: 200, amount: 200, percentage: 20 },
        { label: 'Solde', type: 'remaining', value: 0, amount: 500, percentage: 50 },
      ],
      ...overrides,
    });

    /** Toujours dans le futur : le controleur refuse une echeance passee. */
    const futureDueDate = () => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    };

    beforeEach(() => {
      Quote.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(buildQuote()) });
      Invoice.findOne.mockResolvedValue(null);
      Invoice.create.mockImplementation(async (doc) => ({
        ...doc,
        _id: 'inv1',
        save: jest.fn().mockResolvedValue(undefined),
      }));
    });

    test('carries the three tranches of the quote into the invoice', async () => {
      /**
       * Ce test remplace un garde-fou temporaire qui REFUSAIT ce cas, lui-meme
       * ayant remplace deux tests qui verifiaient que la troncature en 30/70
       * « ne plantait pas ». La chaine sait desormais compter au-dela de deux :
       * l'echeancier du devis passe tel quel dans la facture.
       */
      const req = buildReq({
        user: { _id: 'u1' },
        params: { quoteId: 'q1' },
        body: { dueDate: futureDueDate() },
      });
      const res = buildRes();

      await createInvoiceFromQuote(req, res);

      expect(res.statusCode).not.toBe(400);
      const created = Invoice.create.mock.calls.at(-1)[0];
      expect(created.paymentPlan.tranches).toHaveLength(3);
      expect(created.paymentPlan.tranches.map((t) => t.percent)).toEqual([30, 20, 50]);
      expect(created.paymentPlan.tranches.map((t) => t.label))
        .toEqual(['Acompte', 'Apres pose', 'Solde']);
      // Aucune tranche n'est reglee a la creation.
      expect(created.paymentPlan.tranches.every((t) => t.paid === false)).toBe(true);
    });

    test('still invoices a quote with exactly two tranches', async () => {
      Quote.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(buildQuote({
          upfrontPercent: 40,
          paymentSchedule: [
            { label: 'Acompte', type: 'percent', value: 40, amount: 400, percentage: 40 },
            { label: 'Solde', type: 'remaining', value: 0, amount: 600, percentage: 60 },
          ],
        })),
      });

      const req = buildReq({
        user: { _id: 'u1' },
        params: { quoteId: 'q1' },
        body: { dueDate: futureDueDate() },
      });
      const res = buildRes();

      await createInvoiceFromQuote(req, res);

      expect(res.statusCode).not.toBe(400);
      const created = Invoice.create.mock.calls.at(-1)[0];
      expect(created.paymentPlan.tranches.map((t) => t.percent)).toEqual([40, 60]);
    });

    test('still invoices a quote with no schedule at all', async () => {
      // Les devis anterieurs a l'echeancier n'ont pas de `paymentSchedule` :
      // le garde-fou ne doit pas les bloquer.
      Quote.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(buildQuote({ paymentSchedule: undefined })),
      });

      const req = buildReq({
        user: { _id: 'u1' },
        params: { quoteId: 'q1' },
        body: { dueDate: futureDueDate() },
      });
      const res = buildRes();

      await createInvoiceFromQuote(req, res);

      expect(res.statusCode).not.toBe(400);
      expect(Invoice.create).toHaveBeenCalled();
    });
  });

});
