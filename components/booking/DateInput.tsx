import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from 'react-native';
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
  const [tempDate, setTempDate] = useState<Date>(parseValue(value));

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
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.surfaceLight,
            borderColor: colors.border,
          },
        ]}
      >
        <Calendar size={16} color={accentColor} />
        <Text
          style={[
            styles.buttonText,
            { color: value ? colors.foreground : colors.textMuted },
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

      {/* iOS: modal with spinner + Done button */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
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
            </Pressable>
          </Pressable>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    borderBottomColor: 'rgba(0,0,0,0.1)',
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
