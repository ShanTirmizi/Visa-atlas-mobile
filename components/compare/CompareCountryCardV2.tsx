import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import type { VisaCategory } from '@/data/visaData';
import { toAlpha2 } from '@/utils/countryCode';

export interface CompareCountryCardV2Props {
  countryName: string;
  countryCode: string;   // alpha-3
  visaCategory: Cat;
  flightHours: number | null;
  dailyBudget: string;
  bestTime: string;
  isWinner: boolean;
}

export function CompareCountryCardV2({
  countryName,
  countryCode,
  visaCategory,
  flightHours,
  dailyBudget,
  bestTime,
  isWinner,
}: CompareCountryCardV2Props) {
  const { colors } = useTheme();
  const a2 = toAlpha2(countryCode);
  const flightStr = flightHours != null ? `${flightHours}h` : '—';

  const meta: Array<{ label: string; value: string }> = [
    { label: 'FLIGHT', value: flightStr },
    { label: 'BUDGET', value: dailyBudget },
    { label: 'BEST',   value: bestTime },
  ];

  return (
    // Outer wrapper carries shadow without clipping overflow (TOP PICK badge peeks above)
    <View
      style={[
        styles.outerWrap,
        isWinner && {
          shadowColor: '#1F1A14',
          shadowOpacity: 0.13,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      ]}
    >
      {/* TOP PICK badge — only for winner, rotated -8° peeking above top-left */}
      {isWinner && (
        <View style={styles.topPickWrapper} pointerEvents="none">
          <View
            style={[
              styles.topPickBadge,
              { backgroundColor: colors.coral },
            ]}
          >
            {/* Inner white-thread border */}
            <View style={styles.topPickInner}>
              <Text style={styles.topPickText}>TOP PICK</Text>
            </View>
          </View>
        </View>
      )}

      {/* Card body */}
      <View
        style={[
          styles.card,
          {
            borderWidth: isWinner ? 1.5 : 1,
            borderColor: isWinner ? colors.coral : colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {/* Flag + name + visa pill */}
        <View style={styles.flagSection}>
          <Flag code={a2} size={60} />
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 20,
              fontWeight: '500',
              color: colors.ink,
              marginTop: 10,
              textAlign: 'center',
              letterSpacing: -20 * 0.018,
              lineHeight: 24,
            }}
            numberOfLines={2}
          >
            {countryName}
          </Text>
          <VisaBadge cat={visaCategory} size="sm" style={{ marginTop: 6, alignSelf: 'center' }} />
        </View>

        {/* Meta strip — hairlines between rows */}
        <View style={[styles.metaStrip, { borderTopColor: colors.line }]}>
          {meta.map(({ label, value }, i) => (
            <View
              key={label}
              style={[
                styles.metaRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.metaLabel,
                  { color: colors.inkMute },
                ]}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 13,
                  fontWeight: '500',
                  color: colors.ink,
                  letterSpacing: -13 * 0.01,
                  // Shrink + ellipsize so long values ("Apr–Jun, Sep–Oct")
                  // truncate gracefully on small phones instead of being
                  // hard-clipped by the card's overflow:hidden.
                  flexShrink: 1,
                  marginLeft: 8,
                  textAlign: 'right',
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    flex: 1,
    // Allows badge to overflow above card without being clipped
    overflow: 'visible',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  flagSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  metaStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  metaLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.18,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // TOP PICK badge
  topPickWrapper: {
    position: 'absolute',
    top: -10,
    left: 12,
    zIndex: 10,
    transform: [{ rotate: '-8deg' }],
  },
  topPickBadge: {
    borderRadius: 6,
    padding: 1,
  },
  topPickInner: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topPickText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
