import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Photo, PhotoTone } from '@/components/ui/Photo';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Type } from '@/constants/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideRowData {
  title: string;
  author: string;
  readMin: number;
  category: string;
  tone?: PhotoTone;
  uri?: string;
}

interface GuideRowProps {
  guide: GuideRowData;
  onPress?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GuideRow({ guide, onPress }: GuideRowProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {/* Thumbnail */}
      <Photo
        uri={guide.uri}
        tone={guide.tone ?? 'stone'}
        radius={16}
        style={styles.thumb}
      />

      {/* Middle text */}
      <View style={styles.middle}>
        <Text style={[Type.meta10_5, { color: colors.inkMute }]} numberOfLines={1}>
          {guide.category} · {guide.readMin} min read
        </Text>
        <Text
          style={[Type.title14, { color: colors.ink, marginTop: 3 }]}
          numberOfLines={2}
        >
          {guide.title}
        </Text>
      </View>

      {/* Arrow orb */}
      <DarkOrb size={32} muted onPress={onPress} accessibilityLabel="Open guide">
        <ArrowUpRight size={15} color={colors.ink} strokeWidth={2} />
      </DarkOrb>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  thumb: {
    width: 60,
    height: 60,
  },
  middle: {
    flex: 1,
  },
});
