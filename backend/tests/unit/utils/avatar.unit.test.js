const {
  AVATAR_COLORS,
  initialsFrom,
  colorFromName,
  buildAvatarSvg,
  buildAvatarDataUri,
} = require('../../../utils/avatar');

describe('avatar utility', () => {
  describe('initialsFrom', () => {
    test('takes the first and last word initials', () => {
      expect(initialsFrom('Hamza Ayachi')).toBe('HA');
      // Premier mot + dernier mot : les prénoms/particules du milieu sont ignorés.
      expect(initialsFrom('Mohamed Ali Ben Salah')).toBe('MS');
    });

    test('takes the first two letters of a single word', () => {
      expect(initialsFrom('Hamza')).toBe('HA');
    });

    test('handles extra whitespace', () => {
      expect(initialsFrom('   Hamza    Ayachi   ')).toBe('HA');
    });

    test('falls back to ? on empty input', () => {
      ['', '   ', null, undefined].forEach((input) => {
        expect(initialsFrom(input)).toBe('?');
      });
    });

    test('handles non-latin names without breaking', () => {
      // Le nom arabe n'a pas de majuscule : on garde le caractère tel quel.
      expect(initialsFrom('حمزة العياشي')).toBe('حا');
      expect(initialsFrom('حمزة').length).toBeGreaterThan(0);
    });
  });

  describe('colorFromName', () => {
    test('is deterministic', () => {
      expect(colorFromName('Hamza Ayachi')).toBe(colorFromName('Hamza Ayachi'));
    });

    test('always picks a colour from the palette', () => {
      ['Hamza Ayachi', 'a', '', 'حمزة', 'Jean-Christophe Dupont'].forEach((name) => {
        expect(AVATAR_COLORS).toContain(colorFromName(name));
      });
    });

    test('spreads different names across several colours', () => {
      const names = Array.from({ length: 40 }, (unused, i) => `Artisan ${i}`);
      const used = new Set(names.map(colorFromName));

      expect(used.size).toBeGreaterThan(3);
    });
  });

  describe('buildAvatarSvg', () => {
    test('produces a square svg carrying the initials', () => {
      const svg = buildAvatarSvg('Hamza Ayachi');

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('viewBox="0 0 512 512"');
      expect(svg).toContain('>HA</text>');
      expect(svg).toContain(colorFromName('Hamza Ayachi'));
    });

    test('honours the requested size', () => {
      expect(buildAvatarSvg('Hamza Ayachi', 224)).toContain('viewBox="0 0 224 224"');
    });

    test('escapes the name in the accessible label', () => {
      const svg = buildAvatarSvg('<script>alert(1)</script>');

      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });
  });

  describe('buildAvatarDataUri', () => {
    test('encodes the same svg as a base64 data URI', () => {
      const uri = buildAvatarDataUri('Hamza Ayachi', 224);

      expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);

      const decoded = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
      expect(decoded).toBe(buildAvatarSvg('Hamza Ayachi', 224));
    });
  });
});
