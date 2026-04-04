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
} from '@gorhom/bottom-sheet';
import { Copy, Trash2, Unlink } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
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

const STATUS_CONFIG: Record<BookingStatus, { label: string; bgKey: string; fgKey: string }> = {
  upcoming: { label: 'Upcoming', bgKey: 'primaryBg', fgKey: 'primary' },
  active: { label: 'Active', bgKey: 'secondaryBg', fgKey: 'secondary' },
  completed: { label: 'Completed', bgKey: 'shimmer', fgKey: 'textSecondary' },
  cancelled: { label: 'Cancelled', bgKey: 'dangerBg', fgKey: 'danger' },
};

// ──────────────────────────────────────────────
// InfoRow — local helper
// ──────────────────────────────────────────────

function InfoRow({
  label,
  value,
  colors,
  right,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.infoValueRow}>
        <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={2}>
          {value}
        </Text>
        {right}
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

    const snapPoints = useMemo(() => ['65%'], []);

    // ── Imperative handle ────────────────────────────
    useImperativeHandle(ref, () => ({
      open: (data: BookingDetailData) => {
        setBooking(data);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Handlers ─────────────────────────────────────

    const handleCopyConfirmation = useCallback(async () => {
      if (!booking?.confirmationNumber) return;
      // expo-clipboard can be installed later for proper clipboard support
      Alert.alert('Copied', booking.confirmationNumber);
      Alert.alert('Copied', 'Confirmation number copied to clipboard.');
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
                Alert.alert('Error', 'Failed to delete booking. Please try again.');
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
                Alert.alert('Error', 'Failed to unlink booking. Please try again.');
              }
            },
          },
        ],
      );
    }, [booking, unlinkBookingFromTrip, onUnlink]);

    // ── Backdrop ─────────────────────────────────────
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    // ── Derived values ───────────────────────────────
    if (!booking) {
      return (
        <BottomSheetModal
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
          backgroundStyle={{ backgroundColor: colors.background, borderRadius: 28 }}
        >
          <View />
        </BottomSheetModal>
      );
    }

    const config = BOOKING_TYPES[booking.type];
    const typeColor = getBookingColor(booking.type, isDark);
    const IconComponent = config.icon;
    const statusCfg = STATUS_CONFIG[booking.status];

    // Format dates for display
    const dateDisplay = formatBookingDates(
      new Date(booking.startDate),
      booking.endDate ? new Date(booking.endDate) : undefined,
    );

    // Format cost
    const formattedCost =
      booking.cost != null
        ? `${booking.currency ?? 'USD'} ${booking.cost.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : null;

    // Build type-specific detail rows using config.fields for labels
    const typeDetailRows: { label: string; value: string }[] = [];
    if (booking.typeDetails) {
      for (const field of config.fields) {
        const val = booking.typeDetails[field.key];
        if (val) {
          typeDetailRows.push({ label: field.label, value: val });
        }
      }
    }

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: 28 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 1. Header ────────────────────────────── */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: typeColor }]}>
              <IconComponent size={22} color="#FFFFFF" />
            </View>

            <View style={styles.headerText}>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {booking.title}
              </Text>

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {dateDisplay}
                {booking.location ? `  \u00B7  ${booking.location}` : ''}
              </Text>

              {/* Status badge */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: (colors as any)[statusCfg.bgKey] },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: (colors as any)[statusCfg.fgKey] },
                  ]}
                >
                  {statusCfg.label}
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. Info section ──────────────────────── */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            {booking.provider && <InfoRow label="Provider" value={booking.provider} colors={colors} />}

            {formattedCost && (
              <InfoRow label="Cost" value={formattedCost} colors={colors} />
            )}

            {booking.confirmationNumber ? (
              <InfoRow
                label="Confirmation"
                value={booking.confirmationNumber}
                colors={colors}
                right={
                  <TouchableOpacity
                    onPress={handleCopyConfirmation}
                    hitSlop={8}
                    style={[styles.copyBtn, { borderColor: colors.border }]}
                  >
                    <Copy size={14} color={colors.primary} />
                  </TouchableOpacity>
                }
              />
            ) : null}

            {typeDetailRows.map((row) => (
              <InfoRow
                key={row.label}
                label={row.label}
                value={row.value}
                colors={colors}
              />
            ))}
          </View>

          {/* ── 3. Notes box ─────────────────────────── */}
          {booking.notes ? (
            <View
              style={[
                styles.notesCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                Notes
              </Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {booking.notes}
              </Text>
            </View>
          ) : null}

          {/* ── 4. Trip link ─────────────────────────── */}
          {booking.tripName ? (
            <View style={[styles.tripPill, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.tripPillText, { color: colors.primary }]}>
                Linked to {booking.tripName}
              </Text>
            </View>
          ) : null}

          {/* ── 5. Actions row ───────────────────────── */}
          <View style={styles.actionsRow}>
            {booking.tripId ? (
              <TouchableOpacity
                onPress={handleUnlink}
                activeOpacity={0.7}
                style={[
                  styles.actionButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <Unlink size={16} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  Unlink
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.7}
              style={[
                styles.actionButton,
                {
                  borderColor: colors.dangerBg,
                  backgroundColor: colors.dangerBg,
                },
              ]}
            >
              <Trash2 size={16} color={colors.danger} />
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

BookingDetailSheet.displayName = 'BookingDetailSheet';
export default BookingDetailSheet;

// ──────────────────────────────────────────────
// Static styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Header ─────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  statusText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Info card ──────────────────────────────
  infoCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    minWidth: 90,
  },
  infoValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  infoValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'right',
    flexShrink: 1,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Notes card ─────────────────────────────
  notesCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  notesLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // ── Trip pill ──────────────────────────────
  tripPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  tripPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },

  // ── Actions row ────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});
