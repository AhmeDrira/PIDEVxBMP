jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/invoiceController', () => ({
  createInvoice: jest.fn(),
  getInvoices: jest.fn(),
  updateInvoiceStatus: jest.fn(),
  createInvoiceFromQuote: jest.fn(),
  createInvoicePaymentSession: jest.fn(),
  confirmInvoicePaymentSession: jest.fn(),
  markTranchePaid: jest.fn(),
  unmarkTranchePaid: jest.fn(),
  downloadInvoicePdf: jest.fn(),
  deleteInvoice: jest.fn(),
}));

const { protect } = require('../../../middleware/authMiddleware');
const controller = require('../../../controllers/invoiceController');
const router = require('../../../routes/invoiceRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('invoiceRoutes', () => {
  test('registers all protected invoice endpoints', () => {
    expect(getRouteHandlers(router, 'POST', '/')).toEqual([protect, controller.createInvoice]);
    expect(getRouteHandlers(router, 'POST', '/from-quote/:quoteId')).toEqual([
      protect,
      controller.createInvoiceFromQuote,
    ]);
    expect(getRouteHandlers(router, 'POST', '/:id/create-payment-session')).toEqual([
      protect,
      controller.createInvoicePaymentSession,
    ]);
    expect(getRouteHandlers(router, 'POST', '/confirm-payment-session')).toEqual([
      protect,
      controller.confirmInvoicePaymentSession,
    ]);
    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, controller.getInvoices]);
    expect(getRouteHandlers(router, 'GET', '/:id/pdf')).toEqual([protect, controller.downloadInvoicePdf]);
    expect(getRouteHandlers(router, 'PUT', '/:id/status')).toEqual([protect, controller.updateInvoiceStatus]);
    expect(getRouteHandlers(router, 'PATCH', '/:id/mark-tranche-paid')).toEqual([
      protect,
      controller.markTranchePaid,
    ]);
    expect(getRouteHandlers(router, 'PATCH', '/:id/unmark-tranche-paid')).toEqual([
      protect,
      controller.unmarkTranchePaid,
    ]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, controller.deleteInvoice]);
  });
});

