import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Section } from '@/components/ui/Section';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';
import { Shimmer } from './_shimmer';

/**
 * Mirror of the real HighlightsStrip layout — same editorial header,
 * same horizontal scroll, same 130-wide cards with an 86px photo top
 * and a two-line text body — but every photo and text line is a
 * shimmer until itinerary days arrive.
 *
 * Visually substantial so the user sees that something is loading
 * rather than a blank stretch under the hero.
 */
export function HighlightsSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: 18, paddingBottom: 110 }}>
      <View style={styles.headerRow}>
        <Section kicker="HIGHLIGHTS" title="What's planned" squiggleWidth={90} size="md" />
        <Text
          style={[
            Type.kickerSm,
            { color: colors.inkMute, fontSize: 10, letterSpacing: 0.4 },
          ]}
        >
          {'· · ·'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        scrollEnabled={false}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <Shimmer style={styles.cardPhoto} />
            <View style={styles.cardBody}>
              <Shimmer style={{ height: 12, borderRadius: 4, width: '85%' }} />
              <Shimmer style={{ height: 8, borderRadius: 4, width: '40%', marginTop: 6 }} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPhoto: {
    width: '100%',
    height: 86,
  },
  cardBody: {
    padding: 10,
  },
});
