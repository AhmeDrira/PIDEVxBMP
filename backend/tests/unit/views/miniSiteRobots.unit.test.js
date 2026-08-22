const path = require('path');
const ejs = require('ejs');

/**
 * Rend le VRAI template views/miniSite.ejs pour verrouiller la regle d'indexation :
 * un profil incomplet ne doit pas etre reference par Google, mais reste accessible
 * par lien direct.
 */

const TEMPLATE = path.join(__dirname, '..', '..', '..', 'views', 'miniSite.ejs');

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
  avatar: 'data:image/svg+xml;base64,AAA',
  yearsExperience: null,
  skills: [],
  certifications: [],
  phone: '',
  whatsappUrl: null,
  portfolio: [],
  reviews: { count: 0, rating: 0, items: [] },
  ...overrides,
});

const baseMeta = {
  title: 'Hamza Ayachi — Painting',
  description: 'Painting — Ariana',
  url: 'https://hamza-ayachi.bmp.tn',
  host: 'hamza-ayachi.bmp.tn',
  image: 'https://hamza-ayachi.bmp.tn/site/hamza-ayachi/share.png',
  imageWidth: 1200,
  imageHeight: 630,
  avatarPath: '/site/hamza-ayachi/avatar.svg',
  appUrl: 'http://localhost:3000',
};

const render = (profileOverrides = {}) =>
  ejs.renderFile(TEMPLATE, {
    profile: baseProfile(profileOverrides),
    stats: [],
    meta: baseMeta,
  });

const hasNoindex = (html) => /<meta\s+name="robots"\s+content="noindex, nofollow">/.test(html);

describe('miniSite.ejs — conditional noindex', () => {
  it('should not add a robots tag when trade and area are both filled in', async () => {
    const html = await render({ domain: 'Painting', location: 'Ariana' });

    expect(hasNoindex(html)).toBe(false);
    expect(html).not.toContain('name="robots"');
  });

  it.each([
    ['no trade', { domain: '', location: 'Ariana' }],
    ['no area', { domain: 'Painting', location: '' }],
    ['neither', { domain: '', location: '' }],
  ])('should add noindex when there is %s', async (unused, overrides) => {
    const html = await render(overrides);

    expect(hasNoindex(html)).toBe(true);
  });

  it('should keep the page fully rendered even when noindex is set', async () => {
    // L'indexation change, pas l'accessibilite : le lien direct doit continuer
    // d'afficher un vrai mini site.
    const html = await render({ domain: '', location: '' });

    expect(hasNoindex(html)).toBe(true);
    expect(html).toContain('Hamza Ayachi');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('rel="canonical"');
  });

  it('should keep the canonical link next to the robots tag', async () => {
    const html = await render({ domain: '', location: '' });

    expect(html.indexOf('name="robots"')).toBeLessThan(html.indexOf('rel="canonical"'));
  });
});
