import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor } from '@/constants/bookings';

interface BookingFormProps {
  type: BookingType;
  onBack: () => void;
  onSubmit: (data: BookingFormData) => void;
  defaultCountryCode?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

export interface BookingFormData {
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  countryCode: string;
  confirmationNumber: string;
  cost: string;
  currency: string;
  notes: string;
  typeDetails: Record<string, string>;
}

const TITLE_PLACEHOLDERS: Record<BookingType, string> = {
  flight: 'e.g. LHR to NRT BA005',
  hotel: 'e.g. Park Hyatt Tokyo',
  experience: 'e.g. Mt Fuji Day Hike',
  car_rental: 'e.g. Hertz SUV Pickup',
  insurance: 'e.g. World Nomads Policy',
  restaurant: 'e.g. Sukiyabashi Jiro',
};

export default function BookingForm({
  type,
  onBack,
  onSubmit,
  defaultCountryCode = '',
  defaultStartDate = '',
  defaultEndDate = '',
}: BookingFormProps) {
  const { colors, isDark } = useTheme();
  const config = BOOKING_TYPES[type];
  const typeColor = getBookingColor(type, isDark);
  const IconComponent = config.icon;

  // ── State ──────────────────────────────────
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [location, setLocation] = useState('');
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [typeDetails, setTypeDetails] = useState<Record<string, string>>({});

  const updateDetail = (key: string, value: string) => {
    setTypeDetails((prev) => ({ ...prev, [key]: value }));
  };

  // ── Derived ────────────────────────────────
  const isHotel = type === 'hotel';
  const isRestaurant = type === 'restaurant';

  const startLabel = isHotel ? 'CHECK-IN' : 'START DATE';
  const endLabel = isHotel ? 'CHECK-OUT' : 'END DATE';

  const canSubmit = title.trim().length > 0 && startDate.trim().length > 0;

  const submitShadow = useMemo(
    () => (canSubmit ? Shadows.glow(typeColor) : undefined),
    [canSubmit, typeColor],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      location: location.trim(),
      countryCode: countryCode.trim(),
      confirmationNumber: confirmationNumber.trim(),
      cost: cost.trim(),
      currency: currency.trim(),
      notes: notes.trim(),
      typeDetails,
    });
  };

  // ── Styles (dynamic on theme) ──────────────
  const labelStyle = {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  };

  const inputStyle = {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: typeColor }]}>
            <IconComponent size={18} color="#FFFFFF" />
          </View>

          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Add {config.label}
          </Text>
        </View>

        {/* ── Title (required) ───────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={labelStyle}>TITLE *</Text>
          <TextInput
            style={inputStyle}
            placeholder={TITLE_PLACEHOLDERS[type]}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* ── Dates ──────────────────────────── */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={labelStyle}>{isRestaurant ? 'DATE' : startLabel} *</Text>
            <TextInput
              style={inputStyle}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          {!isRestaurant && (
            <View style={styles.rowItem}>
              <Text style={labelStyle}>{endLabel}</Text>
              <TextInput
                style={inputStyle}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          )}
        </View>

        {/* ── Location ───────────────────────── */}
        <View style={styles.fieldGroup}>
          <Text style={labelStyle}>LOCATION</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Tokyo, Japan"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* ── Type-specific fields ───────────── */}
        {config.fields.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={labelStyle}>
              {field.label.toUpperCase()}
              {field.required ? ' *' : ''}
            </Text>
            <TextInput
              style={inputStyle}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              value={typeDetails[field.key] ?? ''}
              onChangeText={(value) => updateDetail(field.key, value)}
              keyboardType={field.keyboardType ?? 'default'}
            />
          </View>
        ))}

        {/* ── Extras toggle ──────────────────── */}
        <TouchableOpacity
          onPress={() => setShowExtras((prev) => !prev)}
          style={styles.extrasToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.extrasToggleText, { color: typeColor }]}>
            {showExtras ? 'Hide extras' : 'More details'}
          </Text>
          {showExtras ? (
            <ChevronUp size={18} color={typeColor} />
          ) : (
            <ChevronDown size={18} color={typeColor} />
          )}
        </TouchableOpacity>

        {/* ── Extras section ─────────────────── */}
        {showExtras && (
          <View>
            <View style={styles.fieldGroup}>
              <Text style={labelStyle}>CONFIRMATION NUMBER</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. ABC123"
                placeholderTextColor={colors.textMuted}
                value={confirmationNumber}
                onChangeText={setConfirmationNumber}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={labelStyle}>COST</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. 450.00"
                  placeholderTextColor={colors.textMuted}
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.rowItem}>
                <Text style={labelStyle}>CURRENCY</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="e.g. USD"
                  placeholderTextColor={colors.textMuted}
                  value={currency}
                  onChangeText={setCurrency}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={labelStyle}>NOTES</Text>
              <TextInput
                style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </View>
        )}

        {/* ── Submit button ──────────────────── */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit ? typeColor : colors.textMuted,
            },
            submitShadow,
          ]}
        >
          <Text style={styles.submitButtonText}>Save Booking</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────
// Static styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: 12,
  },
  backButton: {
    marginRight: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  extrasToggleText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
});
