const mongoose = require('mongoose');
const SubscriptionPayment = require('../../../models/SubscriptionPayment');

describe('SubscriptionPayment model', () => {
  const validPayload = () => ({
    user: new mongoose.Types.ObjectId(),
    planId: 'pro-monthly',
    amount: 29.9,
    stripeSessionId: 'cs_test_123',
  });

  test('validateSync -> fails when required fields are missing', () => {
    const doc = new SubscriptionPayment({});
    const err = doc.validateSync();

    expect(err.errors.user).toBeDefined();
    expect(err.errors.planId).toBeDefined();
    expect(err.errors.amount).toBeDefined();
    expect(err.errors.stripeSessionId).toBeDefined();
  });

  test('defaults -> currency USD and status paid', () => {
    const doc = new SubscriptionPayment(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.currency).toBe('USD');
    expect(doc.status).toBe('paid');
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new SubscriptionPayment({ ...validPayload(), status: 'cancelled' });
    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });
});
