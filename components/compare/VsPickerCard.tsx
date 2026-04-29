import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Plus, Compass } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Type } from '@/constants/typography';

interface VsPickerCardProps {
  onPickFirst: () => void;
  onPickSecond: () => void;
  firstLabel?: string;
  secondLabel?: string;
}

function SlotPicker({
  onPress,
  label,
  slotLabel,
  countryName,
}: {
  onPress: () => void;
  label: 'FIRST' | 'SECOND';
  slotLabel: string;
  countryName?: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        {
          borderColor: countryName ? colors.coral : colors.line,
          backgroundColor: countryName ? colors.coralBg : colors.background,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Pick ${slotLabel}`}
    >
      {countryName ? (
        <View style={styles.slotInner}>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: '500',
              color: colors.ink,
              textAlign: 'center',
              letterSpacing: -15 * 0.012,
            }}
            numberOfLines={2}
          >
            {countryName}
          </Text>
        </View>
      ) : (
        <View style={styles.slotInner}>
          {/* Dashed circle + icon */}
          <View style={[styles.plusCircle, { borderColor: colors.inkFaint }]}>
            <Plus size={18} color={colors.inkMute} strokeWidth={1.8} />
          </View>
          {/* Kicker label */}
          <Text
            style={[
              styles.slotKicker,
              { color: colors.inkMute },
            ]}
          >
            {label}
          </Text>
          {/* Prompt */}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 13,
              fontWeight: '500',
              color: colors.inkSoft,
              textAlign: 'center',
              letterSpacing: -13 * 0.01,
              marginTop: 2,
            }}
          >
            Pick a{'\n'}country
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function VsPickerCard({
  onPickFirst,
  onPickSecond,
  firstLabel,
  secondLabel,
}: VsPickerCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Picker row */}
      <View style={styles.pickerRow}>
        <SlotPicker
          onPress={onPickFirst}
          label="FIRST"
          slotLabel="first country"
          countryName={firstLabel}
        />

        {/* VS. in the middle */}
        <View style={styles.vsBox}>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 48,
              fontWeight: '500',
              color: colors.ink,
              lineHeight: 52,
              letterSpacing: -48 * 0.02,
            }}
          >
            vs
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
        </View>

        <SlotPicker
          onPress={onPickSecond}
          label="SECOND"
          slotLabel="second country"
          countryName={secondLabel}
        />
      </View>

      {/* Hairline divider */}
      <View style={[styles.hairline, { backgroundColor: colors.line }]} />

      {/* Caption row */}
      <View style={styles.captionRow}>
        <Compass size={14} color={colors.coral} strokeWidth={1.8} />
        <Text
          style={[
            Type.body13,
            { color: colors.inkSoft, flex: 1, lineHeight: 19 },
          ]}
        >
          {`We'll `}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 13,
              fontWeight: '500',
            }}
          >
            line them up
          </Text>
          {' on visa, budget, weather and vibe.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    marginHorizontal: 22,
    marginBottom: 24,
    ...Shadows.subtle,
    // Warm shadow override
    shadowColor: '#1F1A14',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'visible',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    gap: 8,
  },
  slot: {
    flex: 1,
    aspectRatio: 0.85,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: 150,
  },
  slotInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    // RN dashed border is unreliable; using solid with faint color
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotKicker: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 2,
  },
  vsBox: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    paddingTop: 12,
  },
});
