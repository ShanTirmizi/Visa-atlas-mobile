import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Photo } from '@/components/ui/Photo';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface NextUpCardProps {
  title: string;
  meta: string;
  timeLabel?: string;
  imageUri?: string;
  onPress?: () => void;
}

export function NextUpCard({
  title,
  meta,
  timeLabel = 'TODAY',
  imageUri,
  onPress,
}: NextUpCardProps) {
  const { colors } = useTheme();

  return (
    <View style={{ paddingTop: 16, paddingHorizontal: 22 }}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[Type.title14, { color: colors.ink }]}>Next up</Text>
        <Text style={[Type.mono10, { color: colors.inkMute }]}>{timeLabel}</Text>
      </View>

      {/* Card */}
      <View
        style={[
          styles.card,
          Shadows.subtle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Photo thumb */}
        <Photo
          uri={imageUri}
          tone="forest"
          radius={16}
          style={{ width: 62, height: 62 }}
        />

        {/* Content */}
        <View style={styles.content}>
          <Text style={[Type.title15, { color: colors.ink }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[Type.body12_5, { color: colors.inkMute, marginTop: 2 }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>

        {/* Action orb */}
        <DarkOrb size={40} onPress={onPress} muted accessibilityLabel="Open activity">
          <ArrowRight size={18} color={colors.ink} />
        </DarkOrb>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
});
