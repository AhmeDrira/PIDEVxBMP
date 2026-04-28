const mockProductUploadsMw = jest.fn();

jest.mock('../../../middleware/uploadMiddleware', () => ({
  fields: jest.fn(() => mockProductUploadsMw),
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  protect: jest.fn(),
}));

jest.mock('../../../controllers/productController', () => ({
  createProduct: jest.fn(),
  getProducts: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  getMarketplaceProducts: jest.fn(),
  createProductReview: jest.fn(),
  checkoutProducts: jest.fn(),
  createStripeCheckoutSession: jest.fn(),
  confirmStripeCheckoutSession: jest.fn(),
  ensureStaticProduct: jest.fn(),
  getManufacturerOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  getManufacturerAnalytics: jest.fn(),
  getBuyerOrders: jest.fn(),
  getOrderDetail: jest.fn(),
}));

jest.mock('../../../controllers/recommendationController', () => ({
  analyzeTechSheet: jest.fn(),
  generateMaterialDescription: jest.fn(),
}));

const upload = require('../../../middleware/uploadMiddleware');
const { protect } = require('../../../middleware/authMiddleware');
const productController = require('../../../controllers/productController');
const recommendationController = require('../../../controllers/recommendationController');
const router = require('../../../routes/productRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('productRoutes', () => {
  test('builds product upload middleware and wires all routes', () => {
    expect(typeof upload.fields).toBe('function');

    expect(getRouteHandlers(router, 'GET', '/marketplace')).toEqual([
      protect,
      productController.getMarketplaceProducts,
    ]);
    expect(getRouteHandlers(router, 'POST', '/ensure-static')).toEqual([
      protect,
      productController.ensureStaticProduct,
    ]);
    expect(getRouteHandlers(router, 'POST', '/generate-description')).toEqual([
      protect,
      recommendationController.generateMaterialDescription,
    ]);
    expect(getRouteHandlers(router, 'GET', '/analytics')).toEqual([
      protect,
      productController.getManufacturerAnalytics,
    ]);
    expect(getRouteHandlers(router, 'GET', '/my-orders')).toEqual([protect, productController.getBuyerOrders]);
    expect(getRouteHandlers(router, 'GET', '/my-orders/:id')).toEqual([
      protect,
      productController.getOrderDetail,
    ]);
    expect(getRouteHandlers(router, 'GET', '/orders')).toEqual([protect, productController.getManufacturerOrders]);
    expect(getRouteHandlers(router, 'PUT', '/orders/:id/status')).toEqual([
      protect,
      productController.updateOrderStatus,
    ]);
    expect(getRouteHandlers(router, 'POST', '/checkout/create-session')).toEqual([
      protect,
      productController.createStripeCheckoutSession,
    ]);
    expect(getRouteHandlers(router, 'POST', '/checkout/confirm-session')).toEqual([
      protect,
      productController.confirmStripeCheckoutSession,
    ]);
    expect(getRouteHandlers(router, 'POST', '/checkout')).toEqual([
      protect,
      productController.checkoutProducts,
    ]);
    expect(getRouteHandlers(router, 'POST', '/:id/reviews')).toEqual([
      protect,
      productController.createProductReview,
    ]);

    expect(getRouteHandlers(router, 'GET', '/')).toEqual([protect, productController.getProducts]);
    const createHandlers = getRouteHandlers(router, 'POST', '/');
    const updateHandlers = getRouteHandlers(router, 'PUT', '/:id');

    expect(createHandlers).toEqual([protect, mockProductUploadsMw, productController.createProduct]);
    expect(updateHandlers).toEqual([protect, mockProductUploadsMw, productController.updateProduct]);
    expect(getRouteHandlers(router, 'DELETE', '/:id')).toEqual([protect, productController.deleteProduct]);
    expect(getRouteHandlers(router, 'POST', '/:id/analyze-tech-sheet')).toEqual([
      protect,
      recommendationController.analyzeTechSheet,
    ]);
  });
});

