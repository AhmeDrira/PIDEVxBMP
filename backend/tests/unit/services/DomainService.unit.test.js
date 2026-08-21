const { chainableQuery } = require('../../http.mock');

jest.mock('../../../models/ArtisanDomain', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

const ArtisanDomain = require('../../../models/ArtisanDomain');
const service = require('../../../services/DomainService');
const { validateSlug, SLUG_ERRORS } = require('../../../utils/slugRules');

/** Simule la requête de suggestAlternative : les slugs déjà pris sous une racine. */
const mockExistingSlugs = (slugs) =>
  ArtisanDomain.find.mockReturnValue(chainableQuery(slugs.map((slug) => ({ slug }))));

/** Simule la recherche d'unicité : le document trouvé, ou null. */
const mockFindOne = (doc) => ArtisanDomain.findOne.mockReturnValue(chainableQuery(doc));

describe('DomainService', () => {
  const originalBaseDomain = process.env.MINI_SITE_BASE_DOMAIN;

  beforeEach(() => {
    delete process.env.MINI_SITE_BASE_DOMAIN;
    mockExistingSlugs([]);
    mockFindOne(null);
  });

  afterAll(() => {
    if (originalBaseDomain === undefined) delete process.env.MINI_SITE_BASE_DOMAIN;
    else process.env.MINI_SITE_BASE_DOMAIN = originalBaseDomain;
  });

  describe('generateSlug', () => {
    test('builds prenom-metier-ville and strips accents', () => {
      expect(service.generateSlug('Hamza', 'Électricien', 'Tunis')).toBe('hamza-electricien-tunis');
    });

    test('falls back to the name alone when metier and ville are empty', () => {
      // Cas réel à l'inscription : `domain` et `location` valent ''.
      expect(service.generateSlug('Hamza', '', '')).toBe('hamza');
      expect(service.generateSlug('Hamza')).toBe('hamza');
      expect(service.generateSlug('Hamza', null, undefined)).toBe('hamza');
    });

    test('collapses spaces and punctuation into single hyphens', () => {
      expect(service.generateSlug('Mohamed  Ali', 'Plomberie', 'Ben Arous'))
        .toBe('mohamed-ali-plomberie-ben-arou');
      expect(service.generateSlug("O'Brien", '', '')).toBe('o-brien');
    });

    test('never exceeds the maximum length, and never ends on a hyphen', () => {
      const slug = service.generateSlug('Jean-Christophe', 'Foundation Construction', 'Sidi Bouzid');

      expect(slug.length).toBeLessThanOrEqual(30);
      expect(slug.endsWith('-')).toBe(false);
    });

    test('pads a too-short name with a random suffix', () => {
      const slug = service.generateSlug('Al', '', '');

      expect(slug).toMatch(/^al-[0-9a-f]{4}$/);
      expect(slug.length).toBeGreaterThanOrEqual(3);
    });

    test('falls back to a generic slug when nothing latin remains', () => {
      // Un nom entièrement en arabe ne produit aucun caractère [a-z0-9].
      expect(service.generateSlug('حمزة', '', '')).toMatch(/^artisan-[0-9a-f]{4}$/);
      expect(service.generateSlug('', '', '')).toMatch(/^artisan-[0-9a-f]{4}$/);
    });

    test('always returns a slug accepted by validateSlug', () => {
      const inputs = [
        ['Hamza', 'Électricien', 'Tunis'],
        ['Al', '', ''],
        ['حمزة', '', ''],
        ['', '', ''],
        ['Jean-Christophe', 'Foundation Construction', 'Sidi Bouzid'],
        ['   ', '   ', '   '],
        ['---', '', ''],
      ];

      inputs.forEach((args) => {
        const slug = service.generateSlug(...args);
        expect(validateSlug(slug)).toEqual({ valid: true, slug });
      });
    });

    test('does not hit the database', () => {
      service.generateSlug('Hamza', 'Électricien', 'Tunis');

      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
      expect(ArtisanDomain.find).not.toHaveBeenCalled();
    });
  });

  describe('checkSlugAvailable', () => {
    test('accepts a well-formed, free, non-reserved slug', async () => {
      await expect(service.checkSlugAvailable('hamza-ayachi')).resolves.toEqual({
        available: true,
        slug: 'hamza-ayachi',
      });
      expect(ArtisanDomain.findOne).toHaveBeenCalledWith({ slug: 'hamza-ayachi' });
    });

    test('normalizes the input before looking it up', async () => {
      await expect(service.checkSlugAvailable('  Hamza-AYACHI ')).resolves.toEqual({
        available: true,
        slug: 'hamza-ayachi',
      });
    });

    test('rejects an invalid format without touching the database', async () => {
      const result = await service.checkSlugAvailable('hamza--ayachi');

      expect(result.available).toBe(false);
      expect(result.reason).toBe(SLUG_ERRORS.DOUBLE_HYPHEN);
      expect(result.suggestion).toBeUndefined();
      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
    });

    test('rejects a reserved slug and proposes an alternative', async () => {
      const result = await service.checkSlugAvailable('admin');

      expect(result.available).toBe(false);
      expect(result.reason).toBe(service.RESERVED_REASON);
      expect(result.suggestion).toBe('admin-2');
    });

    test('rejects a reserved trade name', async () => {
      const result = await service.checkSlugAvailable('electricien');

      expect(result.available).toBe(false);
      expect(result.reason).toBe(service.RESERVED_REASON);
    });

    test('rejects a slug already taken and proposes the next free number', async () => {
      mockFindOne({ artisanId: 'artisan-1' });
      mockExistingSlugs(['hamza-ayachi', 'hamza-ayachi-2', 'hamza-ayachi-3']);

      const result = await service.checkSlugAvailable('hamza-ayachi');

      expect(result.available).toBe(false);
      expect(result.reason).toBe(service.TAKEN_REASON);
      expect(result.suggestion).toBe('hamza-ayachi-4');
    });

    test('lets an artisan keep their own slug', async () => {
      mockFindOne({ artisanId: 'artisan-1' });

      await expect(
        service.checkSlugAvailable('hamza-ayachi', { excludeArtisanId: 'artisan-1' })
      ).resolves.toEqual({ available: true, slug: 'hamza-ayachi' });
    });

    test('still rejects a slug owned by somebody else', async () => {
      mockFindOne({ artisanId: 'artisan-2' });

      const result = await service.checkSlugAvailable('hamza-ayachi', {
        excludeArtisanId: 'artisan-1',
      });

      expect(result.available).toBe(false);
      expect(result.reason).toBe(service.TAKEN_REASON);
    });

    test('every rejection carries a human-readable message', async () => {
      mockFindOne({ artisanId: 'other' });

      const results = await Promise.all([
        service.checkSlugAvailable('ab'),
        service.checkSlugAvailable('admin'),
        service.checkSlugAvailable('hamza-ayachi'),
      ]);

      results.forEach((result) => {
        expect(result.available).toBe(false);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('suggestAlternative', () => {
    test('starts at -2 when nothing is taken', async () => {
      await expect(service.suggestAlternative('hamza')).resolves.toBe('hamza-2');
    });

    test('skips numbers already in use', async () => {
      mockExistingSlugs(['hamza-2', 'hamza-3', 'hamza-5']);

      await expect(service.suggestAlternative('hamza')).resolves.toBe('hamza-4');
    });

    test('never proposes a reserved slug', async () => {
      // `ns2` n'est pas réservé, mais la mécanique doit sauter ceux qui le sont.
      const suggestion = await service.suggestAlternative('hamza');

      expect(suggestion).not.toBe('hamza');
      expect(validateSlug(suggestion).valid).toBe(true);
    });

    test('keeps the suggestion within the maximum length', async () => {
      const suggestion = await service.suggestAlternative('a'.repeat(30));

      expect(suggestion.length).toBeLessThanOrEqual(30);
      expect(validateSlug(suggestion).valid).toBe(true);
    });

    test('uses a single database query, not one per candidate', async () => {
      mockExistingSlugs(['hamza-2', 'hamza-3', 'hamza-4', 'hamza-5', 'hamza-6']);

      await service.suggestAlternative('hamza');

      expect(ArtisanDomain.find).toHaveBeenCalledTimes(1);
    });

    test('falls back to a random suffix when the first 98 numbers are taken', async () => {
      mockExistingSlugs(Array.from({ length: 98 }, (unused, i) => `hamza-${i + 2}`));

      const suggestion = await service.suggestAlternative('hamza');

      expect(suggestion).toMatch(/^hamza-[0-9a-f]{4}$/);
    });
  });

  describe('ensureDomainForArtisan', () => {
    const buildArtisan = (overrides = {}) => ({
      _id: 'artisan-1',
      role: 'artisan',
      firstName: 'Hamza',
      lastName: 'Ayachi',
      domain: '',
      location: '',
      ...overrides,
    });

    const duplicateKeyError = (keyPattern) =>
      Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern });

    beforeEach(() => {
      ArtisanDomain.create.mockImplementation(async (doc) => ({ ...doc }));
    });

    test('creates prenom-nom at registration, when domain and location are empty', async () => {
      const result = await service.ensureDomainForArtisan(buildArtisan());

      expect(ArtisanDomain.create).toHaveBeenCalledWith({
        artisanId: 'artisan-1',
        slug: 'hamza-ayachi',
      });
      expect(result.slug).toBe('hamza-ayachi');
    });

    test('uses prenom-metier-ville once the profile is filled in', async () => {
      await service.ensureDomainForArtisan(
        buildArtisan({ domain: 'Plomberie', location: 'Tunis' })
      );

      expect(ArtisanDomain.create).toHaveBeenCalledWith({
        artisanId: 'artisan-1',
        slug: 'hamza-plomberie-tunis',
      });
    });

    test('a long metier-ville pair is truncated without a trailing hyphen', async () => {
      // 'hamza-electrical-installation-tunis' fait 35 caractères.
      const result = await service.ensureDomainForArtisan(
        buildArtisan({ domain: 'Electrical Installation', location: 'Tunis' })
      );

      expect(result.slug).toBe('hamza-electrical-installation');
      expect(result.slug.length).toBeLessThanOrEqual(30);
    });

    test('is idempotent: an existing mini site is returned untouched', async () => {
      const existing = { slug: 'deja-la', artisanId: 'artisan-1' };
      mockFindOne(existing);

      await expect(service.ensureDomainForArtisan(buildArtisan())).resolves.toBe(existing);
      expect(ArtisanDomain.create).not.toHaveBeenCalled();
    });

    test('falls back to a suffixed slug when the name is already taken', async () => {
      ArtisanDomain.findOne
        .mockReturnValueOnce(chainableQuery(null)) // pas de mini site pour cet artisan
        .mockReturnValueOnce(chainableQuery({ artisanId: 'someone-else' })); // slug pris
      mockExistingSlugs(['hamza-ayachi']);

      const result = await service.ensureDomainForArtisan(buildArtisan());

      expect(result.slug).toBe('hamza-ayachi-2');
    });

    test('retries with a random suffix when the unique index rejects the slug', async () => {
      // Course entre deux inscriptions simultanées sur le même slug.
      ArtisanDomain.create
        .mockRejectedValueOnce(duplicateKeyError({ slug: 1 }))
        .mockImplementationOnce(async (doc) => ({ ...doc }));

      const result = await service.ensureDomainForArtisan(buildArtisan());

      expect(ArtisanDomain.create).toHaveBeenCalledTimes(2);
      expect(result.slug).toMatch(/^hamza-ayachi-[0-9a-f]{4}$/);
    });

    test('returns the concurrently created mini site when artisanId collides', async () => {
      const concurrent = { slug: 'hamza-ayachi', artisanId: 'artisan-1' };
      ArtisanDomain.findOne
        .mockReturnValueOnce(chainableQuery(null))
        .mockReturnValueOnce(chainableQuery(null))
        .mockReturnValueOnce(chainableQuery(concurrent));
      ArtisanDomain.create.mockRejectedValueOnce(duplicateKeyError({ artisanId: 1 }));

      await expect(service.ensureDomainForArtisan(buildArtisan())).resolves.toBe(concurrent);
    });

    test('propagates a non-duplicate database error', async () => {
      ArtisanDomain.create.mockRejectedValue(new Error('Mongo down'));

      await expect(service.ensureDomainForArtisan(buildArtisan())).rejects.toThrow('Mongo down');
    });

    test('ignores anything that is not an artisan', async () => {
      await expect(service.ensureDomainForArtisan(null)).resolves.toBeNull();
      await expect(service.ensureDomainForArtisan({ _id: 'x' })).resolves.toBeNull();
      await expect(
        service.ensureDomainForArtisan(buildArtisan({ role: 'expert' }))
      ).resolves.toBeNull();
      expect(ArtisanDomain.create).not.toHaveBeenCalled();
    });

    test('produces a slug that always passes validateSlug', async () => {
      const artisans = [
        buildArtisan({ firstName: 'حمزة', lastName: 'العياشي' }),
        buildArtisan({ firstName: 'Al', lastName: 'B' }),
        buildArtisan({ firstName: 'Jean-Christophe', lastName: 'De La Fontaine-Dupont' }),
      ];

      for (const artisan of artisans) {
        ArtisanDomain.create.mockImplementationOnce(async (doc) => ({ ...doc }));
        const result = await service.ensureDomainForArtisan(artisan);
        expect(validateSlug(result.slug)).toEqual({ valid: true, slug: result.slug });
      }
    });
  });

  describe('extractSlugFromHost -> without MINI_SITE_BASE_DOMAIN', () => {
    test.each([
      ['hamza-electricien-tunis.mestra.tn', 'hamza-electricien-tunis'],
      ['hamza.mestra.tn', 'hamza'],
      ['HAMZA.MESTRA.TN', 'hamza'],
      ['  hamza.mestra.tn  ', 'hamza'],
      ['hamza.localhost:5000', 'hamza'],
      ['hamza.localhost', 'hamza'],
    ])('%s -> %s', (host, expected) => {
      expect(service.extractSlugFromHost(host)).toBe(expected);
    });

    test.each([
      ['mestra.tn'],
      ['localhost'],
      ['localhost:3000'],
      ['127.0.0.1:5000'],
      ['[::1]:5000'],
      ['ab.mestra.tn'],
      ['hamza_x.mestra.tn'],
      [''],
      ['   '],
      [undefined],
      [null],
      [42],
    ])('%p -> null', (host) => {
      expect(service.extractSlugFromHost(host)).toBeNull();
    });

    test('reserved subdomains never resolve to a mini site', () => {
      ['www', 'api', 'app', 'admin', 'mail', 'cdn'].forEach((label) => {
        expect(service.extractSlugFromHost(`${label}.mestra.tn`)).toBeNull();
      });
    });
  });

  describe('extractSlugFromHost -> with MINI_SITE_BASE_DOMAIN', () => {
    beforeEach(() => {
      process.env.MINI_SITE_BASE_DOMAIN = 'mestra.tn';
    });

    test('accepts a single-label subdomain of the configured domain', () => {
      expect(service.extractSlugFromHost('hamza.mestra.tn')).toBe('hamza');
    });

    test('rejects a host outside the configured domain', () => {
      expect(service.extractSlugFromHost('hamza.autre-site.tn')).toBeNull();
      expect(service.extractSlugFromHost('hamza.bmp.tn')).toBeNull();
    });

    test('rejects a nested subdomain', () => {
      expect(service.extractSlugFromHost('a.hamza.mestra.tn')).toBeNull();
    });

    test('rejects the bare domain itself', () => {
      expect(service.extractSlugFromHost('mestra.tn')).toBeNull();
    });

    test('still accepts *.localhost for local testing', () => {
      expect(service.extractSlugFromHost('hamza.localhost:5000')).toBe('hamza');
    });
  });

  describe('buildMiniSiteUrl', () => {
    test('uses the configured base domain in https', () => {
      process.env.MINI_SITE_BASE_DOMAIN = 'bmp.tn';

      expect(service.buildMiniSiteUrl('hamza-ayachi')).toBe('https://hamza-ayachi.bmp.tn');
      expect(service.buildMiniSiteUrl('hamza-ayachi', 'hamza-ayachi.bmp.tn'))
        .toBe('https://hamza-ayachi.bmp.tn');
    });

    test('keeps a clickable localhost link while developing', () => {
      // bmp.tn n'est pas joignable depuis un poste de dev : le lien affiché dans
      // le profil artisan doit rester utilisable.
      process.env.MINI_SITE_BASE_DOMAIN = 'bmp.tn';

      ['localhost:3000', 'hamza-ayachi.localhost:5000', '127.0.0.1:5000', 'localhost']
        .forEach((host) => {
          expect(service.buildMiniSiteUrl('hamza-ayachi', host))
            .toBe('http://hamza-ayachi.localhost:5000');
        });
    });

    test('always points at the backend port, never the caller port', () => {
      // Le front dev tourne sur 3000 (Vite), mais c'est Express qui rend les mini sites.
      process.env.MINI_SITE_BASE_DOMAIN = 'bmp.tn';
      process.env.PORT = '5000';

      expect(service.buildMiniSiteUrl('hamza-ayachi', 'localhost:3000'))
        .toBe('http://hamza-ayachi.localhost:5000');
    });

    test('falls back to localhost when no base domain is configured', () => {
      delete process.env.MINI_SITE_BASE_DOMAIN;

      expect(service.buildMiniSiteUrl('hamza-ayachi')).toBe('http://hamza-ayachi.localhost:5000');
    });
  });

  describe('buildWhatsAppUrl', () => {
    test('prefixes the Tunisian country code on an 8-digit local number', () => {
      expect(service.buildWhatsAppUrl('56775302')).toBe('https://wa.me/21656775302');
      expect(service.buildWhatsAppUrl('56 77 53 02')).toBe('https://wa.me/21656775302');
    });

    test('keeps an already international number', () => {
      expect(service.buildWhatsAppUrl('+216 56 775 302')).toBe('https://wa.me/21656775302');
      expect(service.buildWhatsAppUrl('0033612345678')).toBe('https://wa.me/0033612345678');
    });

    test('returns null when the number is missing or unusable', () => {
      // Le téléphone n'est pas obligatoire à l'inscription : le CTA sera masqué.
      [null, undefined, '', '   ', '12345', 'abc'].forEach((input) => {
        expect(service.buildWhatsAppUrl(input)).toBeNull();
      });
    });
  });

  describe('buildPublicProfile', () => {
    const artisan = {
      _id: 'artisan-1',
      firstName: 'Hamza',
      lastName: 'Ayachi',
      email: 'hamza@example.com',
      password: 'hashed',
      faceDescriptor: [1, 2, 3],
      subscription: { planId: 'pro' },
      status: 'active',
      isVerified: true,
      role: 'artisan',
      domain: 'Painting',
      location: 'Ariana',
      bio: 'Peintre depuis 10 ans',
      phone: '56775302',
      profilePhoto: 'data:image/png;base64,AAA',
      yearsExperience: 10,
      skills: ['enduit'],
      certifications: ['ONAT'],
      portfolio: [
        {
          title: 'Villa',
          description: 'Peinture complete',
          location: 'Ariana',
          completedDate: null,
          media: [{ type: 'image', url: '/uploads/a.jpg' }],
        },
      ],
    };
    const domain = { slug: 'hamza-ayachi' };

    test('maps the plan sections onto the real schema fields', () => {
      const profile = service.buildPublicProfile(artisan, domain);

      expect(profile).toEqual(
        expect.objectContaining({
          slug: 'hamza-ayachi',
          fullName: 'Hamza Ayachi',
          domain: 'Painting',            // métier
          location: 'Ariana',            // zone d'intervention
          bio: 'Peintre depuis 10 ans',  // description
          whatsappUrl: 'https://wa.me/21656775302',
        })
      );
    });

    test('never exposes private fields', () => {
      const profile = service.buildPublicProfile(artisan, domain);

      [
        'email', 'password', 'faceDescriptor', 'subscription', 'status',
        'isVerified', 'role', '_id', 'verificationToken', 'resetPasswordToken',
      ].forEach((field) => {
        expect(profile).not.toHaveProperty(field);
      });
    });

    test('exposes the portfolio media (galerie active dès le MVP)', () => {
      const profile = service.buildPublicProfile(artisan, domain);

      expect(profile.portfolio).toHaveLength(1);
      expect(profile.portfolio[0]).toEqual({
        title: 'Villa',
        description: 'Peinture complete',
        location: 'Ariana',
        completedDate: null,
        media: [{ type: 'image', url: '/uploads/a.jpg' }],
      });
    });

    test('computes the review average and the author name', () => {
      const reviews = [
        { rating: 5, comment: 'Top', createdAt: 'd1', expert: { firstName: 'Sonia', lastName: 'B' } },
        { rating: 4, comment: '', createdAt: 'd2', expert: null },
      ];

      const profile = service.buildPublicProfile(artisan, domain, { reviews });

      expect(profile.reviews.count).toBe(2);
      expect(profile.reviews.rating).toBe(4.5);
      expect(profile.reviews.items[0].author).toBe('Sonia B');
      expect(profile.reviews.items[1].author).toBe('');
    });

    test('degrades cleanly on an empty profile', () => {
      const profile = service.buildPublicProfile(
        { firstName: 'Hamza', lastName: 'Ayachi' },
        domain
      );

      expect(profile.domain).toBe('');
      expect(profile.bio).toBe('');
      expect(profile.phone).toBe('');
      expect(profile.whatsappUrl).toBeNull();
      expect(profile.portfolio).toEqual([]);
      expect(profile.reviews).toEqual({ count: 0, rating: 0, items: [] });
    });
  });

  describe('resolveBySlug', () => {
    const artisan = { _id: 'a1', role: 'artisan', status: 'active' };

    test('returns artisan and domain for an active artisan', async () => {
      const domain = { slug: 'hamza-ayachi', artisanId: artisan };
      mockFindOne(domain);

      await expect(service.resolveBySlug('hamza-ayachi')).resolves.toEqual({ artisan, domain });
    });

    test('normalizes the slug before the lookup', async () => {
      mockFindOne({ slug: 'hamza-ayachi', artisanId: artisan });

      await service.resolveBySlug('  Hamza-AYACHI ');

      expect(ArtisanDomain.findOne).toHaveBeenCalledWith({ slug: 'hamza-ayachi' });
    });

    test('returns null on a malformed slug, without querying', async () => {
      await expect(service.resolveBySlug('ab')).resolves.toBeNull();
      await expect(service.resolveBySlug('a--b')).resolves.toBeNull();
      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
    });

    test('returns null for a suspended or non-artisan account', async () => {
      mockFindOne({ slug: 's', artisanId: { role: 'artisan', status: 'suspended' } });
      await expect(service.resolveBySlug('hamza-ayachi')).resolves.toBeNull();

      mockFindOne({ slug: 's', artisanId: { role: 'expert', status: 'active' } });
      await expect(service.resolveBySlug('hamza-ayachi')).resolves.toBeNull();
    });
  });

  describe('resolveArtisan', () => {
    const buildArtisan = (overrides = {}) => ({
      _id: 'artisan-1',
      firstName: 'Hamza',
      role: 'artisan',
      status: 'active',
      ...overrides,
    });

    test('returns the artisan behind a valid subdomain', async () => {
      const artisan = buildArtisan();
      mockFindOne({ slug: 'hamza', artisanId: artisan });

      await expect(service.resolveArtisan('hamza.mestra.tn')).resolves.toBe(artisan);
      expect(ArtisanDomain.findOne).toHaveBeenCalledWith({ slug: 'hamza' });
    });

    test('returns null without querying when the host carries no slug', async () => {
      await expect(service.resolveArtisan('app.bmp.tn')).resolves.toBeNull();
      expect(ArtisanDomain.findOne).not.toHaveBeenCalled();
    });

    test('returns null when no mini site matches the slug', async () => {
      mockFindOne(null);

      await expect(service.resolveArtisan('inconnu.mestra.tn')).resolves.toBeNull();
    });

    test('returns null when the domain points at a deleted artisan', async () => {
      mockFindOne({ slug: 'hamza', artisanId: null });

      await expect(service.resolveArtisan('hamza.mestra.tn')).resolves.toBeNull();
    });

    test('a suspended artisan has no public mini site', async () => {
      mockFindOne({ slug: 'hamza', artisanId: buildArtisan({ status: 'suspended' }) });

      await expect(service.resolveArtisan('hamza.mestra.tn')).resolves.toBeNull();
    });

    test('a non-artisan account has no mini site', async () => {
      mockFindOne({ slug: 'hamza', artisanId: buildArtisan({ role: 'expert' }) });

      await expect(service.resolveArtisan('hamza.mestra.tn')).resolves.toBeNull();
    });
  });
});
