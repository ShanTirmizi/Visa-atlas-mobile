// Type scale for Signature v2 redesign.
// Display = Fraunces serif (with italic variant), UI = Inter, kickers = JetBrains Mono.
// All tracking values converted from the spec's em units to React Native points
// (letterSpacing in RN is in points, not em). Formula: points = fontSize * em.

import { TextStyle } from 'react-native';

export const Type = {
  // Mono kickers — uppercase JetBrains Mono labels
  kicker: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.18, // 0.18em — matches design
    textTransform: 'uppercase',
    fontWeight: '600',
  } as TextStyle,
  kickerSm: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.18,
    textTransform: 'uppercase',
    fontWeight: '700',
  } as TextStyle,
  mono10: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.08,
    fontWeight: '500',
  } as TextStyle,
  mono9: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.14,
    fontWeight: '600',
  } as TextStyle,

  // Display headings — Fraunces serif, italic by default for the signature look
  display40: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 40,
    lineHeight: 40 * 1.05,
    letterSpacing: -40 * 0.022,
    fontWeight: '500',
  } as TextStyle,
  display40Italic: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 40,
    lineHeight: 40 * 1.05,
    letterSpacing: -40 * 0.022,
    fontWeight: '500',
  } as TextStyle,
  // lineHeight ~1.15× — Fraunces has deep descenders (g, y, p) that clip on
  // iOS when lineHeight === fontSize. 1.05–1.15 matches the other display
  // sizes; never ship a serif display style at exactly 1.0.
  display32: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 32,
    lineHeight: 37, // 32 * 1.15, rounded
    letterSpacing: -32 * 0.022,
    fontWeight: '500',
  } as TextStyle,
  display32Italic: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 32,
    lineHeight: 37, // 32 * 1.15, rounded
    letterSpacing: -32 * 0.022,
    fontWeight: '500',
  } as TextStyle,
  display26: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 26,
    lineHeight: 30, // 26 * 1.15, rounded
    letterSpacing: -26 * 0.02,
    fontWeight: '500',
  } as TextStyle,
  display26Italic: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 30, // 26 * 1.15, rounded
    letterSpacing: -26 * 0.02,
    fontWeight: '500',
  } as TextStyle,
  display24: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 24,
    lineHeight: 24 * 1.05,
    letterSpacing: -24 * 0.018,
    fontWeight: '500',
  } as TextStyle,
  display22: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    lineHeight: 22 * 1.1,
    letterSpacing: -22 * 0.018,
    fontWeight: '500',
  } as TextStyle,
  display22Italic: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 22 * 1.1,
    letterSpacing: -22 * 0.018,
    fontWeight: '500',
  } as TextStyle,

  // Titles / mid-size — italic Fraunces for headlines, Inter for UI titles
  title20: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 20,
    letterSpacing: -20 * 0.018,
    fontWeight: '500',
  } as TextStyle,
  title18: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 18,
    letterSpacing: -18 * 0.014,
    fontWeight: '500',
  } as TextStyle,
  title17: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 17,
    letterSpacing: -17 * 0.012,
    fontWeight: '500',
  } as TextStyle,
  title15: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  title14: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: -14 * 0.02,
    fontWeight: '600',
  } as TextStyle,

  // Body
  body14_5: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14.5,
    lineHeight: 14.5 * 1.5,
    fontWeight: '500',
  } as TextStyle,
  body14: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 14 * 1.5,
    fontWeight: '400',
  } as TextStyle,
  body13: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 13 * 1.5,
    fontWeight: '400',
  } as TextStyle,
  body12_5: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    letterSpacing: -12.5 * 0.01,
    fontWeight: '500',
  } as TextStyle,

  // Meta / labels
  meta12: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,
  meta11_5: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    fontWeight: '500',
  } as TextStyle,
  meta11: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    fontWeight: '500',
  } as TextStyle,
  meta10_5: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.06,
    textTransform: 'uppercase',
    fontWeight: '500',
  } as TextStyle,
} as const;
