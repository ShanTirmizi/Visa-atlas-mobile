// components/daytrip/DayTripsEntryCard.tsx
//
// The "Day trips from {home}" entry point on the Trips tab — an editorial
// card that opens the discovery screen. Reads the user's home city from
// residence; falls back to generic copy when residence isn't set yet (the
// discovery screen then prompts to set it).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Compass, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { useVisa } from '@/contexts/visa-context';
import { countryMeta } from '@/data/countryMeta';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Squiggle } from '@/components/ui/Squiggle';
import { hapticSelect } from '@/utils/haptics';

export function DayTripsEntryCard({ style }: { style?: object }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { residence } = useVisa();
  const homeCity = (residence && countryMeta[residence]?.capital) || null;

  return (
    <View style={[styles.shadow, style]}>
      <Pressable
        onPress={() => {
          hapticSelect();
          router.push('/day-planner' as never);
        }}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.line },
          pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
        ]}
      >
        <View style={styles.topRow}>
          <SectionKicker color={colors.coral}>DAY TRIPS</SectionKicker>
          <View style={[styles.orb, { backgroundColor: colors.coralBg }]}>
            <Compass size={18} color={colors.coral} strokeWidth={1.9} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.ink }]}>
          From{' '}
          <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>
            {homeCity ?? 'home'}
          </Text>
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>

        <View style={{ marginTop: 7 }}>
          <Squiggle width={70} height={9} strokeWidth={2} color={colors.coral} />
        </View>

        <Text style={[styles.body, { color: colors.inkMute }]}>
          Tell us where you are, how you&apos;re getting around and the vibe — we&apos;ll
          plan and map a whole day from your door.
        </Text>

        <View style={styles.cta}>
          <Text style={[styles.ctaText, { color: colors.coral }]}>Plan my day</Text>
          <ArrowRight size={15} color={colors.coral} strokeWidth={2.2} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginHorizontal: 22,
    borderRadius: 22,
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  card: { borderRadius: 22, borderWidth: 1, padding: 18, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orb: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.display, fontSize: 27, letterSpacing: -27 * 0.02, marginTop: 12, lineHeight: 30 },
  body: { fontFamily: FontFamily.regular, fontSize: 13.5, lineHeight: 19, marginTop: 12, maxWidth: 300 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  ctaText: { fontFamily: FontFamily.semibold, fontSize: 13.5 },
});
