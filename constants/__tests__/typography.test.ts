import { Type } from '../typography';

describe('Type', () => {
  it('kicker uses JetBrains Mono at 10/0.14em tracking uppercase', () => {
    expect(Type.kicker.fontFamily).toBe('JetBrainsMono_500Medium');
    expect(Type.kicker.fontSize).toBe(10);
    expect(Type.kicker.letterSpacing).toBeCloseTo(1.4);
    expect(Type.kicker.textTransform).toBe('uppercase');
    expect(Type.kicker.fontWeight).toBe('500');
  });
  it('display32 is Inter 700 at 32px with tight tracking', () => {
    expect(Type.display32.fontFamily).toBe('Inter_700Bold');
    expect(Type.display32.fontSize).toBe(32);
    expect(Type.display32.letterSpacing).toBeCloseTo(-0.96);
  });
  it('body14 is Inter 400 at 14px with 1.5 line-height', () => {
    expect(Type.body14.lineHeight).toBe(21);
  });
});
