const mongoose = require('mongoose');
const Invoice = require('../../../models/Invoice');

describe('Invoice model', () => {
  const validPayload = () => ({
    invoiceNumber: 'INV-2026-0001',
    project: new mongoose.Types.ObjectId(),
    artisan: new mongoose.Types.ObjectId(),
    clientName: 'Client A',
    amount: 1200,
    description: 'Construction work',
    issueDate: new Date('2026-04-01'),
    dueDate: new Date('2026-04-15'),
  });

  test('validateSync -> fails when required fields are missing', () => {
    const doc = new Invoice({});
    const err = doc.validateSync();

    expect(err.errors.invoiceNumber).toBeDefined();
    expect(err.errors.project).toBeDefined();
    expect(err.errors.artisan).toBeDefined();
    expect(err.errors.clientName).toBeDefined();
  });

  test('defaults -> status and payment fields are initialized', () => {
    const doc = new Invoice(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('pending');
    expect(doc.paidAmount).toBe(0);
    expect(doc.paymentProgress).toBe(0);
    // Les champs figes ont disparu : le plan se remplit a la creation de la
    // facture, ou se reconstitue a la lecture pour les documents anterieurs.
    expect(Array.isArray(doc.paymentPlan.tranches)).toBe(true);
    expect(doc.paymentPlan.tranches).toHaveLength(0);
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new Invoice({ ...validPayload(), status: 'archived' });
    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });

  test('validateSync -> rejects paymentProgress above max', () => {
    const doc = new Invoice({ ...validPayload(), paymentProgress: 140 });
    const err = doc.validateSync();

    expect(err.errors.paymentProgress).toBeDefined();
  });
});
