import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  FileText,
  Globe2,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Type } from '@/constants/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideRowData {
  title: string;
  author: string;
  readMin: number;
  category: string;
  /** @deprecated — photo support dropped in favor of category glyph */
  tone?: string;
  /** @deprecated — photo support dropped in favor of category glyph */
  uri?: string;
}

interface GuideRowProps {
  guide: GuideRowData;
  onPress?: () => void;
}

// Map category → Lucide icon. Anything unknown falls back to BookOpen.
function iconForCategory(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes('itin')) return MapIcon;
  if (c.includes('how')) return FileText;
  if (c.includes('dest')) return Compass;
  if (c.includes('essay')) return Sparkles;
  if (c.includes('visa')) return Globe2;
  return BookOpen;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GuideRow({ guide, onPress }: GuideRowProps) {
  const { colors } = useTheme();
  const Icon = iconForCategory(guide.category);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {/* Category glyph — a small icon chip instead of a photo thumbnail */}
      <View style={[styles.glyph, { backgroundColor: colors.surfaceMuted }]}>
        <Icon size={22} color={colors.ink} strokeWidth={1.75} />
      </View>

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
  glyph: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
  },
});
