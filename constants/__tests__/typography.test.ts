import { Type } from '../typography';

describe('Type', () => {
  // Signature v2 redesign: display = Fraunces serif, kickers = JetBrains Mono
  // at 0.18em tracking (see constants/typography.ts header comment).
  it('kicker uses JetBrains Mono at 10/0.18em tracking uppercase', () => {
    expect(Type.kicker.fontFamily).toBe('JetBrainsMono_500Medium');
    expect(Type.kicker.fontSize).toBe(10);
    expect(Type.kicker.letterSpacing).toBeCloseTo(1.8); // 10 * 0.18em
    expect(Type.kicker.textTransform).toBe('uppercase');
    expect(Type.kicker.fontWeight).toBe('600');
  });
  it('display32 is Fraunces 500 at 32px with tight tracking', () => {
    expect(Type.display32.fontFamily).toBe('Fraunces_500Medium');
    expect(Type.display32.fontSize).toBe(32);
    expect(Type.display32.letterSpacing).toBeCloseTo(-0.704); // -32 * 0.022em
  });
  it('body14 is Inter 400 at 14px with 1.5 line-height', () => {
    expect(Type.body14.lineHeight).toBe(21);
  });
});
