const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../services/DomainService', () => ({
  checkSlugAvailable: jest.fn(),
  ensureDomainForArtisan: jest.fn(),
  buildMiniSiteUrl: jest.fn((slug) => `https://${slug}.mestra.tn`),
  resolveBySlug: jest.fn(),
  buildPublicProfile: jest.fn(() => ({ slug: 'hamza-ayachi', fullName: 'Hamza Ayachi' })),
  RESERVED_REASON: 'SLUG_RESERVED',
  TAKEN_REASON: 'SLUG_TAKEN',
}));

jest.mock('../../../models/ArtisanDomain', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../models/Review', () => ({
  find: jest.fn(),
}));

const ArtisanDomain = require('../../../models/ArtisanDomain');
const DomainService = require('../../../services/DomainService');
const {
  checkSlug,
  getPublicArtisan,
  getMyDomain,
  updateMyDomain,
} = require('../../../controllers/domainController');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('domainController.checkSlug', () => {
  test('returns 200 and the availability payload', async () => {
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: true,
      slug: 'hamza-ayachi',
    });

    const req = buildReq({ query: { slug: 'hamza-ayachi' } });
    const res = buildRes();

    await checkSlug(req, res);

    expect(DomainService.checkSlugAvailable).toHaveBeenCalledWith('hamza-ayachi');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ available: true, slug: 'hamza-ayachi' });
  });

  test('forwards the suggestion when the slug is taken', async () => {
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: false,
      slug: 'hamza-ayachi',
      reason: 'SLUG_TAKEN',
      message: 'This slug is already taken',
      suggestion: 'hamza-ayachi-2',
    });

    const res = buildRes();
    await checkSlug(buildReq({ query: { slug: 'hamza-ayachi' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.suggestion).toBe('hamza-ayachi-2');
    expect(res.body.reason).toBe('SLUG_TAKEN');
  });

  test('an invalid slug is still 200, not a 4xx', async () => {
    // Appelé à chaque frappe : `ha` est un état intermédiaire normal, pas une erreur.
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: false,
      slug: 'ha',
      reason: 'SLUG_TOO_SHORT',
      message: 'Slug must be at least 3 characters long',
    });

    const res = buildRes();
    await checkSlug(buildReq({ query: { slug: 'ha' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('SLUG_TOO_SHORT');
  });

  test('a missing slug parameter is delegated to the service', async () => {
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: false,
      slug: '',
      reason: 'SLUG_REQUIRED',
      message: 'Slug is required',
    });

    const res = buildRes();
    await checkSlug(buildReq({ query: {} }), res);

    expect(DomainService.checkSlugAvailable).toHaveBeenCalledWith(undefined);
    expect(res.statusCode).toBe(200);
    expect(res.body.reason).toBe('SLUG_REQUIRED');
  });

  test('returns 500 when the service throws', async () => {
    DomainService.checkSlugAvailable.mockRejectedValue(new Error('Mongo down'));

    const res = buildRes();
    await checkSlug(buildReq({ query: { slug: 'hamza-ayachi' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Server error', error: 'Mongo down' });
  });
});

describe('domainController.getPublicArtisan', () => {
  const Review = require('../../../models/Review');
  const artisan = { _id: 'artisan-1', role: 'artisan', status: 'active' };
  const domain = { slug: 'hamza-ayachi' };

  beforeEach(() => {
    Review.find.mockReturnValue(chainableQuery([]));
  });

  test('returns the public profile for a known slug', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' } }), res);

    expect(DomainService.resolveBySlug).toHaveBeenCalledWith('hamza-ayachi');
    expect(res.statusCode).toBe(200);
    expect(res.body.fullName).toBe('Hamza Ayachi');
  });

  test('passes the reviews of that artisan to the profile builder', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });
    const reviews = [{ rating: 5, comment: 'Top' }];
    Review.find.mockReturnValue(chainableQuery(reviews));

    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' } }), buildRes());

    expect(Review.find).toHaveBeenCalledWith({ artisan: 'artisan-1' });
    expect(DomainService.buildPublicProfile).toHaveBeenCalledWith(artisan, domain, { reviews });
  });

  test('404 when the slug matches no mini site', async () => {
    DomainService.resolveBySlug.mockResolvedValue(null);

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'inconnu' } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Artisan not found' });
    expect(Review.find).not.toHaveBeenCalled();
  });

  test('requires no authentication', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' }, user: null }), res);

    expect(res.statusCode).toBe(200);
  });

  test('500 on an unexpected error', async () => {
    DomainService.resolveBySlug.mockRejectedValue(new Error('Mongo down'));

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('domainController — mini site of the logged-in artisan', () => {
  const artisan = { _id: 'artisan-1', role: 'artisan' };

  const buildDomain = (overrides = {}) => ({
    slug: 'hamza-ayachi',
    lockedAt: new Date(Date.now() + 10 * DAY_MS),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    ArtisanDomain.findOne.mockReturnValue(chainableQuery(null));
    DomainService.ensureDomainForArtisan.mockResolvedValue(null);
  });

  describe('getMyDomain', () => {
    test('returns slug, public url and remaining days', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisan }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          slug: 'hamza-ayachi',
          url: 'https://hamza-ayachi.mestra.tn',
          daysRemaining: 10,
          editable: true,
        })
      );
    });

    test('reports a locked mini site', async () => {
      ArtisanDomain.findOne.mockReturnValue(
        chainableQuery(buildDomain({ lockedAt: new Date(Date.now() - DAY_MS) }))
      );

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisan }), res);

      expect(res.body.editable).toBe(false);
      expect(res.body.daysRemaining).toBe(0);
    });

    test('creates the mini site on the fly for an artisan who has none', async () => {
      DomainService.ensureDomainForArtisan.mockResolvedValue(buildDomain({ slug: 'rattrape' }));

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisan }), res);

      expect(DomainService.ensureDomainForArtisan).toHaveBeenCalledWith(artisan);
      expect(res.statusCode).toBe(200);
      expect(res.body.slug).toBe('rattrape');
    });

    test('403 for a non-artisan account', async () => {
      const res = buildRes();
      await getMyDomain(buildReq({ user: { _id: 'e1', role: 'expert' } }), res);

      expect(res.statusCode).toBe(403);
      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
    });

    test('404 when no mini site could be produced', async () => {
      const res = buildRes();
      await getMyDomain(buildReq({ user: artisan }), res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateMyDomain', () => {
    test('saves a valid, free slug', async () => {
      const domain = buildDomain();
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: true,
        slug: 'hamza-electricien-tunis',
      });

      const res = buildRes();
      await updateMyDomain(
        buildReq({ user: artisan, body: { slug: 'hamza-electricien-tunis' } }),
        res
      );

      expect(DomainService.checkSlugAvailable).toHaveBeenCalledWith('hamza-electricien-tunis', {
        excludeArtisanId: 'artisan-1',
      });
      expect(domain.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.slug).toBe('hamza-electricien-tunis');
    });

    test('does not write when the slug is unchanged', async () => {
      const domain = buildDomain();
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: true,
        slug: 'hamza-ayachi',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'hamza-ayachi' } }), res);

      expect(domain.save).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    test('403 once the slug is locked, without checking availability', async () => {
      ArtisanDomain.findOne.mockReturnValue(
        chainableQuery(buildDomain({ lockedAt: new Date(Date.now() - DAY_MS) }))
      );

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'nouveau-slug' } }), res);

      expect(res.statusCode).toBe(403);
      expect(res.body.reason).toBe('SLUG_LOCKED');
      expect(DomainService.checkSlugAvailable).not.toHaveBeenCalled();
    });

    test('409 with a suggestion when the slug is taken', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: false,
        slug: 'pris',
        reason: 'SLUG_TAKEN',
        message: 'This slug is already taken',
        suggestion: 'pris-2',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'pris' } }), res);

      expect(res.statusCode).toBe(409);
      expect(res.body.suggestion).toBe('pris-2');
    });

    test('409 when the slug is reserved', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: false,
        slug: 'admin',
        reason: 'SLUG_RESERVED',
        message: 'This slug is reserved',
        suggestion: 'admin-2',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'admin' } }), res);

      expect(res.statusCode).toBe(409);
    });

    test('400 on a malformed slug, not 409', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: false,
        slug: 'ab',
        reason: 'SLUG_TOO_SHORT',
        message: 'Slug must be at least 3 characters long',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'ab' } }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.reason).toBe('SLUG_TOO_SHORT');
    });

    test('409 when the unique index rejects a concurrent write', async () => {
      const domain = buildDomain({
        save: jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 })),
      });
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
      DomainService.checkSlugAvailable.mockResolvedValue({ available: true, slug: 'nouveau' });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'nouveau' } }), res);

      expect(res.statusCode).toBe(409);
      expect(res.body.reason).toBe('SLUG_TAKEN');
    });

    test('403 for a non-artisan account', async () => {
      const res = buildRes();
      await updateMyDomain(
        buildReq({ user: { _id: 'e1', role: 'expert' }, body: { slug: 'x' } }),
        res
      );

      expect(res.statusCode).toBe(403);
    });

    test('500 on an unexpected error', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockRejectedValue(new Error('Mongo down'));

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisan, body: { slug: 'x' } }), res);

      expect(res.statusCode).toBe(500);
    });
  });
});
