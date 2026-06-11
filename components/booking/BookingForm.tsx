import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
// BottomSheetTextInput (not a plain RN TextInput) so gorhom's keyboard
// handling engages on focus — plain TextInputs are invisible to the sheet.
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
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
  // Signature v2 — every form uses the coral signature accent regardless of
  // booking type (no more blue/green/etc per type). The booking type only
  // shows up in the icon and the kicker label.
  const typeColor = colors.coral;
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
  // Flights derive their title from the airport codes — DEP/ARR are the
  // required signal there. Other types still rely on `title` being filled.
  const flightDerivedTitle = (() => {
    if (type !== 'flight') return '';
    const dep = (typeDetails.departure ?? '').trim().toUpperCase();
    const arr = (typeDetails.arrival ?? '').trim().toUpperCase();
    if (!dep || !arr) return '';
    const fn = (typeDetails.flightNumber ?? '').trim();
    return fn ? `${dep} → ${arr} ${fn}` : `${dep} → ${arr}`;
  })();
  const effectiveTitle = type === 'flight' ? flightDerivedTitle : title.trim();
  const canSubmit = effectiveTitle.length > 0 && startDate.trim().length > 0;

  const submitShadow = useMemo(
    () => (canSubmit ? Shadows.glow(typeColor, 0.3) : undefined),
    [canSubmit, typeColor],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      title: effectiveTitle,
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

  // ── Reusable style objects (Signature v2 — paper bg) ─────
  const labelStyle = {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    color: colors.coralDeep,
    textTransform: 'uppercase' as const,
    letterSpacing: 9 * 0.18,
    fontWeight: '600' as const,
  };

  // Italic Fraunces glyphs lean right; explicit width + small right pad
  // keeps the placeholder/value from clipping past the card edge.
  const inputStyle = {
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 6,
    paddingVertical: 0,
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic' as const,
    fontSize: 17,
    fontWeight: '500' as const,
    letterSpacing: -17 * 0.014,
    color: colors.ink,
    marginTop: 4,
    width: '100%' as const,
  };

  const fieldCardStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
    overflow: 'hidden' as const,
  };

  const groupedCardStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  };

  // ── Helper: labeled TextInput as a paper card with kicker ─
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
    <FieldCard
      cardStyle={[
        fieldCardStyle,
        options?.flex != null && { flex: options.flex },
        options?.multiline ? { minHeight: options.minHeight ?? 92 } : null,
      ]}
      labelStyle={[labelStyle, { color: colors.inkMute }]}
      inputStyle={[
        inputStyle as StyleProp<TextStyle>,
        options?.multiline
          ? {
              minHeight: (options.minHeight ?? 80) - 30,
              textAlignVertical: 'top' as const,
              // Body multiline reads better in non-italic upright text
              fontFamily: FontFamily.regular,
              fontStyle: 'normal' as const,
              fontSize: 14,
            }
          : null,
      ]}
      label={`${label.toUpperCase()}${options?.required ? ' *' : ''}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      placeholderColor={colors.inkFaint}
      keyboardType={options?.keyboardType ?? 'default'}
      multiline={options?.multiline}
    />
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
          {renderInput('Airline', typeDetails.airline ?? '', (v) => updateDetail('airline', v), 'Emirates')}
        </View>
        <View style={{ flex: 1 }}>
          {renderInput('Flight Number', typeDetails.flightNumber ?? '', (v) => updateDetail('flightNumber', v), 'EK202')}
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
      {renderInput('Hotel Name', title, setTitle, 'Park Hyatt Tokyo', { required: true })}

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
      {renderInput('Location', location, setLocation, 'Tokyo, Japan')}
    </>
  );

  const renderExperienceFields = () => (
    <>
      {/* Activity name */}
      {renderInput('Activity Name', title, setTitle, 'Mt Fuji Day Hike', { required: true })}

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
          {renderInput('Duration', typeDetails.duration ?? '', (v) => updateDetail('duration', v), '3 hours')}
        </View>
      </View>

      {/* Location / Meeting Point */}
      {renderInput('Location / Meeting Point', location, setLocation, 'Marina Bay')}

      {/* Group size */}
      {renderInput('Group Size', typeDetails.groupSize ?? '', (v) => updateDetail('groupSize', v), '4', { keyboardType: 'numeric' })}
    </>
  );

  const renderCarRentalFields = () => (
    <>
      {/* Company */}
      {renderInput('Company', title, setTitle, 'Hertz', { required: true })}

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
        {renderInput('Pickup Location', typeDetails.pickupLocation ?? '', (v) => updateDetail('pickupLocation', v), 'Airport Terminal 3')}
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
        {renderInput('Dropoff Location', typeDetails.dropoffLocation ?? '', (v) => updateDetail('dropoffLocation', v), 'City Centre')}
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
      {renderInput('Provider', title, setTitle, 'Allianz', { required: true })}

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
      {renderInput('Policy Number', typeDetails.policyNumber ?? '', (v) => updateDetail('policyNumber', v), 'POL-123456')}

      {/* Coverage */}
      {renderInput('Coverage', typeDetails.coverage ?? '', (v) => updateDetail('coverage', v), 'Medical + Cancel')}
    </>
  );

  const renderRestaurantFields = () => (
    <>
      {/* Restaurant name */}
      {renderInput('Restaurant Name', title, setTitle, 'Sukiyabashi Jiro', { required: true })}

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
          {renderInput('Time', typeDetails.time ?? '', (v) => updateDetail('time', v), '7:30 PM')}
        </View>
      </View>

      {/* Party size */}
      {renderInput('Party Size', typeDetails.partySize ?? '', (v) => updateDetail('partySize', v), '4', { keyboardType: 'numeric' })}

      {/* Cuisine */}
      {renderInput('Cuisine', typeDetails.cuisine ?? '', (v) => updateDetail('cuisine', v), 'Japanese')}
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
  // The flight type now derives its title automatically from departure +
  // arrival airport codes (no standalone TITLE field — matches mockup).
  const needsStandaloneTitle = false;

  // ── Render ─────────────────────────────────
  // No KeyboardAvoidingView / ScrollView here: this form is mounted inside
  // AddBookingSheet's BottomSheetKeyboardAwareScrollView, which owns both
  // scrolling and keyboard avoidance (same shape as EditDaySheet). Nesting a
  // KAV + ScrollView inside sheet content broke the padding math entirely —
  // RNKC's KAV frame is relative to the sheet's scroll content, not the
  // window.
  return (
    <View style={{ padding: Spacing.lg, paddingBottom: 12 }}>
        {/* ── Editorial header — kicker + italic "Add {type}." ─ */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            hitSlop={12}
            style={[
              styles.backBtn,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <ArrowLeft size={18} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 10,
                fontWeight: '600',
                color: colors.coral,
                letterSpacing: 10 * 0.18,
                textTransform: 'uppercase',
              }}
            >
              NEW BOOKING · 01
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.display,
                fontSize: 26,
                fontWeight: '500',
                letterSpacing: -26 * 0.018,
                color: colors.ink,
                marginTop: 2,
                lineHeight: 28,
              }}
            >
              Add{' '}
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                }}
              >
                {config.label.toLowerCase()}
              </Text>
              <Text style={{ color: colors.coral }}>.</Text>
            </Text>
          </View>

          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.coralBg,
                borderColor: colors.line,
                borderWidth: 1,
              },
            ]}
          >
            <IconComponent size={16} color={colors.coralDeep} strokeWidth={1.8} />
          </View>
        </View>

        {/* ── Title (only for flight, others embed it) */}
        {needsStandaloneTitle &&
          renderInput('Title', title, setTitle, 'LHR → NRT BA005', { required: true })}

        {/* ── Type-specific fields ───────────── */}
        {renderTypeFields()}

        {/* ── More details toggle — paper chip with coral kicker text ─── */}
        <TouchableOpacity
          onPress={() => setShowExtras((prev) => !prev)}
          style={[
            styles.extrasToggle,
            { borderColor: colors.line, backgroundColor: colors.surface },
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.extrasToggleText,
              { color: colors.coralDeep, letterSpacing: 11 * 0.18 },
            ]}
          >
            {showExtras ? 'HIDE EXTRAS' : 'MORE DETAILS'}
          </Text>
          {showExtras ? (
            <ChevronUp size={14} color={colors.coralDeep} strokeWidth={2.2} />
          ) : (
            <ChevronDown size={14} color={colors.coralDeep} strokeWidth={2.2} />
          )}
        </TouchableOpacity>

        {/* ── Extras section ─────────────────── */}
        {showExtras && (
          <View>
            {renderInput('Confirmation Number', confirmationNumber, setConfirmationNumber, 'ABC123')}

            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                {renderInput('Cost', cost, setCost, '450.00', { keyboardType: 'numeric' })}
              </View>
              <View style={{ flex: 1 }}>
                {renderInput('Currency', currency, setCurrency, 'USD')}
              </View>
            </View>

            {renderInput('Notes', notes, setNotes, 'Any additional notes…', {
              multiline: true,
              minHeight: 80,
            })}
          </View>
        )}

        {/* ── Submit — italic Fraunces on coral. Disabled state stays
            present (soft paper bg + muted ink) instead of fading out. ─── */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit ? colors.coral : colors.surfaceMuted,
              borderColor: canSubmit ? colors.coral : colors.line,
              borderWidth: 1,
              shadowColor: canSubmit ? colors.coral : 'transparent',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: canSubmit ? 0.35 : 0,
              shadowRadius: 16,
              elevation: canSubmit ? 6 : 0,
            },
          ]}
        >
          <Text
            style={[
              styles.submitButtonText,
              { color: canSubmit ? '#FFFFFF' : colors.inkMute },
            ]}
          >
            {canSubmit ? 'Save booking' : 'Fill in the essentials'}
            {canSubmit ? (
              <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{'  →'}</Text>
            ) : null}
          </Text>
        </TouchableOpacity>
    </View>
  );
}

// ──────────────────────────────────────────────
// Static styles
// ──────────────────────────────────────────────

// ── FieldCard ──────────────────────────────────
// Labeled input card where the WHOLE card is the tap target — tapping the
// padding or the kicker label focuses the input (Apple HIG: the bare input
// line alone is an ~18pt-tall target that's easy to miss).
function FieldCard({
  cardStyle,
  labelStyle,
  inputStyle,
  label,
  value,
  onChange,
  placeholder,
  placeholderColor,
  keyboardType,
  multiline,
}: {
  cardStyle: StyleProp<ViewStyle>;
  labelStyle: StyleProp<TextStyle>;
  inputStyle: StyleProp<TextStyle>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  placeholderColor: string;
  keyboardType: 'default' | 'numeric';
  multiline?: boolean;
}) {
  const inputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
  return (
    <Pressable
      style={cardStyle}
      onPress={() => inputRef.current?.focus()}
      accessible={false}
    >
      <Text style={labelStyle}>{label}</Text>
      <BottomSheetTextInput
        ref={inputRef}
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  extrasToggleText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  submitButton: {
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonText: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -17 * 0.014,
  },
});
