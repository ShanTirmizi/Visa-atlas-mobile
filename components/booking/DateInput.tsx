import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface DateInputProps {
  label: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (dateString: string) => void;
  accentColor: string;
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

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseValue(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DateInput({
  label,
  value,
  onChange,
  accentColor,
}: DateInputProps) {
  const { colors } = useTheme();
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
    setTempDate(parseValue(value));
    setShowPicker(true);
  };

  // Android: picker is a dialog, auto-dismisses
  const handleAndroidChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      onChange(toYMD(selectedDate));
    }
  };

  // iOS: we use a modal with a confirm button
  const handleIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleIOSConfirm = () => {
    onChange(toYMD(tempDate));
    setShowPicker(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: colors.solidText }]}>
        {label}
      </Text>

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.solidField,
            borderColor: colors.solidBorderStrong,
          },
        ]}
      >
        <Calendar size={16} color={accentColor} />
        <Text
          style={[
            styles.buttonText,
            { color: value ? colors.textSecondary : colors.textMuted },
          ]}
        >
          {value ? formatDateDisplay(value) : 'Select date'}
        </Text>
      </TouchableOpacity>

      {/* Android: native dialog */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseValue(value)}
          mode="date"
          display="default"
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
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.lineMid }]}>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={[styles.modalCancel, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{label}</Text>
                  <TouchableOpacity onPress={handleIOSConfirm}>
                    <Text style={[styles.modalDone, { color: accentColor }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
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
  label: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
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
    paddingBottom: 34, // safe area
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
