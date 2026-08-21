const { CARD_WIDTH, CARD_HEIGHT, buildShareCardSvg } = require('../../../utils/shareCard');
const { initialsFrom, colorFromName } = require('../../../utils/avatar');

describe('shareCard utility', () => {
  const profile = {
    fullName: 'mehdi ayachi',
    domain: 'Painting',
    location: 'Ariana, Bizerte',
    host: 'mehdi-painting-ariana-bizerte.bmp.tn',
  };

  test('uses the 1200x630 ratio expected by WhatsApp and Facebook', () => {
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1200, 630]);

    const svg = buildShareCardSvg(profile);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });

  test('shows name, trade, zone and mini site host', () => {
    const svg = buildShareCardSvg(profile);

    expect(svg).toContain('mehdi ayachi');
    expect(svg).toContain('Painting');
    expect(svg).toContain('Ariana, Bizerte');
    expect(svg).toContain('mehdi-painting-ariana-bizerte.bmp.tn');
  });

  test('reuses the initials and colour of the avatar, for a consistent identity', () => {
    const svg = buildShareCardSvg(profile);

    expect(svg).toContain(`>${initialsFrom(profile.fullName)}</text>`);
    expect(svg).toContain(colorFromName(profile.fullName));
  });

  test('omits the trade and zone lines when the profile is empty', () => {
    const svg = buildShareCardSvg({ fullName: 'Hamza Ayachi', host: 'hamza.bmp.tn' });

    expect(svg).toContain('Hamza Ayachi');
    expect(svg).toContain('hamza.bmp.tn');
    // Une seule ligne de texte d'identité : pas de <text> vide qui laisserait un trou.
    expect(svg).not.toMatch(/font-size="40"/);
    expect(svg).not.toMatch(/font-size="32"/);
  });

  test('truncates values too long for the card width', () => {
    const svg = buildShareCardSvg({
      fullName: 'Jean-Christophe De La Fontaine-Dupont',
      domain: 'Foundation Construction et travaux speciaux',
      location: 'Sidi Bouzid, Kasserine, Gafsa, Tozeur',
      host: 'jean-christophe.bmp.tn',
    });

    expect(svg).toContain('…');
    expect(svg).not.toContain('Jean-Christophe De La Fontaine-Dupont');
  });

  test('falls back to a generic name and host', () => {
    const svg = buildShareCardSvg({});

    expect(svg).toContain('Artisan');
    expect(svg).toContain('bmp.tn');
  });

  test('escapes text so a crafted name cannot inject markup', () => {
    const svg = buildShareCardSvg({ fullName: '<script>alert(1)</script>' });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  test('produces a well-formed standalone svg', () => {
    const svg = buildShareCardSvg(profile);

    expect(svg.trim().startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
