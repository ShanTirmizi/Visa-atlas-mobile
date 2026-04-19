import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Shadows, Radius } from '@/constants/theme';
import { SectionKicker } from '@/components/ui/SectionKicker';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideHeroData {
  title: string;
  author: string;
  readMin: number;
  /** @deprecated — photo support dropped; kept for compat */
  tone?: string;
  /** @deprecated — photo support dropped; kept for compat */
  uri?: string;
  category?: string;
}

interface GuideHeroProps {
  guide: GuideHeroData;
  onPress?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GuideHero({ guide, onPress }: GuideHeroProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={[
        styles.container,
        { backgroundColor: colors.ink },
        Shadows.cardRaised,
      ]}
    >
      {/* Category kicker (top) */}
      <SectionKicker color="rgba(255,255,255,0.55)">
        {(guide.category ?? 'Essay').toUpperCase()}
      </SectionKicker>

      {/* Title */}
      <Text
        style={[
          Type.display22,
          { color: '#FFFFFF', marginTop: 14, fontSize: 26, lineHeight: 30 },
        ]}
        numberOfLines={3}
      >
        {guide.title}
      </Text>

      {/* Meta row at bottom with subtle arrow affordance */}
      <View style={styles.metaRow}>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {guide.readMin} min read · by {guide.author}
        </Text>
        <View style={styles.arrow}>
          <ArrowUpRight size={14} color="#FFFFFF" strokeWidth={2} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius['2xl'],
    padding: 22,
    paddingBottom: 18,
    minHeight: 180,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
