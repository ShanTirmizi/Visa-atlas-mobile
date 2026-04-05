import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Coffee, Sun, Moon, MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface ActivityCardProps {
  timeSlot: TimeSlot;
  description: string;
  placeName?: string;
  imageUrl?: string;
}

const SLOT_CONFIG: Record<TimeSlot, { icon: typeof Coffee; label: string }> = {
  morning: { icon: Coffee, label: 'MORNING' },
  afternoon: { icon: Sun, label: 'AFTERNOON' },
  evening: { icon: Moon, label: 'EVENING' },
};

function ActivityCard({
  timeSlot,
  description,
  placeName,
  imageUrl,
}: ActivityCardProps) {
  const { colors } = useTheme();
  const { icon: Icon, label } = SLOT_CONFIG[timeSlot];

  return (
    <View style={[styles.card, Shadows.subtle, { backgroundColor: colors.card }]}>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Icon size={13} color={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        </View>
        <Text style={[styles.description, { color: colors.foreground }]}>
          {description}
        </Text>
        {placeName && (
          <View style={styles.placeRow}>
            <MapPin size={11} color={colors.textMuted} />
            <Text style={[styles.placeName, { color: colors.textMuted }]}>{placeName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default React.memo(ActivityCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
  },
  content: {
    padding: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: Spacing.xs,
  },
  label: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
  },
  description: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  placeName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});
