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
import { Copy, Trash2, Unlink, MapPin } from 'lucide-react-native';
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

    const snapPoints = useMemo(() => ['70%'], []);

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
          snapPoints={snapPoints}
          enableDynamicSizing={false}
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

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.5)', width: 40 }}
        backgroundStyle={{ backgroundColor: typeColor, borderRadius: 24 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
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
                style={[styles.actionBtn, { backgroundColor: colors.card }]}
              >
                <Unlink size={15} color={colors.textSecondary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Unlink</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: colors.dangerBg }]}
            >
              <Trash2 size={15} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
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
