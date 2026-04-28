const mongoose = require('mongoose');
const ProductPayment = require('../../../models/ProductPayment');

const runPreSaveHooks = async (doc) => {
  const preSaveHooks = ProductPayment.schema.s.hooks._pres.get('save') || [];
  for (const hook of preSaveHooks) {
    await hook.fn.call(doc);
  }
};

describe('ProductPayment model', () => {
  const validPayload = () => ({
    user: new mongoose.Types.ObjectId(),
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        manufacturerId: new mongoose.Types.ObjectId(),
        name: 'Ciment',
        quantity: 2,
        price: 20,
      },
    ],
    totalAmount: 40,
  });

  test('validateSync -> fails on missing required fields', () => {
    const doc = new ProductPayment({});
    const err = doc.validateSync();

    expect(err.errors.user).toBeDefined();
    expect(err.errors.totalAmount).toBeDefined();
  });

  test('defaults -> status/currency/shipping amount initialized', () => {
    const doc = new ProductPayment(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('pending');
    expect(doc.currency).toBe('TND');
    expect(doc.shippingAmount).toBe(15);
  });

  test('pre-save hook -> auto generates orderNumber for new docs', async () => {
    const doc = new ProductPayment(validPayload());

    await runPreSaveHooks(doc);

    expect(doc.orderNumber).toMatch(/^ORD-\d{4}-/);
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new ProductPayment({ ...validPayload(), status: 'unknown-status' });
    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });
});
