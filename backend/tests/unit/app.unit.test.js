const mockUse = jest.fn();
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockExpressApp = { use: mockUse };
mockExpressApp.set = mockSet;
mockExpressApp.get = mockGet;
const mockJson = jest.fn(() => 'json-middleware');
const mockUrlencoded = jest.fn(() => 'urlencoded-middleware');
const mockStatic = jest.fn(() => 'static-middleware');
const mockExpress = jest.fn(() => mockExpressApp);
mockExpress.json = mockJson;
mockExpress.urlencoded = mockUrlencoded;
mockExpress.static = mockStatic;
mockExpress.Router = jest.fn(() => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  use: jest.fn(),
}));

const mockCors = jest.fn((options) => ({ type: 'cors', options }));
const mockDotenvConfig = jest.fn();
const mockConnectDB = jest.fn();

jest.mock('express', () => mockExpress);
jest.mock('cors', () => mockCors);
jest.mock('dotenv', () => ({ config: mockDotenvConfig }));
jest.mock('../../config/db', () => mockConnectDB);

jest.mock('../../routes/authRoutes', () => ({ __route: 'auth' }));
jest.mock('../../routes/projectRoutes', () => ({ __route: 'projects' }));
jest.mock('../../routes/invoiceRoutes', () => ({ __route: 'invoices' }));
jest.mock('../../routes/quoteRoutes', () => ({ __route: 'quotes' }));
jest.mock('../../routes/artisanRoutes', () => ({ __route: 'artisans' }));
jest.mock('../../routes/expertRoutes', () => ({ __route: 'experts' }));
jest.mock('../../routes/conversations', () => ({ __route: 'conversations' }));
jest.mock('../../routes/messages', () => ({ __route: 'messages' }));
jest.mock('../../routes/productRoutes', () => ({ __route: 'products' }));
jest.mock('../../routes/statsRoutes', () => ({ __route: 'stats' }));
jest.mock('../../routes/notificationRoutes', () => ({ __route: 'notifications' }));
jest.mock('../../routes/knowledgeRoutes', () => ({ __route: 'knowledge' }));
jest.mock('../../routes/actionLogRoutes', () => ({ __route: 'logs' }));
jest.mock('../../routes/paymentRoutes', () => ({ __route: 'payments' }));
jest.mock('../../routes/reportRoutes', () => ({ __route: 'reports' }));
jest.mock('../../routes/aiRoutes', () => ({ __route: 'ai' }));
jest.mock('../../routes/recommendationRoutes', () => ({ __route: 'recommendations' }));
jest.mock('../../routes/analyticsRoutes', () => ({ __route: 'analytics' }));
jest.mock('../../routes/calendarRoutes', () => ({ __route: 'calendar' }));
jest.mock('../../routes/contractRoutes', () => ({ __route: 'contracts' }));
jest.mock('../../routes/proposalRoutes', () => ({ __route: 'proposals' }));
jest.mock('../../routes/domainRoutes', () => ({ __route: 'domain' }));
jest.mock('../../routes/miniSiteRoutes', () => ({ __route: 'miniSite' }));
jest.mock('../../middleware/miniSiteMiddleware', () => ({ __middleware: 'miniSite' }));

describe('app bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.CORS_ORIGINS = 'https://bmp.example.com, https://admin.example.com';
  });

  test('initializes app middleware stack and route mounts', () => {
    const app = require('../../app');

    expect(app).toBe(mockExpressApp);
    expect(mockDotenvConfig).toHaveBeenCalledTimes(1);
    // connectDB() a ete deplace dans server.js : app.js ne connecte plus la base
    // lui-meme, il refuse simplement les requetes /api tant que Mongo est absent.
    expect(mockConnectDB).not.toHaveBeenCalled();

    expect(mockJson).toHaveBeenCalledWith({ limit: '10mb' });
    expect(mockUrlencoded).toHaveBeenCalledWith({ extended: true, limit: '10mb' });
    expect(mockCors).toHaveBeenCalledTimes(1);

    expect(mockUse).toHaveBeenCalledWith('/uploads', 'static-middleware');
    expect(mockUse).toHaveBeenCalledWith('/api/auth', { __route: 'auth' });
    expect(mockUse).toHaveBeenCalledWith('/api/projects', { __route: 'projects' });
    expect(mockUse).toHaveBeenCalledWith('/api/invoices', { __route: 'invoices' });
    expect(mockUse).toHaveBeenCalledWith('/api/quotes', { __route: 'quotes' });
    expect(mockUse).toHaveBeenCalledWith('/api/artisans', { __route: 'artisans' });
    expect(mockUse).toHaveBeenCalledWith('/api/experts', { __route: 'experts' });
    expect(mockUse).toHaveBeenCalledWith('/api/conversations', { __route: 'conversations' });
    expect(mockUse).toHaveBeenCalledWith('/api/messages', { __route: 'messages' });
    expect(mockUse).toHaveBeenCalledWith('/api/products', { __route: 'products' });
    expect(mockUse).toHaveBeenCalledWith('/api/stats', { __route: 'stats' });
    expect(mockUse).toHaveBeenCalledWith('/api/notifications', { __route: 'notifications' });
    expect(mockUse).toHaveBeenCalledWith('/api/knowledge', { __route: 'knowledge' });
    expect(mockUse).toHaveBeenCalledWith('/api/logs', { __route: 'logs' });
    expect(mockUse).toHaveBeenCalledWith('/api/payments', { __route: 'payments' });
    expect(mockUse).toHaveBeenCalledWith('/api/reports', { __route: 'reports' });
    expect(mockUse).toHaveBeenCalledWith('/api/ai', { __route: 'ai' });
    expect(mockUse).toHaveBeenCalledWith('/api/recommendations', { __route: 'recommendations' });
    expect(mockUse).toHaveBeenCalledWith('/api/analytics', { __route: 'analytics' });

    // Mini site artisan
    expect(mockUse).toHaveBeenCalledWith('/api', { __route: 'domain' });
    expect(mockUse).toHaveBeenCalledWith('/site', { __route: 'miniSite' });
    expect(mockUse).toHaveBeenCalledWith('/api/calendar', { __route: 'calendar' });
    expect(mockUse).toHaveBeenCalledWith('/api/contracts', { __route: 'contracts' });
    expect(mockUse).toHaveBeenCalledWith('/api/proposals', { __route: 'proposals' });
  });

  test('configures the EJS view engine for the mini site', () => {
    require('../../app');

    expect(mockSet).toHaveBeenCalledWith('view engine', 'ejs');
    expect(mockSet).toHaveBeenCalledWith('views', expect.stringContaining('views'));
  });

  test('mounts the mini site host router before every /api route', () => {
    require('../../app');

    const targets = mockUse.mock.calls.map(([first]) => first);
    const miniSiteIndex = mockUse.mock.calls.findIndex(
      ([first]) => first && first.__middleware === 'miniSite'
    );

    // Sur `slug.bmp.tn`, c'est le mini site qui doit repondre, pas l'API.
    expect(miniSiteIndex).toBeGreaterThanOrEqual(0);
    const firstApiRouteIndex = targets.findIndex(
      (target) => typeof target === 'string' && target.startsWith('/api/')
    );
    expect(miniSiteIndex).toBeLessThan(firstApiRouteIndex);
  });

  test('cors origin callback allows known origins and rejects unknown ones', () => {
    require('../../app');
    const corsOptions = mockCors.mock.calls[0][0];

    const allowNoOrigin = jest.fn();
    corsOptions.origin(undefined, allowNoOrigin);
    expect(allowNoOrigin).toHaveBeenCalledWith(null, true);

    const allowConfigured = jest.fn();
    corsOptions.origin('https://bmp.example.com', allowConfigured);
    expect(allowConfigured).toHaveBeenCalledWith(null, true);

    const allowLocalLan = jest.fn();
    corsOptions.origin('http://172.20.1.5:5173', allowLocalLan);
    expect(allowLocalLan).toHaveBeenCalledWith(null, true);

    const rejectUnknown = jest.fn();
    corsOptions.origin('https://evil.example.com', rejectUnknown);
    const [error] = rejectUnknown.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/not allowed by CORS/i);
  });

  test('sets static headers with image cache policy', () => {
    require('../../app');
    const staticOptions = mockStatic.mock.calls[0][1];

    const response = { setHeader: jest.fn() };
    staticOptions.setHeaders(response, 'c:/tmp/image.png');

    expect(response.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'cross-origin');
    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Type'
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=604800, immutable'
    );
  });
});
