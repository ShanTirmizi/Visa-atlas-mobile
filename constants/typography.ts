// Type scale for Mono redesign.
// All tracking values converted from the spec's em units to React Native points
// (letterSpacing in RN is in points, not em). Formula: points = fontSize * em.

import { TextStyle } from 'react-native';

export const Type = {
  // Mono kickers — uppercase JetBrains Mono labels
  kicker: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.14, // 0.14em
    textTransform: 'uppercase',
    fontWeight: '500',
  } as TextStyle,
  kickerSm: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9.5,
    letterSpacing: 9.5 * 0.1,
    textTransform: 'uppercase',
    fontWeight: '500',
  } as TextStyle,
  mono10: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.08,
    fontWeight: '500',
  } as TextStyle,

  // Display headings — Inter 700
  display40: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -40 * 0.03,
    fontWeight: '700',
  } as TextStyle,
  display32: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 32 * 1.05,
    letterSpacing: -32 * 0.03,
    fontWeight: '700',
  } as TextStyle,
  display26: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 26 * 1.0,
    letterSpacing: -26 * 0.03,
    fontWeight: '700',
  } as TextStyle,
  display24: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    letterSpacing: -24 * 0.02,
    fontWeight: '600',
  } as TextStyle,
  display22: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 22 * 1.1,
    letterSpacing: -22 * 0.025,
    fontWeight: '700',
  } as TextStyle,

  // Titles / mid-size
  title20: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -20 * 0.02,
    fontWeight: '700',
  } as TextStyle,
  title18: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: -18 * 0.02,
    fontWeight: '700',
  } as TextStyle,
  title17: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    letterSpacing: -17 * 0.02,
    fontWeight: '600',
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
