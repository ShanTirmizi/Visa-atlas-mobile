import React, { useState, useMemo, useEffect } from 'react';
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
import DateInput from './DateInput';
import RouteInput from './RouteInput';
import PillSelector from './PillSelector';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

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

export interface BookingFormProps {
  type: BookingType;
  onBack: () => void;
  onSubmit: (data: BookingFormData) => void;
  defaultCountryCode?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  prefillData?: Partial<BookingFormData>;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BookingForm({
  type,
  onBack,
  onSubmit,
  defaultCountryCode = '',
  defaultStartDate = '',
  defaultEndDate = '',
  prefillData,
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

  // ── Prefill on mount ───────────────────────
  useEffect(() => {
    if (!prefillData) return;
    if (prefillData.title != null) setTitle(prefillData.title);
    if (prefillData.startDate != null) setStartDate(prefillData.startDate);
    if (prefillData.endDate != null) setEndDate(prefillData.endDate);
    if (prefillData.location != null) setLocation(prefillData.location);
    if (prefillData.countryCode != null) setCountryCode(prefillData.countryCode);
    if (prefillData.confirmationNumber != null) setConfirmationNumber(prefillData.confirmationNumber);
    if (prefillData.cost != null) setCost(prefillData.cost);
    if (prefillData.currency != null) setCurrency(prefillData.currency);
    if (prefillData.notes != null) setNotes(prefillData.notes);
    if (prefillData.typeDetails != null) setTypeDetails(prefillData.typeDetails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDetail = (key: string, value: string) => {
    setTypeDetails((prev) => ({ ...prev, [key]: value }));
  };

  // ── Derived ────────────────────────────────
  const canSubmit = title.trim().length > 0 && startDate.trim().length > 0;

  const submitShadow = useMemo(
    () => (canSubmit ? Shadows.glow(typeColor, 0.3) : undefined),
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

  // ── Reusable style objects ─────────────────
  // White labels + white inputs for visibility on colored sheet background
  const labelStyle = {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  };

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: colors.foreground,
  };

  const groupedCardStyle = {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  };

  // ── Helper: labeled TextInput ──────────────
  const renderInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    options?: {
      keyboardType?: 'default' | 'numeric';
      multiline?: boolean;
      minHeight?: number;
      flex?: number;
      required?: boolean;
    },
  ) => (
    <View style={[styles.fieldGroup, options?.flex != null && { flex: options.flex }]}>
      <Text style={labelStyle}>
        {label}
        {options?.required ? ' *' : ''}
      </Text>
      <TextInput
        style={[
          inputStyle,
          options?.multiline && { minHeight: options.minHeight ?? 80, textAlignVertical: 'top' },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        keyboardType={options?.keyboardType ?? 'default'}
        multiline={options?.multiline}
      />
    </View>
  );

  // ── Type-specific layouts ──────────────────

  const renderFlightFields = () => (
    <>
      {/* Route */}
      <View style={styles.fieldGroup}>
        <RouteInput
          departure={typeDetails.departure ?? ''}
          arrival={typeDetails.arrival ?? ''}
          onDepartureChange={(v) => updateDetail('departure', v)}
          onArrivalChange={(v) => updateDetail('arrival', v)}
          accentColor={typeColor}
        />
      </View>

      {/* Airline + Flight Number */}
      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          {renderInput('Airline', typeDetails.airline ?? '', (v) => updateDetail('airline', v), 'e.g. Emirates')}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Flight Number', typeDetails.flightNumber ?? '', (v) => updateDetail('flightNumber', v), 'e.g. EK202')}
        </View>
      </View>

      {/* Departure Date */}
      <View style={styles.fieldGroup}>
        <DateInput
          label="DEPARTURE DATE *"
          value={startDate}
          onChange={setStartDate}
          accentColor={typeColor}
        />
      </View>

      {/* Class */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>CLASS</Text>
        <PillSelector
          options={['Economy', 'Business', 'First']}
          selected={typeDetails.class ?? ''}
          onSelect={(v) => updateDetail('class', v)}
          accentColor={typeColor}
        />
      </View>
    </>
  );

  const renderHotelFields = () => (
    <>
      {/* Hotel name (large, prominent) */}
      {renderInput('Hotel Name', title, setTitle, 'e.g. Park Hyatt Tokyo', { required: true })}

      {/* Check-in + Check-out */}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <DateInput
            label="CHECK-IN *"
            value={startDate}
            onChange={setStartDate}
            accentColor={typeColor}
          />
        </View>
        <View style={styles.rowItem}>
          <DateInput
            label="CHECK-OUT"
            value={endDate}
            onChange={setEndDate}
            accentColor={typeColor}
          />
        </View>
      </View>

      {/* Room type */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>ROOM TYPE</Text>
        <PillSelector
          options={['Single', 'Double', 'Suite', 'Studio']}
          selected={typeDetails.roomType ?? ''}
          onSelect={(v) => updateDetail('roomType', v)}
          accentColor={typeColor}
        />
      </View>

      {/* Location */}
      {renderInput('Location', location, setLocation, 'e.g. Tokyo, Japan')}
    </>
  );

  const renderExperienceFields = () => (
    <>
      {/* Activity name */}
      {renderInput('Activity Name', title, setTitle, 'e.g. Mt Fuji Day Hike', { required: true })}

      {/* Date + Duration */}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <DateInput
            label="DATE *"
            value={startDate}
            onChange={setStartDate}
            accentColor={typeColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Duration', typeDetails.duration ?? '', (v) => updateDetail('duration', v), 'e.g. 3 hours')}
        </View>
      </View>

      {/* Location / Meeting Point */}
      {renderInput('Location / Meeting Point', location, setLocation, 'e.g. Marina Bay')}

      {/* Group size */}
      {renderInput('Group Size', typeDetails.groupSize ?? '', (v) => updateDetail('groupSize', v), 'e.g. 4', { keyboardType: 'numeric' })}
    </>
  );

  const renderCarRentalFields = () => (
    <>
      {/* Company */}
      {renderInput('Company', title, setTitle, 'e.g. Hertz', { required: true })}

      {/* Pickup grouped card */}
      <View style={groupedCardStyle}>
        <Text style={[labelStyle, { marginBottom: 10 }]}>PICKUP</Text>
        <DateInput
          label="PICKUP DATE *"
          value={startDate}
          onChange={setStartDate}
          accentColor={typeColor}
        />
        <View style={{ height: 12 }} />
        {renderInput('Pickup Location', typeDetails.pickupLocation ?? '', (v) => updateDetail('pickupLocation', v), 'e.g. Airport Terminal 3')}
      </View>

      {/* Dropoff grouped card */}
      <View style={groupedCardStyle}>
        <Text style={[labelStyle, { marginBottom: 10 }]}>DROPOFF</Text>
        <DateInput
          label="DROPOFF DATE"
          value={endDate}
          onChange={setEndDate}
          accentColor={typeColor}
        />
        <View style={{ height: 12 }} />
        {renderInput('Dropoff Location', typeDetails.dropoffLocation ?? '', (v) => updateDetail('dropoffLocation', v), 'e.g. City Centre')}
      </View>

      {/* Car type */}
      <View style={styles.fieldGroup}>
        <Text style={labelStyle}>CAR TYPE</Text>
        <PillSelector
          options={['Compact', 'SUV', 'Sedan', 'Van']}
          selected={typeDetails.carType ?? ''}
          onSelect={(v) => updateDetail('carType', v)}
          accentColor={typeColor}
        />
      </View>
    </>
  );

  const renderInsuranceFields = () => (
    <>
      {/* Provider */}
      {renderInput('Provider', title, setTitle, 'e.g. Allianz', { required: true })}

      {/* Start + End */}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <DateInput
            label="START *"
            value={startDate}
            onChange={setStartDate}
            accentColor={typeColor}
          />
        </View>
        <View style={styles.rowItem}>
          <DateInput
            label="END"
            value={endDate}
            onChange={setEndDate}
            accentColor={typeColor}
          />
        </View>
      </View>

      {/* Policy number */}
      {renderInput('Policy Number', typeDetails.policyNumber ?? '', (v) => updateDetail('policyNumber', v), 'e.g. POL-123456')}

      {/* Coverage */}
      {renderInput('Coverage', typeDetails.coverage ?? '', (v) => updateDetail('coverage', v), 'e.g. Medical + Cancellation')}
    </>
  );

  const renderRestaurantFields = () => (
    <>
      {/* Restaurant name */}
      {renderInput('Restaurant Name', title, setTitle, 'e.g. Sukiyabashi Jiro', { required: true })}

      {/* Date + Time */}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <DateInput
            label="DATE *"
            value={startDate}
            onChange={setStartDate}
            accentColor={typeColor}
          />
        </View>
        <View style={styles.rowItem}>
          {renderInput('Time', typeDetails.time ?? '', (v) => updateDetail('time', v), 'e.g. 7:30 PM')}
        </View>
      </View>

      {/* Party size */}
      {renderInput('Party Size', typeDetails.partySize ?? '', (v) => updateDetail('partySize', v), 'e.g. 4', { keyboardType: 'numeric' })}

      {/* Cuisine */}
      {renderInput('Cuisine', typeDetails.cuisine ?? '', (v) => updateDetail('cuisine', v), 'e.g. Japanese')}
    </>
  );

  const renderTypeFields = () => {
    switch (type) {
      case 'flight':
        return renderFlightFields();
      case 'hotel':
        return renderHotelFields();
      case 'experience':
        return renderExperienceFields();
      case 'car_rental':
        return renderCarRentalFields();
      case 'insurance':
        return renderInsuranceFields();
      case 'restaurant':
        return renderRestaurantFields();
      default:
        return null;
    }
  };

  // For flight, the title is built from route; for types that use the first
  // field as the title (hotel, experience, car_rental, insurance, restaurant),
  // we render it inside the type section. Flight still needs a standalone title.
  const needsStandaloneTitle = type === 'flight';

  // ── Render ─────────────────────────────────
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
          <TouchableOpacity onPress={onBack} hitSlop={12}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <IconComponent size={18} color="#FFFFFF" />
          </View>

          <Text style={styles.headerTitle}>
            Add {config.label}
          </Text>
        </View>

        {/* ── Title (only for flight, others embed it) */}
        {needsStandaloneTitle &&
          renderInput('Title', title, setTitle, 'e.g. LHR to NRT BA005', { required: true })}

        {/* ── Type-specific fields ───────────── */}
        {renderTypeFields()}

        {/* ── More details toggle ────────────── */}
        <TouchableOpacity
          onPress={() => setShowExtras((prev) => !prev)}
          style={styles.extrasToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.extrasToggleText, { color: '#FFFFFF' }]}>
            {showExtras ? 'Hide extras' : 'More details'}
          </Text>
          {showExtras ? (
            <ChevronUp size={18} color="#FFFFFF" />
          ) : (
            <ChevronDown size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        {/* ── Extras section ─────────────────── */}
        {showExtras && (
          <View>
            {renderInput('Confirmation Number', confirmationNumber, setConfirmationNumber, 'e.g. ABC123')}

            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                {renderInput('Cost', cost, setCost, 'e.g. 450.00', { keyboardType: 'numeric' })}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput('Currency', currency, setCurrency, 'e.g. USD')}
              </View>
            </View>

            {renderInput('Notes', notes, setNotes, 'Any additional notes...', {
              multiline: true,
              minHeight: 80,
            })}
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
              backgroundColor: '#FFFFFF',
              opacity: canSubmit ? 1 : 0.4,
            },
          ]}
        >
          <Text style={[styles.submitButtonText, { color: typeColor }]}>SAVE BOOKING</Text>
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
    gap: 12,
    marginBottom: Spacing.xl,
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
    color: '#FFFFFF',
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
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
