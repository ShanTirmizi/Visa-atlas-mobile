import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Check, X } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  BOOKING_TYPES,
  type BookingType,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';
import type { ClassifiedEvent } from '@/utils/calendarClassifier';

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export interface CalendarReviewSheetRef {
  open: (items: ClassifiedEvent[]) => void;
  close: () => void;
}

interface CalendarReviewSheetProps {
  onComplete?: () => void;
}

// ════════════════════════════════════════════════
// CalendarReviewSheet
// ════════════════════════════════════════════════

const CalendarReviewSheet = forwardRef<CalendarReviewSheetRef, CalendarReviewSheetProps>(
  ({ onComplete }, ref) => {
    const { colors, isDark } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [items, setItems] = useState<ClassifiedEvent[]>([]);

    const createBooking = useMutation(api.bookings.createBooking);

    const snapPoints = useMemo(() => ['70%'], []);

    // ── Imperative handle ────────────────────────────
    useImperativeHandle(ref, () => ({
      open: (newItems: ClassifiedEvent[]) => {
        setItems(newItems);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Accept: create booking and remove from list ──
    const handleAccept = useCallback(
      async (classified: ClassifiedEvent) => {
        const { event, bookingType, provider } = classified;

        const startDate = event.startDate;
        const endDate = event.endDate;
        const endDateArg =
          endDate && endDate !== startDate ? endDate : undefined;

        await createBooking({
          type: bookingType,
          source: 'calendar',
          provider,
          status: 'upcoming',
          title: event.title,
          startDate,
          endDate: endDateArg,
          location: event.location || undefined,
          calendarEventId: event.id,
          calendarSource: Platform.OS === 'ios' ? 'apple' : 'google',
        });

        setItems((prev) => {
          const next = prev.filter((item) => item.event.id !== event.id);
          if (next.length === 0) {
            onComplete?.();
          }
          return next;
        });
      },
      [createBooking, onComplete],
    );

    // ── Dismiss: remove from list without creating ───
    const handleDismiss = useCallback(
      (eventId: string) => {
        setItems((prev) => {
          const next = prev.filter((item) => item.event.id !== eventId);
          if (next.length === 0) {
            onComplete?.();
          }
          return next;
        });
      },
      [onComplete],
    );

    // ── Render each classified event card ────────────
    const renderItem = useCallback(
      ({ item }: { item: ClassifiedEvent }) => {
        const config = BOOKING_TYPES[item.bookingType];
        const typeColor = getBookingColor(item.bookingType, isDark);
        const IconComponent = config.icon;

        const dateDisplay = formatBookingDates(
          new Date(item.event.startDate),
          item.event.endDate ? new Date(item.event.endDate) : undefined,
        );

        const metaParts = [dateDisplay];
        if (item.event.location) {
          metaParts.push(item.event.location);
        }

        const signalsText =
          item.signals.slice(0, 2).join(' \u00B7 ') +
          ` \u00B7 ${Math.round(item.confidence * 100)}%`;

        return (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Content row */}
            <View style={styles.contentRow}>
              {/* Icon circle */}
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: typeColor + '18' },
                ]}
              >
                <IconComponent size={18} color={typeColor} />
              </View>

              {/* Text content */}
              <View style={styles.textContent}>
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.event.title}
                </Text>
                <Text
                  style={[styles.cardMeta, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {metaParts.join('  \u00B7  ')}
                </Text>
                <Text
                  style={[styles.cardSignals, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {signalsText}
                </Text>
              </View>
            </View>

            {/* Actions row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => handleAccept(item)}
                activeOpacity={0.7}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.secondaryBg },
                ]}
              >
                <Check size={18} color={colors.secondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDismiss(item.event.id)}
                activeOpacity={0.7}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.dangerBg },
                ]}
              >
                <X size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [colors, isDark, handleAccept, handleDismiss],
    );

    // ── Key extractor ────────────────────────────────
    const keyExtractor = useCallback(
      (item: ClassifiedEvent) => item.event.id,
      [],
    );

    // ── Header ───────────────────────────────────────
    const ListHeader = useMemo(
      () => (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Review Imports
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {items.length} event{items.length !== 1 ? 's' : ''} might be travel
            bookings
          </Text>
        </View>
      ),
      [colors, items.length],
    );

    // ── Empty state ──────────────────────────────────
    const ListEmpty = useMemo(
      () => (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            All caught up! No events to review.
          </Text>
        </View>
      ),
      [colors],
    );

    // ── Render ───────────────────────────────────────
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <BottomSheetFlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </BottomSheetModal>
    );
  },
);

CalendarReviewSheet.displayName = 'CalendarReviewSheet';
export default CalendarReviewSheet;

// ──────────────────────────────────────────────
// Static styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── List ──────────────────────────────────
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  // ── Header ────────────────────────────────
  header: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },

  // ── Card ──────────────────────────────────
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  cardSignals: {
    fontFamily: FontFamily.condensed,
    fontSize: 10,
    marginTop: 2,
  },

  // ── Actions ───────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ───────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
  },
});
