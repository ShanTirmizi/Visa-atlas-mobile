import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Radius } from '@/constants/theme';

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
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(toYMD(selectedDate));
    }
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>

      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.surfaceLight,
            borderColor: colors.border,
          },
        ]}
      >
        <Calendar size={18} color={accentColor} />
        <Text
          style={[
            styles.buttonText,
            { color: value ? colors.foreground : colors.textMuted },
          ]}
        >
          {value ? formatDateDisplay(value) : 'Select date'}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={parseValue(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
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
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
  },
});
