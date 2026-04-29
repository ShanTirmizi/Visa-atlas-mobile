import { getVisaCategoryColor, getVisaCategoryBgColor, LightColors } from '../theme';

describe('getVisaCategoryColor', () => {
  it('maps visa-free to the Mono green token', () => {
    expect(getVisaCategoryColor('visa-free', LightColors)).toBe('#2E8B63');
  });
  it('maps on-arrival to the Mono gold token', () => {
    expect(getVisaCategoryColor('on-arrival', LightColors)).toBe('#B8862B');
  });
  it('maps e-visa to the Mono burnt-orange token', () => {
    expect(getVisaCategoryColor('e-visa', LightColors)).toBe('#C2562A');
  });
  it('maps required to the Mono plum token', () => {
    expect(getVisaCategoryColor('required', LightColors)).toBe('#A83A5E');
  });
  it('falls back to ink for unknown categories', () => {
    expect(getVisaCategoryColor('bogus', LightColors)).toBe('#0E0E0E');
  });
});

describe('getVisaCategoryBgColor', () => {
  it('returns the soft background for visa-free', () => {
    expect(getVisaCategoryBgColor('free', LightColors)).toBe('rgba(46,139,99,0.12)');
  });
});
