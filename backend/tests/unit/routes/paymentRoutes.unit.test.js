jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/paymentController', () => ({
  createCheckoutSession: jest.fn(),
  createSubscriptionSession: jest.fn(),
  verifySubscription: jest.fn(),
  getSubscriptionHistory: jest.fn(),
  cancelSubscription: jest.fn(),
  verifyCheckout: jest.fn(),
  getProductPayments: jest.fn(),
  downloadProductPaymentPdf: jest.fn(),
  downloadSubscriptionReceiptPdf: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/paymentController');
const router = require('../../../routes/paymentRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('paymentRoutes', () => {
  test('registers all payment endpoints behind auth', () => {
    expect(getRouteHandlers(router, 'POST', '/checkout')).toEqual([protect, controller.createCheckoutSession]);
    expect(getRouteHandlers(router, 'GET', '/checkout/verify')).toEqual([protect, controller.verifyCheckout]);
    expect(getRouteHandlers(router, 'GET', '/product-payments')).toEqual([protect, controller.getProductPayments]);
    expect(getRouteHandlers(router, 'GET', '/product-payments/:id/pdf')).toEqual([
      protect,
      controller.downloadProductPaymentPdf,
    ]);
    expect(getRouteHandlers(router, 'POST', '/subscription')).toEqual([
      protect,
      controller.createSubscriptionSession,
    ]);
    expect(getRouteHandlers(router, 'GET', '/subscription/verify')).toEqual([
      protect,
      controller.verifySubscription,
    ]);
    expect(getRouteHandlers(router, 'GET', '/subscription/history')).toEqual([
      protect,
      controller.getSubscriptionHistory,
    ]);
    expect(getRouteHandlers(router, 'POST', '/subscription/cancel')).toEqual([
      protect,
      controller.cancelSubscription,
    ]);
    expect(getRouteHandlers(router, 'GET', '/subscription/history/:id/pdf')).toEqual([
      protect,
      controller.downloadSubscriptionReceiptPdf,
    ]);
  });
});

