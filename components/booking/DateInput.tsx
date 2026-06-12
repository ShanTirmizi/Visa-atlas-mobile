import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { toLocalYMD, fromLocalYMD } from '@/utils/localDate';

interface DateInputProps {
  label: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (dateString: string) => void;
  accentColor: string;
  /** Earliest selectable date — pass the start date on end-date fields so
   *  the picker can't produce a check-out before check-in. */
  minimumDate?: Date;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseValue(value: string): Date {
  return fromLocalYMD(value) ?? new Date();
}

export default function DateInput({
  label,
  value,
  onChange,
  accentColor,
  minimumDate,
}: DateInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseValue(value));

  // Two-layer animation so the backdrop fades in while the picker slides
  // up — matching how AppBottomSheet (and the rest of the app's sheets)
  // animate. A single `animationType="slide"` would slide both together,
  // which feels off vs. the trip planner / booking sheets.
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(360)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (showPicker) {
      setPickerMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (pickerMounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 360,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setPickerMounted(false);
      });
    }
    // backdropOpacity / sheetTranslateY are stable refs; pickerMounted is
    // managed inside this effect so it doesn't need to be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker]);

  const handlePress = () => {
    // Dismiss the keyboard before presenting — otherwise the iOS date-picker
    // modal renders underneath the still-open keyboard. The host sheet's
    // keyboardBlurBehavior="restore" settles the sheet back to its detent.
    Keyboard.dismiss();
    // Clamp the picker's starting point to the minimum — opening an
    // end-date spinner below its allowed floor leaves iOS in a snap-back
    // tug-of-war with the user.
    const parsed = parseValue(value);
    setTempDate(minimumDate && parsed < minimumDate ? minimumDate : parsed);
    setShowPicker(true);
  };

  // Android: picker is a dialog, auto-dismisses
  const handleAndroidChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      onChange(toLocalYMD(selectedDate));
    }
  };

  // iOS: we use a modal with a confirm button
  const handleIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleIOSConfirm = () => {
    onChange(toLocalYMD(tempDate));
    setShowPicker(false);
  };

  return (
    // Paper field card matching BookingForm's FieldCard exactly — the label
    // lives INSIDE the card (mono kicker on inkMute) and the value renders
    // in italic Fraunces ink. The previous solidText/solidField tokens are
    // white-on-dark tokens from the old tinted-sheet era and were invisible
    // on the Signature v2 paper sheet (white label on white card).
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label.replace(' *', '')}: ${
          value ? formatDateDisplay(value) : 'Select date'
        }`}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.inkMute }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Calendar size={14} color={accentColor} strokeWidth={2} />
          <Text
            style={[
              styles.valueText,
              { color: value ? colors.ink : colors.inkFaint },
            ]}
            numberOfLines={1}
          >
            {value ? formatDateDisplay(value) : 'Select date'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Android: native dialog */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseValue(value)}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS: modal with spinner + Done button. We drive both layers with
          Animated values: backdrop fades in, sheet slides up. */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={pickerMounted}
          transparent
          animationType="none"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={StyleSheet.absoluteFill}>
            {/* Fading backdrop */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                // colors.ink is the system near-black; opacity is animated
                // separately so the base colour must be fully opaque.
                { backgroundColor: colors.ink, opacity: backdropOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) },
              ]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} />
            </Animated.View>

            {/* Sliding sheet */}
            <Animated.View
              style={[
                styles.sheetWrap,
                { transform: [{ translateY: sheetTranslateY }] },
              ]}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: colors.surface,
                    // Real home-indicator inset, not a hardcoded 34 — falls
                    // back to Spacing.md on devices without a bottom inset.
                    paddingBottom: Math.max(insets.bottom, Spacing.md),
                  },
                ]}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.lineMid }]}>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={[styles.modalCancel, { color: colors.inkMute }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.ink }]}>{label}</Text>
                  <TouchableOpacity onPress={handleIOSConfirm}>
                    <Text style={[styles.modalDone, { color: accentColor }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  minimumDate={minimumDate}
                  onChange={handleIOSChange}
                  style={{ height: 200 }}
                />
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors BookingForm's fieldCardStyle / labelStyle so date fields are
  // visually identical to the text fields beside them.
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 9 * 0.18,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  valueText: {
    flex: 1,
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -17 * 0.014,
    lineHeight: 22,
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // paddingBottom is applied inline from useSafeAreaInsets().
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalCancel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
  },
  modalDone: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
});
