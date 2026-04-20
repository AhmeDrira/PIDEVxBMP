const mongoose = require('mongoose');
const Quote = require('../../../models/Quote');

describe('Quote model', () => {
  const validPayload = () => ({
    quoteNumber: 'QT-2026-0001',
    project: new mongoose.Types.ObjectId(),
    artisan: new mongoose.Types.ObjectId(),
    clientName: 'Client A',
    laborHand: 100,
    materialsAmount: 200,
    amount: 300,
    description: 'Scope of work',
    validUntil: new Date('2026-05-01'),
  });

  test('validateSync -> fails on missing required fields', () => {
    const doc = new Quote({});
    const err = doc.validateSync();

    expect(err.errors.quoteNumber).toBeDefined();
    expect(err.errors.project).toBeDefined();
    expect(err.errors.artisan).toBeDefined();
    expect(err.errors.clientName).toBeDefined();
    expect(err.errors.description).toBeDefined();
  });

  test('defaults -> status pending and upfrontPercent 50', () => {
    const doc = new Quote(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('pending');
    expect(doc.upfrontPercent).toBe(50);
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new Quote({ ...validPayload(), status: 'closed' });
    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });

  test('validateSync -> rejects upfrontPercent out of range', () => {
    const doc = new Quote({ ...validPayload(), upfrontPercent: 120 });
    const err = doc.validateSync();

    expect(err.errors.upfrontPercent).toBeDefined();
  });
});
