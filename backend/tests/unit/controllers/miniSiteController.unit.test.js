const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../services/DomainService', () => ({
  resolveBySlug: jest.fn(),
  buildPublicProfile: jest.fn(),
  buildMiniSiteUrl: jest.fn((slug) => `https://${slug}.bmp.tn`),
}));

jest.mock('../../../models/Review', () => ({
  find: jest.fn(),
}));

// sharp est un module natif : on le simule pour garder les tests unitaires rapides.
const mockPngBuffer = Buffer.from('fake-png');
const mockSharpPipeline = { png: jest.fn(() => mockSharpPipeline), toBuffer: jest.fn(async () => mockPngBuffer) };
jest.mock('sharp', () => jest.fn(() => mockSharpPipeline));

const DomainService = require('../../../services/DomainService');
const Review = require('../../../models/Review');
const controller = require('../../../controllers/miniSiteController');

/** req minimal, enrichi de ce dont le rendu a besoin (protocol / host). */
const buildRenderReq = (slug = 'hamza-ayachi') =>
  buildReq({
    params: { slug },
    protocol: 'https',
    headers: { host: 'hamza-ayachi.bmp.tn' },
    get: jest.fn(() => 'hamza-ayachi.bmp.tn'),
  });

/** res enrichi d'un render() espionnable. */
const buildRenderRes = () => {
  const res = buildRes();
  res.render = jest.fn((view, locals) => {
    res.view = view;
    res.locals = locals;
    return res;
  });
  return res;
};

const baseProfile = (overrides = {}) => ({
  slug: 'hamza-ayachi',
  url: 'https://hamza-ayachi.bmp.tn',
  firstName: 'Hamza',
  lastName: 'Ayachi',
  fullName: 'Hamza Ayachi',
  domain: 'Painting',
  location: 'Ariana',
  bio: '',
  profilePhoto: '',
  yearsExperience: null,
  skills: [],
  certifications: [],
  phone: '',
  whatsappUrl: null,
  portfolio: [],
  reviews: { count: 0, rating: 0, items: [] },
  ...overrides,
});

describe('miniSiteController', () => {
  beforeEach(() => {
    Review.find.mockReturnValue(chainableQuery([]));
    DomainService.resolveBySlug.mockResolvedValue({
      artisan: { _id: 'a1', firstName: 'Hamza', lastName: 'Ayachi' },
      domain: { slug: 'hamza-ayachi' },
    });
    DomainService.buildPublicProfile.mockReturnValue(baseProfile());
  });

  describe('buildDescription', () => {
    test('uses the bio when there is one', () => {
      expect(controller.buildDescription(baseProfile({ bio: 'Peintre depuis 10 ans' })))
        .toBe('Peintre depuis 10 ans');
    });

    test('rebuilds a sentence from metier, zone and experience otherwise', () => {
      expect(
        controller.buildDescription(baseProfile({ yearsExperience: 10 }))
      ).toBe("Painting — Ariana · 10 ans d'expérience");
    });

    test('degrades to a generic label on an empty profile', () => {
      expect(
        controller.buildDescription(baseProfile({ domain: '', location: '', yearsExperience: null }))
      ).toBe('Artisan');
    });

    test('truncates a long bio to the share-preview limit', () => {
      const description = controller.buildDescription(baseProfile({ bio: 'a'.repeat(400) }));

      expect(description.length).toBeLessThanOrEqual(160);
      expect(description.endsWith('…')).toBe(true);
    });

    test('collapses newlines so the meta tag stays on one line', () => {
      expect(controller.buildDescription(baseProfile({ bio: 'Ligne 1\n\nLigne 2' })))
        .toBe('Ligne 1 Ligne 2');
    });
  });

  describe('buildStats', () => {
    test('is empty for a profile with nothing to show', () => {
      expect(controller.buildStats(baseProfile())).toEqual([]);
    });

    test('only lists the figures that exist', () => {
      const stats = controller.buildStats(
        baseProfile({
          yearsExperience: 10,
          portfolio: [{}, {}],
          reviews: { count: 3, rating: 4.5, items: [] },
        })
      );

      expect(stats).toEqual([
        { value: 10, label: "ans d'expérience" },
        { value: 2, label: 'réalisations' },
        { value: 4.5, label: 'avis (3)' },
      ]);
    });

    test('skips zero years of experience rather than showing 0', () => {
      expect(controller.buildStats(baseProfile({ yearsExperience: 0 }))).toEqual([]);
    });
  });

  describe('previewMiniSite', () => {
    test('renders the mini site template', async () => {
      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.view).toBe('miniSite');
      expect(res.locals.profile.fullName).toBe('Hamza Ayachi');
    });

    test('falls back to the initials avatar when there is no photo', async () => {
      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.locals.profile.avatar.startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    test('uses the stored photo when there is one', async () => {
      DomainService.buildPublicProfile.mockReturnValue(
        baseProfile({ profilePhoto: 'data:image/png;base64,AAA' })
      );

      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.locals.profile.avatar).toBe('data:image/png;base64,AAA');
    });

    test('og:image points at the generated 1200x630 PNG share card', async () => {
      // Ni une data-URI ni un SVG ne sont rendus par WhatsApp / Facebook :
      // og:image doit être une URL absolue vers une image matricielle.
      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.locals.meta.image).toBe('https://hamza-ayachi.bmp.tn/site/hamza-ayachi/share.png');
      expect(res.locals.meta.imageWidth).toBe(1200);
      expect(res.locals.meta.imageHeight).toBe(630);
    });

    test('og:image stays the share card even when the artisan has a photo', async () => {
      DomainService.buildPublicProfile.mockReturnValue(
        baseProfile({ profilePhoto: 'https://lh3.googleusercontent.com/a/abc' })
      );

      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.locals.meta.image).toContain('/share.png');
    });

    test('renders the 404 page with a 404 status for an unknown slug', async () => {
      DomainService.resolveBySlug.mockResolvedValue(null);

      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq('inconnu'), res);

      expect(res.statusCode).toBe(404);
      expect(res.view).toBe('miniSiteNotFound');
      expect(res.locals.slug).toBe('inconnu');
      expect(Review.find).not.toHaveBeenCalled();
    });

    test('passes the artisan reviews to the profile builder', async () => {
      const reviews = [{ rating: 5, comment: 'Top' }];
      Review.find.mockReturnValue(chainableQuery(reviews));

      await controller.previewMiniSite(buildRenderReq(), buildRenderRes());

      expect(Review.find).toHaveBeenCalledWith({ artisan: 'a1' });
      expect(DomainService.buildPublicProfile).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { reviews, requestHost: 'hamza-ayachi.bmp.tn' }
      );
    });

    test('returns 500 without leaking the error to the visitor', async () => {
      DomainService.resolveBySlug.mockRejectedValue(new Error('Mongo down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = buildRenderRes();
      await controller.previewMiniSite(buildRenderReq(), res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toBe('Server error');
    });
  });

  describe('getShareCard', () => {
    const sharp = require('sharp');

    test('serves a cacheable png', async () => {
      const res = buildRenderRes();
      await controller.getShareCard(buildRenderReq(), res);

      expect(res.headers['Content-Type']).toBe('image/png');
      expect(res.headers['Cache-Control']).toBe('public, max-age=86400');
      expect(res.body).toBe(mockPngBuffer);
    });

    test('converts the share card svg through sharp', async () => {
      await controller.getShareCard(buildRenderReq(), buildRenderRes());

      const svg = sharp.mock.calls[0][0].toString();
      expect(svg).toContain('<svg');
      expect(svg).toContain('Hamza Ayachi');
      expect(mockSharpPipeline.png).toHaveBeenCalled();
    });

    test('stamps the mini site host on the card', async () => {
      await controller.getShareCard(buildRenderReq(), buildRenderRes());

      const svg = sharp.mock.calls[0][0].toString();
      expect(svg).toContain('hamza-ayachi.bmp.tn');
      expect(svg).not.toContain('https://');
    });

    test('404 for an unknown slug, without invoking sharp', async () => {
      DomainService.resolveBySlug.mockResolvedValue(null);

      const res = buildRenderRes();
      await controller.getShareCard(buildRenderReq('inconnu'), res);

      expect(res.statusCode).toBe(404);
      expect(sharp).not.toHaveBeenCalled();
    });

    test('500 when the conversion fails', async () => {
      mockSharpPipeline.toBuffer.mockRejectedValueOnce(new Error('sharp down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = buildRenderRes();
      await controller.getShareCard(buildRenderReq(), res);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('getAvatar', () => {
    test('serves a cacheable svg', async () => {
      const res = buildRenderRes();
      await controller.getAvatar(buildRenderReq(), res);

      expect(res.headers['Content-Type']).toBe('image/svg+xml; charset=utf-8');
      expect(res.headers['Cache-Control']).toBe('public, max-age=86400');
      expect(res.body).toContain('<svg');
      expect(res.body).toContain('>HA</text>');
    });

    test('404 for an unknown slug', async () => {
      DomainService.resolveBySlug.mockResolvedValue(null);

      const res = buildRenderRes();
      await controller.getAvatar(buildRenderReq('inconnu'), res);

      expect(res.statusCode).toBe(404);
    });
  });
});
