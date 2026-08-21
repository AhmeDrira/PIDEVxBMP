const { buildReq, buildRes, buildNext } = require('../../http.mock');

jest.mock('../../../services/DomainService', () => ({
  extractSlugFromHost: jest.fn(),
}));

jest.mock('../../../controllers/miniSiteController', () => ({
  renderMiniSiteBySlug: jest.fn(),
}));

const DomainService = require('../../../services/DomainService');
const { renderMiniSiteBySlug } = require('../../../controllers/miniSiteController');
const miniSiteMiddleware = require('../../../middleware/miniSiteMiddleware');

const buildMiniReq = (overrides = {}) =>
  buildReq({
    method: 'GET',
    path: '/',
    headers: { host: 'hamza-ayachi.mestra.tn' },
    ...overrides,
  });

const buildMiniRes = () => {
  const res = buildRes();
  res.render = jest.fn((view, locals) => {
    res.view = view;
    res.locals = locals;
    return res;
  });
  return res;
};

describe('miniSiteMiddleware', () => {
  beforeEach(() => {
    DomainService.extractSlugFromHost.mockReturnValue('hamza-ayachi');
    renderMiniSiteBySlug.mockResolvedValue(undefined);
  });

  describe('renders the mini site', () => {
    test('on the root path of an artisan subdomain', async () => {
      const req = buildMiniReq();
      const res = buildMiniRes();
      const next = buildNext();

      await miniSiteMiddleware(req, res, next);

      expect(renderMiniSiteBySlug).toHaveBeenCalledWith(req, res, 'hamza-ayachi');
      expect(next).not.toHaveBeenCalled();
    });

    test('reads the slug from the Host header', async () => {
      const req = buildMiniReq({ headers: { host: 'hamza.localhost:5000' } });

      await miniSiteMiddleware(req, buildMiniRes(), buildNext());

      expect(DomainService.extractSlugFromHost).toHaveBeenCalledWith('hamza.localhost:5000');
    });
  });

  describe('lets the application through', () => {
    test('when the Host carries no usable slug (main domain, reserved, IP…)', async () => {
      DomainService.extractSlugFromHost.mockReturnValue(null);
      const next = buildNext();
      const res = buildMiniRes();

      await miniSiteMiddleware(buildMiniReq({ headers: { host: 'app.bmp.tn' } }), res, next);

      expect(next).toHaveBeenCalled();
      expect(renderMiniSiteBySlug).not.toHaveBeenCalled();
      expect(res.render).not.toHaveBeenCalled();
    });

    test.each([
      ['/api'],
      ['/api/artisans'],
      ['/api/auth/login'],
      ['/uploads/portfolio/a.jpg'],
      ['/site/hamza-ayachi/avatar.svg'],
    ])('on the technical path %s, even from a subdomain', async (path) => {
      const next = buildNext();

      await miniSiteMiddleware(buildMiniReq({ path }), buildMiniRes(), next);

      expect(next).toHaveBeenCalled();
      expect(renderMiniSiteBySlug).not.toHaveBeenCalled();
    });

    test('does not treat a look-alike path as technical', async () => {
      // `/apixyz` n'est pas `/api` : il ne doit pas bénéficier du passe-droit.
      await miniSiteMiddleware(buildMiniReq({ path: '/apixyz' }), buildMiniRes(), buildNext());

      expect(renderMiniSiteBySlug).not.toHaveBeenCalled(); // 404 mini site, pas l'app
    });

    test.each([['POST'], ['PUT'], ['PATCH'], ['DELETE']])(
      'on a %s request, whatever the Host',
      async (method) => {
        const next = buildNext();

        await miniSiteMiddleware(buildMiniReq({ method }), buildMiniRes(), next);

        expect(next).toHaveBeenCalled();
        expect(DomainService.extractSlugFromHost).not.toHaveBeenCalled();
      }
    );

    test('handles HEAD like GET', async () => {
      const next = buildNext();

      await miniSiteMiddleware(buildMiniReq({ method: 'HEAD' }), buildMiniRes(), next);

      expect(renderMiniSiteBySlug).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('404 on a subdomain', () => {
    test('any path other than the root renders the mini site 404', async () => {
      const res = buildMiniRes();
      const next = buildNext();

      await miniSiteMiddleware(buildMiniReq({ path: '/nimporte-quoi' }), res, next);

      expect(res.statusCode).toBe(404);
      expect(res.view).toBe('miniSiteNotFound');
      expect(renderMiniSiteBySlug).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  test('forwards a render failure to the error handler', async () => {
    const failure = new Error('render failed');
    renderMiniSiteBySlug.mockRejectedValue(failure);
    const next = buildNext();

    await miniSiteMiddleware(buildMiniReq(), buildMiniRes(), next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  test('declares the technical prefixes it must never intercept', () => {
    expect(miniSiteMiddleware.PASSTHROUGH_PREFIXES).toEqual(['/api', '/uploads', '/site']);
  });
});
