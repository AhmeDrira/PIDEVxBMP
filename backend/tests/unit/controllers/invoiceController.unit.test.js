const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../models/Invoice', () => ({
  create: jest.fn(),
  findById: jest.fn(),
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
const {
  createInvoice,
  markTranchePaid,
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
});
