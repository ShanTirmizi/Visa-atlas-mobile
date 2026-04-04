import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Copy, Trash2, Unlink, MapPin, Plane } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  type ThemeColors,
} from '@/constants/theme';
import {
  BOOKING_TYPES,
  type BookingType,
  type BookingStatus,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface BookingDetailSheetRef {
  open: (booking: BookingDetailData) => void;
  close: () => void;
}

export interface BookingDetailData {
  id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider?: string;
  status: BookingStatus;
  confirmationNumber?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  tripId?: string;
  tripName?: string;
  typeDetails?: Record<string, string>;
}

interface BookingDetailSheetProps {
  onDelete?: () => void;
  onUnlink?: () => void;
}

// ──────────────────────────────────────────────
// Status badge config
// ──────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { label: string; bg: string; fg: string }> = {
  upcoming: { label: 'Upcoming', bg: 'rgba(255,255,255,0.25)', fg: '#FFFFFF' },
  active: { label: 'Active', bg: 'rgba(255,255,255,0.25)', fg: '#FFFFFF' },
  completed: { label: 'Completed', bg: 'rgba(255,255,255,0.25)', fg: '#FFFFFF' },
  cancelled: { label: 'Cancelled', bg: 'rgba(255,255,255,0.25)', fg: '#FFFFFF' },
};

// ──────────────────────────────────────────────
// DetailRow — clean info row
// ──────────────────────────────────────────────

function DetailRow({
  label,
  value,
  colors,
  accent,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  accent?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.detailValue, { color: accent ? colors.primary : colors.foreground }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// Decorative barcode — purely visual
// ──────────────────────────────────────────────

const BARCODE_PATTERN = [
  2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 1, 2, 1,
  3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2,
];

function DecorativeBarcode({ color }: { color: string }) {
  return (
    <View style={bpStyles.barcodeRow}>
      {BARCODE_PATTERN.map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            height: 40,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────
// FlightBoardingPass
// ──────────────────────────────────────────────

interface FlightBoardingPassProps {
  booking: BookingDetailData;
  colors: ThemeColors;
  isDark: boolean;
  typeColor: string;
  sheetBg: string;
  statusCfg: { label: string; bg: string; fg: string };
  dateDisplay: string;
  formattedCost: string | null;
  onCopyConfirmation: () => void;
  onDelete: () => void;
  onUnlink: () => void;
}

function FlightBoardingPass({
  booking,
  colors,
  isDark,
  typeColor,
  sheetBg,
  statusCfg,
  dateDisplay,
  formattedCost,
  onCopyConfirmation,
  onDelete,
  onUnlink,
}: FlightBoardingPassProps) {
  const details = booking.typeDetails ?? {};
  const airline = details.airline ?? booking.title;
  const flightNumber = details.flightNumber ?? '';
  const departure = details.departure ?? '';
  const arrival = details.arrival ?? '';
  const travelClass = details.class ?? '';

  // Try to extract airport codes (e.g. "London (LHR)" -> "LHR", "London" remaining)
  const parseAirport = (raw: string): { code: string; city: string } => {
    const match = raw.match(/\(([A-Z]{3})\)/);
    if (match) {
      return {
        code: match[1],
        city: raw.replace(/\s*\([A-Z]{3}\)\s*/, '').trim(),
      };
    }
    // If no code in parens, use first 3 chars uppercase as code
    const trimmed = raw.trim();
    if (trimmed.length <= 4) {
      return { code: trimmed.toUpperCase(), city: trimmed };
    }
    return { code: trimmed.slice(0, 3).toUpperCase(), city: trimmed };
  };

  const dep = parseAirport(departure);
  const arr = parseAirport(arrival);

  const cardBg = colors.card;
  const barcodeColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={bpStyles.wrapper}>
      {/* ── Top half — slightly lighter than sheet bg for card contrast ──── */}
      <View style={[bpStyles.topHalf, { backgroundColor: typeColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderBottomWidth: 0 }]}>
        {/* Header row: airline + flight number */}
        <View style={bpStyles.headerRow}>
          <View style={bpStyles.airlineRow}>
            <Plane size={16} color="#FFFFFF" />
            <Text style={bpStyles.airlineName} numberOfLines={1}>
              {airline.toUpperCase()}
            </Text>
          </View>
          {flightNumber ? (
            <Text style={bpStyles.flightNumber}>{flightNumber}</Text>
          ) : null}
        </View>

        {/* Route display */}
        <View style={bpStyles.routeContainer}>
          <View style={bpStyles.routeEndpoint}>
            <Text style={bpStyles.airportCode}>{dep.code}</Text>
            <Text style={bpStyles.cityName} numberOfLines={1}>
              {dep.city}
            </Text>
          </View>

          <View style={bpStyles.routeLine}>
            <View style={bpStyles.routeDash} />
            <Plane size={18} color="rgba(255,255,255,0.9)" />
            <View style={bpStyles.routeDash} />
          </View>

          <View style={[bpStyles.routeEndpoint, { alignItems: 'flex-end' }]}>
            <Text style={bpStyles.airportCode}>{arr.code}</Text>
            <Text style={bpStyles.cityName} numberOfLines={1}>
              {arr.city}
            </Text>
          </View>
        </View>

        {/* Date + status */}
        <View style={bpStyles.dateLine}>
          <Text style={bpStyles.dateText}>{dateDisplay}</Text>
          <View style={[bpStyles.statusPill, { backgroundColor: statusCfg.bg }]}>
            <Text style={[bpStyles.statusText, { color: statusCfg.fg }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {booking.tripName && (
          <View style={bpStyles.linkedPill}>
            <Text style={bpStyles.linkedText}>Linked to {booking.tripName}</Text>
          </View>
        )}
      </View>

      {/* ── Tear line ──── */}
      <View style={[bpStyles.tearLineContainer, { backgroundColor: cardBg }]}>
        {/* Left semicircle cutout */}
        <View
          style={[
            bpStyles.tearCircle,
            bpStyles.tearCircleLeft,
            { backgroundColor: typeColor },
          ]}
        />
        {/* Dashed line */}
        <View style={[bpStyles.tearDash, { borderColor: colors.borderSubtle }]} />
        {/* Right semicircle cutout */}
        <View
          style={[
            bpStyles.tearCircle,
            bpStyles.tearCircleRight,
            { backgroundColor: typeColor },
          ]}
        />
      </View>

      {/* ── Bottom half — card background ──── */}
      <View style={[bpStyles.bottomHalf, { backgroundColor: cardBg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderTopWidth: 0 }]}>
        {/* Detail grid — 2 columns */}
        <View style={bpStyles.detailGrid}>
          <View style={bpStyles.detailBox}>
            <Text style={[bpStyles.detailBoxLabel, { color: colors.textSecondary }]}>
              CLASS
            </Text>
            <Text style={[bpStyles.detailBoxValue, { color: colors.foreground }]}>
              {travelClass || '\u2014'}
            </Text>
          </View>
          <View style={bpStyles.detailBox}>
            <Text style={[bpStyles.detailBoxLabel, { color: colors.textSecondary }]}>
              CONFIRMATION
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={[bpStyles.detailBoxValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {booking.confirmationNumber || '\u2014'}
              </Text>
              {booking.confirmationNumber ? (
                <TouchableOpacity
                  onPress={onCopyConfirmation}
                  hitSlop={8}
                  style={[styles.copyBtn, { backgroundColor: colors.primaryBg }]}
                >
                  <Copy size={11} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={bpStyles.detailGrid}>
          <View style={bpStyles.detailBox}>
            <Text style={[bpStyles.detailBoxLabel, { color: colors.textSecondary }]}>
              COST
            </Text>
            <Text
              style={[
                bpStyles.detailBoxValue,
                { color: formattedCost ? colors.primary : colors.textMuted },
              ]}
            >
              {formattedCost || '\u2014'}
            </Text>
          </View>
          <View style={bpStyles.detailBox}>
            <Text style={[bpStyles.detailBoxLabel, { color: colors.textSecondary }]}>
              GATE
            </Text>
            <Text style={[bpStyles.detailBoxValue, { color: colors.textMuted }]}>
              {'\u2014'}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {booking.notes ? (
          <View style={[bpStyles.notesSection, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[bpStyles.detailBoxLabel, { color: colors.textSecondary }]}>
              NOTES
            </Text>
            <Text style={[bpStyles.notesText, { color: colors.foreground }]}>
              {booking.notes}
            </Text>
          </View>
        ) : null}

        {/* Barcode */}
        <DecorativeBarcode color={barcodeColor} />
      </View>

      {/* ── Actions ──── */}
      <View style={styles.actionsRow}>
        {booking.tripId ? (
          <TouchableOpacity
            onPress={onUnlink}
            activeOpacity={0.7}
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          >
            <Unlink size={15} color="#FFFFFF" />
            <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Unlink</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onDelete}
          activeOpacity={0.7}
          style={[styles.actionBtn, { backgroundColor: colors.danger }]}
        >
          <Trash2 size={15} color="#FFFFFF" />
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════
// BookingDetailSheet
// ════════════════════════════════════════════════

const BookingDetailSheet = forwardRef<BookingDetailSheetRef, BookingDetailSheetProps>(
  ({ onDelete, onUnlink }, ref) => {
    const { colors, isDark } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [booking, setBooking] = useState<BookingDetailData | null>(null);

    const deleteBooking = useMutation(api.bookings.deleteBooking);
    const unlinkBookingFromTrip = useMutation(api.bookings.unlinkBookingFromTrip);

    // No fixed snap points — let the sheet size to its content
    const snapPoints = useMemo(() => [], []);

    useImperativeHandle(ref, () => ({
      open: (data: BookingDetailData) => {
        setBooking(data);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    const handleCopyConfirmation = useCallback(() => {
      if (!booking?.confirmationNumber) return;
      Alert.alert('Copied', booking.confirmationNumber);
    }, [booking?.confirmationNumber]);

    const handleDelete = useCallback(() => {
      if (!booking) return;
      Alert.alert(
        'Delete Booking',
        `Are you sure you want to delete "${booking.title}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteBooking({ id: booking.id as Id<'bookings'> });
                bottomSheetRef.current?.dismiss();
                onDelete?.();
              } catch {
                Alert.alert('Error', 'Failed to delete booking.');
              }
            },
          },
        ],
      );
    }, [booking, deleteBooking, onDelete]);

    const handleUnlink = useCallback(() => {
      if (!booking) return;
      Alert.alert(
        'Unlink Booking',
        `Are you sure you want to unlink "${booking.title}" from this trip?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlink',
            style: 'destructive',
            onPress: async () => {
              try {
                await unlinkBookingFromTrip({ id: booking.id as Id<'bookings'> });
                bottomSheetRef.current?.dismiss();
                onUnlink?.();
              } catch {
                Alert.alert('Error', 'Failed to unlink booking.');
              }
            },
          },
        ],
      );
    }, [booking, unlinkBookingFromTrip, onUnlink]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    if (!booking) {
      return (
        <BottomSheetModal
          ref={bottomSheetRef}
          enableDynamicSizing={true}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.5)', width: 40 }}
          backgroundStyle={{ backgroundColor: colors.card, borderRadius: 24 }}
        >
          <View />
        </BottomSheetModal>
      );
    }

    const config = BOOKING_TYPES[booking.type];
    const typeColor = getBookingColor(booking.type, isDark);
    const IconComponent = config.icon;
    const statusCfg = STATUS_STYLES[booking.status];

    const dateDisplay = formatBookingDates(
      new Date(booking.startDate),
      booking.endDate ? new Date(booking.endDate) : undefined,
    );

    const formattedCost =
      booking.cost != null
        ? `${booking.currency ?? 'USD'} ${booking.cost.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : null;

    const typeDetailRows: { label: string; value: string }[] = [];
    if (booking.typeDetails) {
      for (const field of config.fields) {
        const val = booking.typeDetails[field.key];
        if (val) {
          typeDetailRows.push({ label: field.label, value: val });
        }
      }
    }

    const isFlight = booking.type === 'flight';
    const sheetBg = typeColor; // Always use the booking type color
    const handleColor = 'rgba(255,255,255,0.5)';

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={true}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: handleColor, width: 40 }}
        backgroundStyle={{ backgroundColor: sheetBg, borderRadius: 24 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {isFlight ? (
            <FlightBoardingPass
              booking={booking}
              colors={colors}
              isDark={isDark}
              typeColor={typeColor}
              sheetBg={sheetBg}
              statusCfg={statusCfg}
              dateDisplay={dateDisplay}
              formattedCost={formattedCost}
              onCopyConfirmation={handleCopyConfirmation}
              onDelete={handleDelete}
              onUnlink={handleUnlink}
            />
          ) : (
            <>
              {/* ── Hero header — colored background ──── */}
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIconWrap}>
                    <IconComponent size={24} color="#FFFFFF" />
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.fg }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>{booking.title}</Text>

                <View style={styles.heroMeta}>
                  <Text style={styles.heroDate}>{dateDisplay}</Text>
                  {booking.location && (
                    <View style={styles.heroLocationRow}>
                      <MapPin size={12} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.heroLocation}>{booking.location}</Text>
                    </View>
                  )}
                </View>

                {booking.tripName && (
                  <View style={styles.linkedPill}>
                    <Text style={styles.linkedText}>Linked to {booking.tripName}</Text>
                  </View>
                )}
              </View>

              {/* ── Info card — white/card background ──── */}
              <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                {booking.provider && booking.provider !== 'Manual' && (
                  <DetailRow label="Provider" value={booking.provider} colors={colors} />
                )}

                {formattedCost && (
                  <DetailRow label="Cost" value={formattedCost} colors={colors} accent />
                )}

                {booking.confirmationNumber && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Confirmation
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>
                        {booking.confirmationNumber}
                      </Text>
                      <TouchableOpacity
                        onPress={handleCopyConfirmation}
                        hitSlop={8}
                        style={[styles.copyBtn, { backgroundColor: colors.primaryBg }]}
                      >
                        <Copy size={12} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {typeDetailRows.map((row) => (
                  <DetailRow key={row.label} label={row.label} value={row.value} colors={colors} />
                ))}

                {booking.notes && (
                  <View style={[styles.notesSection, { borderTopColor: colors.borderSubtle }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Notes</Text>
                    <Text style={[styles.notesText, { color: colors.foreground }]}>
                      {booking.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Actions ──── */}
              <View style={styles.actionsRow}>
                {booking.tripId && (
                  <TouchableOpacity
                    onPress={handleUnlink}
                    activeOpacity={0.7}
                    style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                  >
                    <Unlink size={15} color="#FFFFFF" />
                    <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Unlink</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.7}
                  style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                >
                  <Trash2 size={15} color="#FFFFFF" />
                  <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

BookingDetailSheet.displayName = 'BookingDetailSheet';
export default BookingDetailSheet;

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroMeta: {
    gap: 4,
  },
  heroDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLocation: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  linkedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: Spacing.md,
  },
  linkedText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Info card
  infoCard: {
    marginHorizontal: Spacing.md,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    textAlign: 'right',
    flexShrink: 1,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    gap: 4,
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

// ──────────────────────────────────────────────
// Boarding Pass Styles
// ──────────────────────────────────────────────

const bpStyles = StyleSheet.create({
  wrapper: {
    paddingTop: Spacing.xs,
  },

  // Top half — colored
  topHalf: {
    marginHorizontal: Spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  airlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  airlineName: {
    fontFamily: FontFamily.condensedBold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  flightNumber: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.8,
  },

  // Route
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  routeEndpoint: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  airportCode: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    color: '#FFFFFF',
    letterSpacing: 2,
    lineHeight: 48,
  },
  cityName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  routeLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  routeDash: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // Date + status row
  dateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  linkedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: Spacing.md,
  },
  linkedText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Tear line
  tearLineContainer: {
    marginHorizontal: Spacing.md,
    height: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  tearDash: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    marginHorizontal: 20,
  },
  tearCircle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 0,
  },
  tearCircleLeft: {
    left: -12,
  },
  tearCircleRight: {
    right: -12,
  },

  // Bottom half — card color
  bottomHalf: {
    marginHorizontal: Spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailBox: {
    flex: 1,
    gap: 4,
  },
  detailBoxLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailBoxValue: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },

  // Notes
  notesSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 4,
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: 2,
  },

  // Barcode
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
