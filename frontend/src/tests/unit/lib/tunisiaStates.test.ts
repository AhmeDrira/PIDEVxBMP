import { describe, expect, it } from 'vitest';
import { TUNISIA_STATES } from '@/lib/tunisiaStates';

describe('TUNISIA_STATES', () => {
  it('exports the 24 Tunisian governorates as strings', () => {
    expect(Array.isArray(TUNISIA_STATES)).toBe(true);
    expect(TUNISIA_STATES).toHaveLength(24);
    TUNISIA_STATES.forEach((s) => {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    });
  });

  it('contains the major governorates', () => {
    expect(TUNISIA_STATES).toContain('Tunis');
    expect(TUNISIA_STATES).toContain('Sfax');
    expect(TUNISIA_STATES).toContain('Sousse');
    expect(TUNISIA_STATES).toContain('Bizerte');
  });

  it('has no duplicates', () => {
    expect(new Set(TUNISIA_STATES).size).toBe(TUNISIA_STATES.length);
  });
});
