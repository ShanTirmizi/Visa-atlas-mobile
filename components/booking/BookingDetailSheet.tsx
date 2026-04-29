import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import Svg, { Path } from 'react-native-svg';
import {
  BedDouble,
  Car,
  Compass,
  Link2Off,
  MapPin,
  Phone,
  Plane,
  ShieldCheck,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import {
  bookingTypeColors,
  FontFamily,
  Shadows,
  type BookingHeroType,
  type ThemeColors,
} from '@/constants/theme';
import {
  type BookingStatus,
  type BookingType,
  formatRelativeDate,
} from '@/constants/bookings';
import { buildMapsSearchUrl, buildTelUrl } from '@/utils/maps';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { Guilloche } from '@/components/ui/Guilloche';

// ──────────────────────────────────────────────
// Public interface — preserved exactly so call sites keep compiling
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
  countryCode?: string;
}

interface BookingDetailSheetProps {
  onDelete?: () => void;
  onUnlink?: () => void;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function bookingTypeToHeroType(type: BookingType): BookingHeroType {
  if (type === 'car_rental') return 'car';
  return type as BookingHeroType;
}

const NUMBER_WORDS: Record<number, string> = {
  1: 'ONE',
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
  6: 'SIX',
  7: 'SEVEN',
  8: 'EIGHT',
  9: 'NINE',
  10: 'TEN',
};

function numberWord(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (isNaN(num)) return String(n).toUpperCase();
  return NUMBER_WORDS[num] ?? String(num);
}

function parseAirport(raw: string): { code: string; city: string } {
  if (!raw.trim()) return { code: '—', city: 'Unknown' };
  const match = raw.match(/\(([A-Z]{3})\)/);
  if (match) {
    return {
      code: match[1],
      city: raw.replace(/\s*\([A-Z]{3}\)\s*/, '').trim().toUpperCase(),
    };
  }
  const trimmed = raw.trim();
  if (trimmed.length <= 4) {
    return { code: trimmed.toUpperCase(), city: trimmed.toUpperCase() };
  }
  return { code: trimmed.slice(0, 3).toUpperCase(), city: trimmed.toUpperCase() };
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function fmtCurrency(cost?: number, currency?: string): string | null {
  if (cost == null) return null;
  const symbol =
    currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${cost.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtShortDate(iso: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

// ──────────────────────────────────────────────
// BookingHero — colored top zone
// ──────────────────────────────────────────────

interface BookingHeroProps {
  heroType: BookingHeroType;
  icon: React.ReactNode;
  statusPillLabel: string;
  kicker?: string;
  /** Pass null to suppress kicker row entirely (used by flight to render route block) */
  kickerSlot?: React.ReactNode;
  title: string;
  subline: React.ReactNode;
  children?: React.ReactNode;
}

function BookingHero({
  heroType,
  icon,
  statusPillLabel,
  kicker,
  kickerSlot,
  title,
  subline,
  children,
}: BookingHeroProps) {
  const tokens = bookingTypeColors[heroType];

  return (
    <View
      style={[
        heroStyles.outerWrapper,
        {
          shadowColor: '#1F1A14',
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.18,
          shadowRadius: 32,
          elevation: 8,
        },
      ]}
    >
      <View
        style={[
          heroStyles.inner,
          { borderRadius: 22 },
        ]}
      >
        <LinearGradient
          colors={[tokens.bgFrom, tokens.bgTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <Guilloche
          variant="wavy"
          color={tokens.ink}
          opacity={tokens.guillocheOpacity}
        />

        {/* Top row: icon orb + status pill */}
        <View style={heroStyles.topRow}>
          <View
            style={[
              heroStyles.iconOrb,
              { backgroundColor: tokens.secondary, borderRadius: 12 },
            ]}
          >
            {icon}
          </View>
          <View
            style={[
              heroStyles.statusPill,
              { backgroundColor: tokens.secondary, maxWidth: '68%', flexShrink: 1 },
            ]}
          >
            <View
              style={[
                heroStyles.statusDot,
                { backgroundColor: tokens.accent },
              ]}
            />
            <Text
              style={[
                heroStyles.statusText,
                { color: tokens.ink, letterSpacing: 11 * 0.22 },
              ]}
              numberOfLines={1}
            >
              {statusPillLabel}
            </Text>
          </View>
        </View>

        {/* Kicker or custom slot */}
        {kickerSlot !== undefined ? (
          kickerSlot
        ) : kicker ? (
          <Text
            style={[
              heroStyles.kicker,
              {
                color: tokens.ink,
                letterSpacing: 11 * 0.22,
                opacity: 0.85,
              },
            ]}
          >
            {kicker}
          </Text>
        ) : null}

        {/* Title */}
        <Text
          style={[
            heroStyles.title,
            {
              color: tokens.ink,
              letterSpacing: -36 * 0.022,
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Subline */}
        <View style={heroStyles.sublineRow}>{subline}</View>

        {/* Secondary card slot */}
        {children ? (
          <View
            style={[
              heroStyles.secondaryCard,
              { backgroundColor: tokens.secondary, borderRadius: 16 },
            ]}
          >
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// BookingMetaCard — white info card with rows
// ──────────────────────────────────────────────

interface MetaRow {
  label: string;
  value?: string | null;
}

interface BookingMetaCardProps {
  rows: MetaRow[];
  colors: ThemeColors;
}

function BookingMetaCard({ rows, colors }: BookingMetaCardProps) {
  const visibleRows = rows.filter((r) => r.value != null && r.value !== '');
  if (visibleRows.length === 0) return null;

  return (
    <View
      style={[
        metaStyles.card,
        { backgroundColor: colors.surface },
      ]}
    >
      {visibleRows.map((row, i) => (
        <View
          key={row.label}
          style={[
            metaStyles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
          ]}
        >
          <Text style={[metaStyles.label, { color: colors.inkMute }]}>
            {row.label}
          </Text>
          <Text
            style={[metaStyles.value, { color: colors.ink }]}
            numberOfLines={2}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────
// BookingDarkCTA — dark action pill (matches VisaGuideCTA pattern)
// ──────────────────────────────────────────────

interface BookingDarkCTAProps {
  kicker: string;
  label: string;
  accent: string;
  icon: React.ReactNode;
  onPress: () => void;
  colors: ThemeColors;
}

function BookingDarkCTA({ kicker, label, accent, icon, onPress, colors }: BookingDarkCTAProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        ctaStyles.pill,
        { backgroundColor: colors.ink, opacity: pressed ? 0.9 : 1 },
        Shadows.cardWarm,
      ]}
    >
      <View
        style={[
          ctaStyles.iconOrb,
          { borderColor: accent, backgroundColor: colors.solidOverlayFaint },
        ]}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            ctaStyles.kicker,
            { color: accent, letterSpacing: 9 * 0.2 },
          ]}
          numberOfLines={1}
        >
          {kicker}
        </Text>
        <Text
          style={ctaStyles.label}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      <View style={ctaStyles.arrowWrap}>
        <View style={[ctaStyles.arrowCircle, { backgroundColor: accent }]}>
          {/* Arrow right chevron */}
          <Text style={[ctaStyles.arrowText, { color: colors.ink }]}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// BookingActionRow — Unlink + Delete pair
// ──────────────────────────────────────────────

interface BookingActionRowProps {
  canUnlink: boolean;
  onUnlink: () => void;
  onDelete: () => void;
  colors: ThemeColors;
}

function BookingActionRow({
  canUnlink,
  onUnlink,
  onDelete,
  colors,
}: BookingActionRowProps) {
  return (
    <View style={actionStyles.row}>
      {canUnlink && (
        <Pressable
          onPress={onUnlink}
          accessibilityRole="button"
          accessibilityLabel="Unlink from trip"
          style={({ pressed }) => [
            actionStyles.btn,
            { backgroundColor: 'rgba(255,255,255,0.10)', opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Link2Off size={15} color="#FFFFFF" strokeWidth={2} />
          <Text style={[actionStyles.btnText, { color: '#FFFFFF' }]}>Unlink</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete booking"
        style={({ pressed }) => [
          actionStyles.btn,
          { flex: 1, backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Trash2 size={15} color="#FFFFFF" strokeWidth={2} />
        <Text style={[actionStyles.btnText, { color: '#FFFFFF' }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

// ──────────────────────────────────────────────
// SublineText — helper for the common "date · location" subline pattern
// ──────────────────────────────────────────────

function SublineText({
  text,
  location,
  tokens,
}: {
  text: string;
  location?: string;
  tokens: (typeof bookingTypeColors)[BookingHeroType];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      <Text style={[heroStyles.sublineText, { color: tokens.inkSoft }]}>{text}</Text>
      {location ? (
        <>
          <MapPin size={12} color={tokens.inkSoft} />
          <Text style={[heroStyles.sublineText, { color: tokens.inkSoft }]}>{location}</Text>
        </>
      ) : null}
    </View>
  );
}

// ══════════════════════════════════════════════
// Per-type renderers
// ══════════════════════════════════════════════

interface RendererProps {
  booking: BookingDetailData;
  colors: ThemeColors;
  onUnlink: () => void;
  onDelete: () => void;
}

// ──────────────────────────────────────────────
// 1. Restaurant
// ──────────────────────────────────────────────

function RestaurantSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.restaurant;
  const details = booking.typeDetails ?? {};
  const partySize = details.partySize ?? '';
  const cuisine = details.cuisine ?? '';
  const time = details.time ?? fmtTime(booking.startDate);
  const phone = details.phone ?? '';
  const restaurantName = details.name ?? booking.title;

  const partySizeNum = parseInt(partySize, 10);
  const kicker =
    partySize && !isNaN(partySizeNum)
      ? `A TABLE FOR ${numberWord(partySizeNum)}`
      : 'RESERVATION';

  const dateDisplay = fmtShortDate(booking.startDate);
  const sublineText = `${dateDisplay} · ${time}`;

  // CTA
  let ctaUrl: string | null = null;
  let ctaLabel = '';
  let ctaKicker = '';
  let ctaIsPhone = false;
  if (phone) {
    ctaUrl = buildTelUrl(phone);
    ctaLabel = 'Call the restaurant';
    ctaKicker = 'DIRECT DIAL';
    ctaIsPhone = true;
  } else {
    ctaUrl = buildMapsSearchUrl({
      name: restaurantName,
      location: booking.location,
      countryCode: booking.countryCode,
    });
    ctaLabel = 'Open in Maps';
    ctaKicker = 'DIRECTIONS';
  }

  // Held-until time: +15 min from reservation time
  let heldUntil: string | null = null;
  if (time && /^\d{1,2}:\d{2}$/.test(time)) {
    const [hStr, mStr] = time.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const totalMin = h * 60 + m + 15;
    heldUntil = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }

  return (
    <>
      <BookingHero
        heroType="restaurant"
        icon={<UtensilsCrossed size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel={booking.status.toUpperCase()}
        kicker={kicker}
        title={restaurantName}
        subline={
          <SublineText
            text={sublineText}
            location={booking.location}
            tokens={tokens}
          />
        }
      >
        {/* Secondary card: party-size block + cuisine */}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={restStyles.guestBlock}>
            <Text style={[restStyles.guestNum, { color: tokens.ink }]}>
              {partySize || '2'}
            </Text>
            <Text style={[restStyles.guestLabel, { color: tokens.ink }]}>
              GUESTS
            </Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
            <Text
              style={[
                restStyles.cuisineKicker,
                { color: tokens.accent, letterSpacing: 9 * 0.22 },
              ]}
            >
              {cuisine ? cuisine.toUpperCase() : 'CUISINE'} · TASTING
            </Text>
            <Text
              style={[restStyles.notesLine, { color: tokens.ink }]}
              numberOfLines={2}
            >
              {details.notes ?? "Chef's selection"}
            </Text>
          </View>
        </View>
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'CONFIRMATION', value: booking.confirmationNumber },
          { label: 'HELD UNTIL', value: heldUntil },
          { label: 'PHONE', value: phone || null },
        ]}
      />

      {ctaUrl ? (
        <BookingDarkCTA
          kicker={ctaKicker}
          label={ctaLabel}
          accent={tokens.accent}
          icon={
            ctaIsPhone
              ? <Phone size={14} color={tokens.accent} strokeWidth={2} />
              : <MapPin size={14} color={tokens.accent} strokeWidth={2} />
          }
          onPress={() => Linking.openURL(ctaUrl!)}
          colors={colors}
        />
      ) : null}

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ──────────────────────────────────────────────
// 2. Insurance
// ──────────────────────────────────────────────

function InsuranceSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.insurance;
  const details = booking.typeDetails ?? {};

  const startFmt = fmtShortDate(booking.startDate);
  const endFmt = booking.endDate ? fmtShortDate(booking.endDate) : '—';
  const sublineText = `${startFmt} → ${endFmt}`;

  const coverageLabel = (details.coverage ?? 'MEDICAL').toUpperCase();
  const formattedCost = fmtCurrency(booking.cost, booking.currency);

  return (
    <>
      <BookingHero
        heroType="insurance"
        icon={<ShieldCheck size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel="ACTIVE COVER"
        kicker="POLICY · CERTIFICATE"
        title={details.provider ?? booking.title}
        subline={
          <SublineText text={sublineText} tokens={tokens} />
        }
      >
        {/* Secondary card: coverage amount headline */}
        <View style={{ gap: 6 }}>
          {formattedCost ? (
            <>
              <Text
                style={[
                  insStyles.coverageKicker,
                  { color: tokens.accent, letterSpacing: 9 * 0.22 },
                ]}
              >
                {coverageLabel} · UP TO
              </Text>
              <Text style={[insStyles.coverageValue, { color: tokens.ink }]}>
                {formattedCost}
              </Text>
            </>
          ) : null}
          <Text style={[insStyles.coverageBody, { color: tokens.inkSoft }]}>
            Covers medical, evacuation, trip interruption & lost baggage.
          </Text>
        </View>
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'POLICY NO.', value: details.policyNumber },
          { label: 'PLAN', value: details.coverage ?? 'Standard' },
          { label: 'EMERGENCY', value: details.emergencyPhone ?? null },
        ]}
      />

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ──────────────────────────────────────────────
// 3. Car (mapped from car_rental)
// ──────────────────────────────────────────────

function CarSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.car;
  const details = booking.typeDetails ?? {};

  const pickupLocation = details.pickupLocation ?? '';
  const dropoffLocation = details.dropoffLocation ?? '';
  const dateDisplay = fmtShortDate(booking.startDate);
  const pickupTime = fmtTime(booking.startDate);

  // Approx dropoff: +90 min
  let dropoffTime: string | null = null;
  try {
    const d = new Date(booking.startDate);
    if (!isNaN(d.getTime())) {
      d.setMinutes(d.getMinutes() + 90);
      dropoffTime = `~${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  } catch {
    /* ignore */
  }

  const title =
    pickupLocation && dropoffLocation
      ? `${pickupLocation} → ${dropoffLocation}`
      : details.company ?? booking.title;

  // Status pill copy
  const humanDateShort = (() => {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    try {
      const d = new Date(booking.startDate);
      return `${d.getDate()} ${months[d.getMonth()]}`;
    } catch { return ''; }
  })();

  const statusPillLabel = pickupTime
    ? `PICKUP · ${humanDateShort} ${pickupTime}`
    : `PICKUP · ${humanDateShort}`;
  const formattedCost = fmtCurrency(booking.cost, booking.currency);

  // CTA
  const ctaUrl = pickupLocation
    ? buildMapsSearchUrl({ name: pickupLocation, countryCode: booking.countryCode })
    : null;

  return (
    <>
      <BookingHero
        heroType="car"
        icon={<Car size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel={statusPillLabel}
        kicker="PRIVATE TRANSFER"
        title={title}
        subline={
          <SublineText
            text={dateDisplay}
            location={pickupLocation || booking.location}
            tokens={tokens}
          />
        }
      >
        {/* Secondary card: pickup → dropoff timeline — only show when there's location data */}
        {(pickupLocation || dropoffLocation) ? (
          <View style={{ gap: 8 }}>
            {pickupLocation ? (
              <View style={carStyles.timelineRow}>
                <View style={[carStyles.dotFilled, { backgroundColor: tokens.accent, borderRadius: 3 }]} />
                <Text style={[carStyles.timelineLocation, { color: tokens.ink }]} numberOfLines={1}>
                  {pickupLocation}
                </Text>
                <Text style={[carStyles.timelineTime, { color: tokens.inkSoft }]}>
                  {pickupTime}
                </Text>
              </View>
            ) : null}

            {pickupLocation && dropoffLocation ? (
              <View style={carStyles.connectorRow}>
                <View style={{ width: 6 }} />
                <View style={{ height: 12, marginLeft: 3, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={2} height={12}>
                    <Path
                      d="M 1 0 L 1 12"
                      stroke={tokens.divider}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  </Svg>
                </View>
              </View>
            ) : null}

            {dropoffLocation ? (
              <View style={carStyles.timelineRow}>
                <View style={[carStyles.squareDot, { backgroundColor: tokens.accent }]} />
                <Text style={[carStyles.timelineLocation, { color: tokens.ink }]} numberOfLines={1}>
                  {dropoffLocation}
                </Text>
                {dropoffTime ? (
                  <Text style={[carStyles.timelineTime, { color: tokens.inkSoft }]}>
                    {dropoffTime}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'VEHICLE', value: details.carType },
          { label: 'DRIVER', value: details.driver ?? null },
          { label: 'COST', value: formattedCost },
        ]}
      />

      {ctaUrl ? (
        <BookingDarkCTA
          kicker="DIRECTIONS"
          label="Open pickup location"
          accent={tokens.accent}
          icon={<MapPin size={14} color={tokens.accent} strokeWidth={2} />}
          onPress={() => Linking.openURL(ctaUrl!)}
          colors={colors}
        />
      ) : null}

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ──────────────────────────────────────────────
// 4. Experience
// ──────────────────────────────────────────────

function ExperienceSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.experience;
  const details = booking.typeDetails ?? {};

  const activityName = details.activityName ?? booking.title;
  const duration = details.duration ?? '';
  const meetingPoint = details.meetingPoint ?? '';
  const groupSize = details.groupSize ?? '';
  const time = fmtTime(booking.startDate);
  const dateDisplay = fmtShortDate(booking.startDate);

  // Status pill: UPCOMING · TUE 29
  const statusPillLabel = (() => {
    const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    try {
      const d = new Date(booking.startDate);
      return `UPCOMING · ${DAYS[d.getDay()]} ${d.getDate()}`;
    } catch { return 'UPCOMING'; }
  })();

  const sublineText = `${dateDisplay} · ${time}`;

  // CTA
  const ctaUrl = meetingPoint
    ? buildMapsSearchUrl({
        name: meetingPoint,
        location: booking.location,
        countryCode: booking.countryCode,
      })
    : null;

  return (
    <>
      <BookingHero
        heroType="experience"
        icon={<Compass size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel={statusPillLabel}
        kicker="ADMIT ONE"
        title={activityName}
        subline={
          <SublineText
            text={sublineText}
            location={meetingPoint || booking.location}
            tokens={tokens}
          />
        }
      >
        {/* Secondary card: duration + group size cells */}
        <View style={expStyles.cells}>
          <View style={expStyles.cell}>
            <Text style={[expStyles.cellKicker, { color: tokens.accent, letterSpacing: 9 * 0.22 }]}>
              DURATION
            </Text>
            <Text style={[expStyles.cellValue, { color: tokens.ink }]}>
              {duration || '—'}
            </Text>
          </View>
          <View style={[expStyles.divider, { backgroundColor: tokens.divider }]} />
          <View style={expStyles.cell}>
            <Text style={[expStyles.cellKicker, { color: tokens.accent, letterSpacing: 9 * 0.22 }]}>
              GROUP
            </Text>
            <Text style={[expStyles.cellValue, { color: tokens.ink }]}>
              {groupSize ? `${groupSize} ppl` : '—'}
            </Text>
          </View>
        </View>
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'OPERATOR', value: booking.provider },
          {
            label: 'MEETING',
            value: meetingPoint
              ? (details.meetingTime ? `${details.meetingTime} · ${meetingPoint}` : meetingPoint)
              : null,
          },
          { label: 'LANGUAGES', value: details.languages ?? null },
        ]}
      />

      {ctaUrl ? (
        <BookingDarkCTA
          kicker="DIRECTIONS"
          label="Open meeting point"
          accent={tokens.accent}
          icon={<MapPin size={14} color={tokens.accent} strokeWidth={2} />}
          onPress={() => Linking.openURL(ctaUrl!)}
          colors={colors}
        />
      ) : null}

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ──────────────────────────────────────────────
// 5. Hotel
// ──────────────────────────────────────────────

function HotelSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.hotel;
  const details = booking.typeDetails ?? {};
  const hotelName = details.hotelName ?? booking.title;

  // Nights count
  const nights = (() => {
    if (!booking.endDate) return 0;
    try {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      return Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );
    } catch { return 0; }
  })();

  // Nights stayed so far
  const nightsStayed = (() => {
    try {
      const today = new Date();
      const start = new Date(booking.startDate);
      const stayed = Math.round(
        (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      return Math.max(0, Math.min(stayed, nights));
    } catch { return 0; }
  })();

  const startFmt = fmtShortDate(booking.startDate);
  const endFmt = booking.endDate ? fmtShortDate(booking.endDate) : '—';
  const sublineText = `${startFmt} → ${endFmt} · ${nights} night${nights !== 1 ? 's' : ''}`;
  const formattedCost = fmtCurrency(booking.cost, booking.currency);

  // Check-in relative label
  const checkInRelative = formatRelativeDate(booking.startDate);

  // CTA
  const ctaUrl = buildMapsSearchUrl({
    name: details.address || hotelName,
    location: booking.location,
    countryCode: booking.countryCode,
  });

  return (
    <>
      <BookingHero
        heroType="hotel"
        icon={<BedDouble size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel={`CHECK-IN ${checkInRelative.toUpperCase()}`}
        kicker="ROOM KEY"
        title={hotelName}
        subline={
          <SublineText
            text={sublineText}
            location={booking.location}
            tokens={tokens}
          />
        }
      >
        {/* Secondary card: night progress dots — only render when there's something to show */}
        {nights > 0 ? (
          <View style={hotelStyles.nightRow}>
            {/* Avatar dot */}
            <View style={[hotelStyles.avatarDot, { backgroundColor: tokens.accent }]} />

            {/* Progress dots */}
            <View style={hotelStyles.dotsRow}>
              {Array.from({ length: Math.min(nights, 14) }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    hotelStyles.nightDot,
                    i < nightsStayed
                      ? { backgroundColor: tokens.accent }
                      : {
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderColor: tokens.divider,
                        },
                  ]}
                />
              ))}
            </View>

            {/* Room label — only when a real roomType is set */}
            {details.roomType ? (
              <Text
                style={[
                  hotelStyles.roomLabel,
                  { color: tokens.accent, letterSpacing: 9 * 0.22 },
                ]}
              >
                RM · {details.roomType}
              </Text>
            ) : null}
          </View>
        ) : null}
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'COST', value: formattedCost },
          { label: 'CONFIRMATION', value: booking.confirmationNumber },
          { label: 'NOTES', value: booking.notes },
        ]}
      />

      {ctaUrl ? (
        <BookingDarkCTA
          kicker="DIRECTIONS"
          label="Open in Maps"
          accent={tokens.accent}
          icon={<MapPin size={14} color={tokens.accent} strokeWidth={2} />}
          onPress={() => Linking.openURL(ctaUrl!)}
          colors={colors}
        />
      ) : null}

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ──────────────────────────────────────────────
// 6. Flight — boarding pass with big italic airport codes
// ──────────────────────────────────────────────

function FlightSheet({ booking, colors, onUnlink, onDelete }: RendererProps) {
  const tokens = bookingTypeColors.flight;
  const details = booking.typeDetails ?? {};
  const [routeLineWidth, setRouteLineWidth] = useState(0);

  const dep = parseAirport(details.departure ?? '');
  const arr = parseAirport(details.arrival ?? '');
  const airline = details.airline ?? booking.provider ?? '';
  const flightNumber = details.flightNumber ?? '';
  const dateDisplay = fmtShortDate(booking.startDate);

  // Departure and arrival times
  const departTime = fmtTime(booking.startDate);
  const arrivalTime = booking.endDate ? fmtTime(booking.endDate) : '—';

  // +N DAY label for arrival
  const plusDays = (() => {
    if (!booking.endDate) return '';
    try {
      const s = new Date(booking.startDate);
      const e = new Date(booking.endDate);
      const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 ? `+${days} DAY` : '';
    } catch { return ''; }
  })();

  // Flight status pill
  const statusPillLabel = (() => {
    try {
      const now = new Date();
      const start = new Date(booking.startDate);
      const end = booking.endDate ? new Date(booking.endDate) : null;
      const diffH = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (end && now > end) return 'LANDED';
      if (now > start && diffH < 0 && (!end || now < end)) return 'IN FLIGHT';
      if (diffH >= 0) {
        if (diffH < 1) return 'BOARDING NOW';
        return `BOARDING IN ${Math.ceil(diffH)}H`;
      }
      if (diffH > -24) return 'IN FLIGHT';
      return 'LANDED';
    } catch { return 'UPCOMING'; }
  })();

  // Flight duration
  const flightDuration = (() => {
    if (details.duration) return details.duration.toUpperCase();
    if (booking.startDate && booking.endDate) {
      try {
        const diffMs = new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime();
        const totalMin = Math.floor(diffMs / (1000 * 60));
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0) return `${h}H ${m > 0 ? m + 'M' : ''}`.trim();
      } catch { /* ignore */ }
    }
    return null;
  })();

  const stops = details.stops ?? 'DIRECT';
  const flightInfo = flightDuration ? `${flightDuration} · ${stops}` : stops;

  // Route block to use as kicker slot
  const showDepCity = !!(dep.city && dep.city.toUpperCase() !== dep.code.toUpperCase());
  const showArrCity = !!(arr.city && arr.city.toUpperCase() !== arr.code.toUpperCase());

  const routeBlock = (
    <View style={flightStyles.routeBlock}>
      {/* Left: departure */}
      <View style={flightStyles.routeEndLeft}>
        {showDepCity ? (
          <Text style={[flightStyles.cityLabel, { color: tokens.inkSoft }]}>
            {dep.city.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[flightStyles.airportCode, { color: tokens.ink }]}>
          {dep.code}
        </Text>
      </View>

      {/* Middle: dotted line + flight info */}
      <View
        style={flightStyles.routeMiddle}
        onLayout={(e) => setRouteLineWidth(e.nativeEvent.layout.width)}
      >
        {/* Dashed line — absolutely positioned centerline */}
        {routeLineWidth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              marginTop: -1,
              height: 2,
            }}
          >
            <Svg width={routeLineWidth} height={2}>
              <Path
                d={`M 0 1 L ${routeLineWidth} 1`}
                stroke={tokens.inkSoft}
                strokeWidth={1}
                strokeDasharray="3 4"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
        ) : null}

        {/* Yellow accent triangle on midpoint of line */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -7,
            marginTop: -6,
          }}
        >
          <Svg width={14} height={12} viewBox="0 0 14 12">
            <Path
              d="M 1 1 L 12 6 L 1 11 Z"
              fill={tokens.accent}
            />
          </Svg>
        </View>

        {/* Caption below the line */}
        <Text
          style={[
            flightStyles.flightInfoText,
            {
              color: tokens.inkSoft,
              position: 'absolute',
              bottom: 6,
              left: 0,
              right: 0,
              textAlign: 'center',
            },
          ]}
          numberOfLines={1}
        >
          {flightInfo}
        </Text>
      </View>

      {/* Right: arrival */}
      <View style={flightStyles.routeEndRight}>
        {showArrCity ? (
          <Text style={[flightStyles.cityLabel, { color: tokens.inkSoft }]}>
            {arr.city.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[flightStyles.airportCode, { color: tokens.ink }]}>
          {arr.code}
        </Text>
      </View>
    </View>
  );

  // Subline below route block
  const sublineContent = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      <Text style={[heroStyles.sublineText, { color: tokens.inkSoft }]}>
        {dateDisplay}
        {airline ? ` · ${airline}` : ''}
        {flightNumber ? ` ${flightNumber}` : ''}
      </Text>
    </View>
  );

  return (
    <>
      <BookingHero
        heroType="flight"
        icon={<Plane size={20} color="#FFFFFF" strokeWidth={2} />}
        statusPillLabel={statusPillLabel}
        kickerSlot={routeBlock}
        title=""
        subline={sublineContent}
      >
        {/* Secondary card: dark depart/arrive split */}
        <View style={flightStyles.splitCard}>
          <View style={flightStyles.splitCell}>
            <Text
              style={[
                flightStyles.splitKicker,
                { color: tokens.accent, letterSpacing: 9 * 0.22 },
              ]}
            >
              DEPART
            </Text>
            <Text
              style={[
                flightStyles.splitTime,
                { color: tokens.accent, fontFamily: FontFamily.monoMedium },
              ]}
            >
              {departTime}
            </Text>
            <Text style={[flightStyles.splitCity, { color: tokens.inkSoft }]}>
              {dep.city}
            </Text>
          </View>
          <View style={[flightStyles.splitDivider, { backgroundColor: tokens.divider }]} />
          <View style={flightStyles.splitCell}>
            <Text
              style={[
                flightStyles.splitKicker,
                { color: tokens.accent, letterSpacing: 9 * 0.22 },
              ]}
            >
              ARRIVE
            </Text>
            <Text
              style={[
                flightStyles.splitTime,
                { color: tokens.accent, fontFamily: FontFamily.monoMedium },
              ]}
            >
              {arrivalTime}
            </Text>
            <Text style={[flightStyles.splitCity, { color: tokens.inkSoft }]}>
              {plusDays || arr.city}
            </Text>
          </View>
        </View>
      </BookingHero>

      <BookingMetaCard
        colors={colors}
        rows={[
          { label: 'CLASS', value: details.class },
          { label: 'GATE', value: details.gate ?? null },
          { label: 'CONFIRMATION', value: booking.confirmationNumber },
        ]}
      />

      <BookingActionRow
        canUnlink={!!booking.tripId}
        onUnlink={onUnlink}
        onDelete={onDelete}
        colors={colors}
      />
    </>
  );
}

// ══════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════

const SHEET_RENDERERS: Record<BookingType, React.ComponentType<RendererProps>> = {
  restaurant: RestaurantSheet,
  insurance: InsuranceSheet,
  car_rental: CarSheet,
  experience: ExperienceSheet,
  hotel: HotelSheet,
  flight: FlightSheet,
};

const BookingDetailSheet = forwardRef<BookingDetailSheetRef, BookingDetailSheetProps>(
  ({ onDelete, onUnlink }, ref) => {
    const { colors } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [booking, setBooking] = useState<BookingDetailData | null>(null);

    const deleteBooking = useMutation(api.bookings.deleteBooking);
    const unlinkBookingFromTrip = useMutation(api.bookings.unlinkBookingFromTrip);

    useImperativeHandle(ref, () => ({
      open: (data: BookingDetailData) => {
        setBooking(data);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

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

    const sheetBg = booking
      ? bookingTypeColors[bookingTypeToHeroType(booking.type)].bgFrom
      : colors.background;

    const SheetRenderer = booking ? SHEET_RENDERERS[booking.type] : null;

    return (
      <AppBottomSheet
        ref={bottomSheetRef}
        backgroundColor={sheetBg}
      >
        <BottomSheetScrollView
          contentContainerStyle={sheetStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {SheetRenderer && booking ? (
            <SheetRenderer
              booking={booking}
              colors={colors}
              onUnlink={handleUnlink}
              onDelete={handleDelete}
            />
          ) : (
            <View style={{ height: 20 }} />
          )}
        </BottomSheetScrollView>
      </AppBottomSheet>
    );
  },
);

BookingDetailSheet.displayName = 'BookingDetailSheet';
export default BookingDetailSheet;

// ══════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════

const heroStyles = StyleSheet.create({
  outerWrapper: {
    marginHorizontal: 14,
    borderRadius: 22,
  },
  inner: {
    overflow: 'hidden',
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconOrb: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 36,
    lineHeight: 38,
    marginBottom: 8,
  },
  sublineRow: {
    marginTop: 2,
  },
  sublineText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
  },
  secondaryCard: {
    marginTop: 16,
    padding: 16,
  },
});

const metaStyles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 11 * 0.1,
  },
  value: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 16,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
});

const ctaStyles = StyleSheet.create({
  pill: {
    marginHorizontal: 14,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 15,
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -15 * 0.01,
  },
  arrowWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 24,
    marginTop: -1,
  },
});

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    minHeight: 44,
  },
  btnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
});

const sheetStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
});

// ── Per-type local styles ──

const restStyles = StyleSheet.create({
  guestBlock: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  guestNum: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 56,
    lineHeight: 56,
  },
  guestLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  cuisineKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  notesLine: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 18,
    lineHeight: 22,
  },
});

const insStyles = StyleSheet.create({
  coverageKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coverageValue: {
    fontFamily: FontFamily.displaySemiboldItalic,
    fontSize: 44,
    fontWeight: '500',
    lineHeight: 46,
  },
  coverageBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});

const carStyles = StyleSheet.create({
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotFilled: {
    width: 6,
    height: 6,
  },
  squareDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  timelineLocation: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    flex: 1,
  },
  timelineTime: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 12,
  },
  verticalDash: {
    width: 1,
    height: 12,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    marginLeft: 2.5,
  },
});

const expStyles = StyleSheet.create({
  cells: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    gap: 4,
  },
  divider: {
    width: 1,
    height: 44,
    marginHorizontal: 12,
  },
  cellKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cellValue: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 22,
    lineHeight: 26,
  },
});

const hotelStyles = StyleSheet.create({
  nightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  nightDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  roomLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

const flightStyles = StyleSheet.create({
  routeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
    marginTop: 4,
  },
  routeEndLeft: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  routeEndRight: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  cityLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 9 * 0.18,
    marginBottom: 2,
  },
  airportCode: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 56,
    lineHeight: 58,
  },
  routeMiddle: {
    flex: 1,
    position: 'relative',
    paddingHorizontal: 8,
    minHeight: 56,
  },
  flightInfoText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 9 * 0.14,
    textAlign: 'center',
    marginBottom: 2,
  },
  splitCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitCell: {
    flex: 1,
    gap: 3,
  },
  splitDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
  splitKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  splitTime: {
    fontSize: 32,
    lineHeight: 34,
  },
  splitCity: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 9 * 0.14,
  },
});
