/**
 * EmptyAtlasCard — the premium empty-state card shown when the user has no trips.
 *
 * Layout:
 *  - Mono kicker "PASSPORT · BLANK PAGE" in coral
 *  - Italic Fraunces "Where to first?" headline (38px), coral ?
 *  - Coral Squiggle underline
 *  - PassportMap illustration
 *  - Body text "Your passport is stampless..."
 *  - Two CTA buttons: primary "Plan a trip" + ghost "Browse Atlas"
 *
 * Container: dashed coral border, surface bg, 22px radius, 20px padding.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { PassportMap } from '@/components/trips/PassportMap';

interface EmptyAtlasCardProps {
  onPlan: () => void;
  onBrowse: () => void;
}

export function EmptyAtlasCard({ onPlan, onBrowse }: EmptyAtlasCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.coral,
          backgroundColor: colors.surface,
        },
      ]}
    >
      {/* Kicker */}
      <Text
        style={[
          Type.kickerSm,
          {
            color: colors.coral,
            letterSpacing: 11 * 0.22,
            fontSize: 9,
          },
        ]}
      >
        PASSPORT · BLANK PAGE
      </Text>

      {/* Headline: "Where to first?" */}
      <View style={{ marginTop: 10 }}>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 38,
            fontWeight: '500',
            letterSpacing: -38 * 0.022,
            lineHeight: 40,
            color: colors.ink,
          }}
        >
          {'Where to '}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
            }}
          >
            first
          </Text>
          <Text style={{ color: colors.coral }}>?</Text>
        </Text>
      </View>

      {/* Coral squiggle */}
      <View style={{ marginTop: 8 }}>
        <Squiggle width={80} height={10} strokeWidth={2} />
      </View>

      {/* City-tag map illustration */}
      <View style={{ marginTop: 16 }}>
        <PassportMap />
      </View>

      {/* Body text */}
      <Text
        style={[
          Type.body14,
          {
            color: colors.inkMute,
            marginTop: 16,
            lineHeight: 14 * 1.6,
          },
        ]}
      >
        {'Your passport is '}
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            color: colors.inkMute,
          }}
        >
          stampless.
        </Text>
        {' Plan a trip and we\'ll do the visa homework.'}
      </Text>

      {/* CTA buttons row */}
      <View style={styles.ctaRow}>
        {/* Primary: ink bg + white text + plus icon */}
        <Pressable
          onPress={onPlan}
          accessibilityRole="button"
          accessibilityLabel="Plan a trip"
          style={({ pressed }) => [
            styles.ctaPrimary,
            { backgroundColor: colors.ink, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.ctaPrimaryText}>Plan a trip</Text>
        </Pressable>

        {/* Ghost: transparent bg + line border + ink text */}
        <Pressable
          onPress={onBrowse}
          accessibilityRole="button"
          accessibilityLabel="Browse Atlas"
          style={({ pressed }) => [
            styles.ctaGhost,
            {
              borderColor: colors.lineMid,
              opacity: pressed ? 0.80 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaGhostText, { color: colors.ink }]}>
            Browse Atlas
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 22,
    marginTop: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    // dashed not supported natively; we use solid coral instead.
    // The design calls for dashed but RN's borderStyle:'dashed' often
    // renders poorly on Android. We use solid at reduced opacity to keep
    // the coral boundary visible without looking too heavy.
    padding: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  ctaPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -14 * 0.01,
    color: '#FFFFFF',
  },
  ctaGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  ctaGhostText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -14 * 0.01,
  },
});

export default EmptyAtlasCard;
