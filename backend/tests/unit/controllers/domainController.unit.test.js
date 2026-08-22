const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../services/DomainService', () => ({
  checkSlugAvailable: jest.fn(),
  resolveBySlug: jest.fn(),
  buildPublicProfile: jest.fn(() => ({ slug: 'hamza-ayachi', fullName: 'Hamza Ayachi' })),
  ensureDomainForArtisan: jest.fn(),
  generateSlug: jest.fn(),
  buildMiniSiteUrl: jest.fn((slug) => `https://${slug}.bmp.tn`),
  RESERVED_REASON: 'SLUG_RESERVED',
  TAKEN_REASON: 'SLUG_TAKEN',
}));

jest.mock('../../../models/ArtisanDomain', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../models/Review', () => ({
  find: jest.fn(),
}));

const DomainService = require('../../../services/DomainService');
const Review = require('../../../models/Review');
const ArtisanDomain = require('../../../models/ArtisanDomain');
const {
  checkSlug,
  getPublicArtisan,
  getMyDomain,
  updateMyDomain,
} = require('../../../controllers/domainController');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('domainController.checkSlug', () => {
  it('should return 200 with the availability payload', async () => {
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

  it('should forward the suggestion when the slug is taken', async () => {
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

  it('should answer 200 even for an invalid slug, never a 4xx', async () => {
    // Appele a chaque frappe : `ha` est un etat intermediaire normal, pas une erreur.
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
  });

  it('should delegate a missing slug parameter to the service', async () => {
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
  });

  it('should return 500 when the service throws', async () => {
    DomainService.checkSlugAvailable.mockRejectedValue(new Error('Mongo down'));

    const res = buildRes();
    await checkSlug(buildReq({ query: { slug: 'hamza-ayachi' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Server error', error: 'Mongo down' });
  });
});

describe('domainController.getPublicArtisan', () => {
  const artisan = { _id: 'artisan-1', role: 'artisan', status: 'active' };
  const domain = { slug: 'hamza-ayachi' };

  beforeEach(() => {
    Review.find.mockReturnValue(chainableQuery([]));
  });

  it('should return the public profile for a known slug', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' } }), res);

    expect(DomainService.resolveBySlug).toHaveBeenCalledWith('hamza-ayachi');
    expect(res.statusCode).toBe(200);
    expect(res.body.fullName).toBe('Hamza Ayachi');
  });

  it('should pass the artisan reviews to the profile builder', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });
    const reviews = [{ rating: 5, comment: 'Top' }];
    Review.find.mockReturnValue(chainableQuery(reviews));

    await getPublicArtisan(
      buildReq({ params: { slug: 'hamza-ayachi' }, headers: { host: 'hamza-ayachi.bmp.tn' } }),
      buildRes()
    );

    expect(Review.find).toHaveBeenCalledWith({ artisan: 'artisan-1' });
    expect(DomainService.buildPublicProfile).toHaveBeenCalledWith(artisan, domain, {
      reviews,
      requestHost: 'hamza-ayachi.bmp.tn',
    });
  });

  it('should return 404 when the slug matches no mini site', async () => {
    DomainService.resolveBySlug.mockResolvedValue(null);

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'inconnu' } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Artisan not found' });
    expect(Review.find).not.toHaveBeenCalled();
  });

  it('should require no authentication', async () => {
    DomainService.resolveBySlug.mockResolvedValue({ artisan, domain });

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' }, user: null }), res);

    expect(res.statusCode).toBe(200);
  });

  it('should return 500 on an unexpected error', async () => {
    DomainService.resolveBySlug.mockRejectedValue(new Error('Mongo down'));

    const res = buildRes();
    await getPublicArtisan(buildReq({ params: { slug: 'hamza-ayachi' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('domainController — mini site of the logged-in artisan', () => {
  const artisanUser = { _id: 'artisan-1', role: 'artisan' };

  const buildDomain = (overrides = {}) => ({
    slug: 'hamza-ayachi',
    lockedAt: new Date(Date.now() + 10 * DAY_MS),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    ArtisanDomain.findOne.mockReturnValue(chainableQuery(null));
    DomainService.ensureDomainForArtisan.mockResolvedValue(null);
    // Par defaut : profil incomplet, donc aucune suggestion.
    DomainService.generateSlug.mockReturnValue('hamza-painting-ariana');
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: true,
      slug: 'hamza-painting-ariana',
    });
  });

  describe('getMyDomain', () => {
    it('should return slug, public url and remaining days', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisanUser }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          slug: 'hamza-ayachi',
          url: 'https://hamza-ayachi.bmp.tn',
          daysRemaining: 10,
          editable: true,
        })
      );
    });

    it('should report a locked mini site', async () => {
      ArtisanDomain.findOne.mockReturnValue(
        chainableQuery(buildDomain({ lockedAt: new Date(Date.now() - DAY_MS) }))
      );

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisanUser }), res);

      expect(res.body.editable).toBe(false);
      expect(res.body.daysRemaining).toBe(0);
    });

    it('should create the mini site on the fly for an artisan who has none', async () => {
      DomainService.ensureDomainForArtisan.mockResolvedValue(buildDomain({ slug: 'rattrape' }));

      const res = buildRes();
      await getMyDomain(buildReq({ user: artisanUser }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.slug).toBe('rattrape');
    });

    it('should return 403 for a non-artisan account', async () => {
      const res = buildRes();
      await getMyDomain(buildReq({ user: { _id: 'e1', role: 'expert' } }), res);

      expect(res.statusCode).toBe(403);
      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateMyDomain', () => {
    it('should save a valid, free slug', async () => {
      const domain = buildDomain();
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: true,
        slug: 'hamza-electricien-tunis',
      });

      const res = buildRes();
      await updateMyDomain(
        buildReq({ user: artisanUser, body: { slug: 'hamza-electricien-tunis' } }),
        res
      );

      expect(DomainService.checkSlugAvailable).toHaveBeenCalledWith('hamza-electricien-tunis', {
        excludeArtisanId: 'artisan-1',
      });
      expect(domain.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should not write when the slug is unchanged', async () => {
      const domain = buildDomain();
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: true,
        slug: 'hamza-ayachi',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisanUser, body: { slug: 'hamza-ayachi' } }), res);

      expect(domain.save).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should return 403 once the slug is locked, without checking availability', async () => {
      ArtisanDomain.findOne.mockReturnValue(
        chainableQuery(buildDomain({ lockedAt: new Date(Date.now() - DAY_MS) }))
      );

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisanUser, body: { slug: 'nouveau-slug' } }), res);

      expect(res.statusCode).toBe(403);
      expect(res.body.reason).toBe('SLUG_LOCKED');
      expect(DomainService.checkSlugAvailable).not.toHaveBeenCalled();
    });

    it('should return 409 with a suggestion when the slug is taken', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: false,
        slug: 'pris',
        reason: 'SLUG_TAKEN',
        message: 'This slug is already taken',
        suggestion: 'pris-2',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisanUser, body: { slug: 'pris' } }), res);

      expect(res.statusCode).toBe(409);
      expect(res.body.suggestion).toBe('pris-2');
    });

    it('should return 400 on a malformed slug, not 409', async () => {
      ArtisanDomain.findOne.mockReturnValue(chainableQuery(buildDomain()));
      DomainService.checkSlugAvailable.mockResolvedValue({
        available: false,
        slug: 'ab',
        reason: 'SLUG_TOO_SHORT',
        message: 'Slug must be at least 3 characters long',
      });

      const res = buildRes();
      await updateMyDomain(buildReq({ user: artisanUser, body: { slug: 'ab' } }), res);

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 for a non-artisan account', async () => {
      const res = buildRes();
      await updateMyDomain(
        buildReq({ user: { _id: 'e1', role: 'expert' }, body: { slug: 'x' } }),
        res
      );

      expect(res.statusCode).toBe(403);
    });
  });
});

describe('domainController — suggested slug', () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** Artisan au profil complet : metier ET zone renseignes. */
  const completeArtisan = (overrides = {}) => ({
    _id: 'artisan-1',
    role: 'artisan',
    firstName: 'Hamza',
    domain: 'Painting',
    location: 'Ariana',
    ...overrides,
  });

  const buildDomain = (overrides = {}) => ({
    slug: 'hamza-ayachi',
    lockedAt: new Date(Date.now() + 10 * DAY),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const getFor = async (user, domain) => {
    ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
    const res = buildRes();
    await getMyDomain(buildReq({ user }), res);
    return res;
  };

  beforeEach(() => {
    DomainService.generateSlug.mockReturnValue('hamza-painting-ariana');
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: true,
      slug: 'hamza-painting-ariana',
    });
  });

  it('should suggest prenom-metier-ville when the profile is complete', async () => {
    const res = await getFor(completeArtisan(), buildDomain());

    expect(DomainService.generateSlug).toHaveBeenCalledWith('Hamza', 'Painting', 'Ariana');
    expect(res.body.suggestedSlug).toBe('hamza-painting-ariana');
  });

  it('should suggest nothing when the trade is missing', async () => {
    const res = await getFor(completeArtisan({ domain: '' }), buildDomain());

    expect(res.body.suggestedSlug).toBeNull();
    expect(DomainService.generateSlug).not.toHaveBeenCalled();
  });

  it('should suggest nothing when the area is missing', async () => {
    const res = await getFor(completeArtisan({ location: '' }), buildDomain());

    expect(res.body.suggestedSlug).toBeNull();
    expect(DomainService.generateSlug).not.toHaveBeenCalled();
  });

  it('should suggest nothing when the slug already matches the suggestion', async () => {
    const res = await getFor(completeArtisan(), buildDomain({ slug: 'hamza-painting-ariana' }));

    expect(res.body.suggestedSlug).toBeNull();
  });

  it('should suggest nothing once the 30-day window has passed', async () => {
    // Proposer un changement impossible serait trompeur.
    const res = await getFor(
      completeArtisan(),
      buildDomain({ lockedAt: new Date(Date.now() - DAY) })
    );

    expect(res.body.suggestedSlug).toBeNull();
    expect(DomainService.generateSlug).not.toHaveBeenCalled();
  });

  it('should suggest nothing when the candidate is already taken', async () => {
    // Sinon « Adopter » renverrait un 409 a l'artisan.
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: false,
      slug: 'hamza-painting-ariana',
      reason: 'SLUG_TAKEN',
    });

    const res = await getFor(completeArtisan(), buildDomain());

    expect(res.body.suggestedSlug).toBeNull();
  });

  it('should let the artisan keep their own slug while checking availability', async () => {
    await getFor(completeArtisan(), buildDomain());

    expect(DomainService.checkSlugAvailable).toHaveBeenCalledWith('hamza-painting-ariana', {
      excludeArtisanId: 'artisan-1',
    });
  });

  it('should clear the suggestion right after it has been adopted', async () => {
    const domain = buildDomain();
    ArtisanDomain.findOne.mockReturnValue(chainableQuery(domain));
    DomainService.checkSlugAvailable.mockResolvedValue({
      available: true,
      slug: 'hamza-painting-ariana',
    });

    const res = buildRes();
    await updateMyDomain(
      buildReq({ user: completeArtisan(), body: { slug: 'hamza-painting-ariana' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe('hamza-painting-ariana');
    // Le slug vaut desormais la suggestion : la banniere doit disparaitre.
    expect(res.body.suggestedSlug).toBeNull();
  });
});
