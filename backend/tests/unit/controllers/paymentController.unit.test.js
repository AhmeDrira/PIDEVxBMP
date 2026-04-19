const { createMockReq, createMockRes } = require('../mocks/http.mock');

const mockStripeCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn(() => ({
    checkout: {
      sessions: {
        create: mockStripeCreate,
        retrieve: jest.fn(),
      },
    },
  }))
);

jest.mock('../../../models/Product', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/User', () => ({
  User: {
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../../models/SubscriptionPayment', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../models/ProductPayment', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const Product = require('../../../models/Product');

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_unit';
const { createCheckoutSession } = require('../../../controllers/paymentController');

describe('paymentController (unit)', () => {
  it('should create Stripe checkout session for valid artisan cart', async () => {
    // Arrange
    Product.find.mockResolvedValue([
      { _id: 'p-1', name: 'Cement Bag', price: 12.5, manufacturer: 'm-1' },
    ]);
    mockStripeCreate.mockResolvedValue({ url: 'https://stripe.local/checkout/abc' });

    const req = createMockReq({
      user: { _id: 'user-1', role: 'artisan' },
      body: {
        items: [{ productId: 'p-1', quantity: 2 }],
      },
    });
    const res = createMockRes();

    // Act
    await createCheckoutSession(req, res);

    // Assert
    expect(Product.find).toHaveBeenCalledWith({ _id: { $in: ['p-1'] } });
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({ buyerId: 'user-1', role: 'artisan' }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ url: 'https://stripe.local/checkout/abc' });
  });

  it('should reject invalid payload when cart is empty', async () => {
    // Arrange
    const req = createMockReq({
      user: { _id: 'user-1', role: 'expert' },
      body: { items: [] },
    });
    const res = createMockRes();

    // Act
    await createCheckoutSession(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cart is empty' });
    expect(Product.find).not.toHaveBeenCalled();
  });

  it('should enforce role authorization before checkout', async () => {
    // Arrange
    const req = createMockReq({
      user: { _id: 'user-2', role: 'manufacturer' },
      body: { items: [{ productId: 'p-1', quantity: 1 }] },
    });
    const res = createMockRes();

    // Act
    await createCheckoutSession(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Only expert or artisan accounts can checkout materials',
    });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it('should return 500 when downstream service fails', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Product.find.mockRejectedValueOnce(new Error('database unavailable'));

    const req = createMockReq({
      user: { _id: 'user-3', role: 'artisan' },
      body: {
        items: [{ productId: 'p-9', quantity: 1 }],
      },
    });
    const res = createMockRes();

    // Act
    await createCheckoutSession(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to create checkout session' });
    consoleSpy.mockRestore();
  });
});
