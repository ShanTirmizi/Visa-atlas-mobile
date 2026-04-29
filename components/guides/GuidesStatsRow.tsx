import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

interface Props {
  openApps: number;
  docsReady: number;
  totalDocs: number;
}

/** Two stat tiles at the top of the Guides tab — `OPEN APPS` count and a
 *  `DOCS READY` ratio. Each tile: tinted icon orb + italic Fraunces value
 *  + mono caps label. */
export function GuidesStatsRow({ openApps, docsReady, totalDocs }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {/* Open apps */}
      <View
        style={[
          styles.tile,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <View
          style={[
            styles.iconOrb,
            { backgroundColor: colors.coralBg },
          ]}
        >
          <BookOpen size={16} color={colors.coralDeep} strokeWidth={2} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={[
              styles.value,
              { color: colors.ink, letterSpacing: -22 * 0.018 },
            ]}
          >
            {openApps}
          </Text>
          <Text
            style={[
              styles.label,
              { color: colors.inkMute, letterSpacing: 10 * 0.22 },
            ]}
          >
            OPEN APPS
          </Text>
        </View>
      </View>

      {/* Docs ready */}
      <View
        style={[
          styles.tile,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <View
          style={[
            styles.iconOrb,
            { backgroundColor: colors.visaFreeBg },
          ]}
        >
          <CheckCircle2 size={16} color={colors.visaFree} strokeWidth={2} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={[
              styles.value,
              { color: colors.ink, letterSpacing: -22 * 0.018 },
            ]}
          >
            {docsReady}
            <Text
              style={[
                styles.valueDim,
                { color: colors.inkMute },
              ]}
            >
              /{totalDocs}
            </Text>
          </Text>
          <Text
            style={[
              styles.label,
              { color: colors.inkMute, letterSpacing: 10 * 0.22 },
            ]}
          >
            DOCS READY
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconOrb: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  value: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 24,
  },
  valueDim: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 13,
    fontWeight: '500',
  },
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default GuidesStatsRow;
