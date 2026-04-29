import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ChevronRight, Clock, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';

export type GuideStatus = 'preparing' | 'submitted' | 'approved' | 'rejected';

interface Props {
  countryCode: string;
  countryName: string;
  visaType: string;
  status: GuideStatus;
  /** Number of checked checklist items. */
  checked: number;
  /** Total checklist items. */
  total: number;
  /** Optional ISO date string for the deadline; hidden when absent. */
  deadline?: string;
  onPress: () => void;
  /** Optional delete handler. When provided, a small trash button is rendered
   *  next to the chevron, AND long-pressing the card triggers the same flow. */
  onDelete?: () => void;
  /** Set to true while the delete mutation is in flight to dim the card. */
  deleting?: boolean;
}

/** Visual variants for the status pill. The 'preparing' status splits into
 *  two flavours: PREPARING (warning amber) for low progress, ALMOST READY
 *  (visa-free green) once the checklist is mostly complete. */
function resolveStatusVisual(
  status: GuideStatus,
  pct: number,
): { label: string; tokenFg: 'warning' | 'visaFree' | 'coralDeep' | 'rose'; tokenBg: 'warningBg' | 'visaFreeBg' | 'coralBg' | 'dangerBg' } {
  if (status === 'preparing' && pct >= 75) {
    return { label: 'ALMOST READY', tokenFg: 'visaFree', tokenBg: 'visaFreeBg' };
  }
  switch (status) {
    case 'preparing':
      return { label: 'PREPARING', tokenFg: 'warning', tokenBg: 'warningBg' };
    case 'submitted':
      return { label: 'SUBMITTED', tokenFg: 'coralDeep', tokenBg: 'coralBg' };
    case 'approved':
      return { label: 'APPROVED', tokenFg: 'visaFree', tokenBg: 'visaFreeBg' };
    case 'rejected':
      return { label: 'REJECTED', tokenFg: 'rose', tokenBg: 'dangerBg' };
  }
}

const A3_TO_A2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', AUS: 'AU', AUT: 'AT', BEL: 'BE', BGR: 'BG', BRA: 'BR',
  CAN: 'CA', CHE: 'CH', CHL: 'CL', CHN: 'CN', COL: 'CO', CZE: 'CZ', DEU: 'DE',
  DNK: 'DK', EGY: 'EG', ESP: 'ES', FIN: 'FI', FRA: 'FR', GBR: 'GB', GRC: 'GR',
  HRV: 'HR', HUN: 'HU', IDN: 'ID', IND: 'IN', IRL: 'IE', ISL: 'IS', ITA: 'IT',
  JPN: 'JP', KOR: 'KR', LUX: 'LU', MAR: 'MA', MEX: 'MX', MYS: 'MY', NLD: 'NL',
  NOR: 'NO', NPL: 'NP', NZL: 'NZ', PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT',
  ROU: 'RO', SAU: 'SA', SGP: 'SG', SVK: 'SK', SVN: 'SI', SWE: 'SE', THA: 'TH',
  TUR: 'TR', UAE: 'AE', ARE: 'AE', USA: 'US', VNM: 'VN', ZAF: 'ZA',
};

export function GuideApplicationCard({
  countryCode,
  countryName,
  visaType,
  status,
  checked,
  total,
  deadline,
  onPress,
  onDelete,
  deleting,
}: Props) {
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const visual = resolveStatusVisual(status, pct);
  const alpha2 = A3_TO_A2[countryCode.toUpperCase()] ?? countryCode.slice(0, 2).toUpperCase();
  const isInProgress = status === 'preparing' || status === 'submitted';
  const accentColor = pct >= 75 ? colors.visaFree : colors.coral;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      delayLongPress={420}
      accessibilityRole="button"
      accessibilityLabel={`Open ${countryName} visa guide`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: deleting ? 0.45 : pressed ? 0.94 : 1,
        },
      ]}
    >
      {/* Left accent strip — coloured for in-progress applications */}
      {isInProgress ? (
        <View
          style={[
            styles.accentStrip,
            { backgroundColor: accentColor },
          ]}
        />
      ) : null}

      {/* Card body */}
      <View style={styles.body}>
        {/* Top row: flag + name/visaType + progress ring */}
        <View style={styles.topRow}>
          {/* Flag circle */}
          <View style={styles.flagWrap}>
            <Flag code={alpha2} size={36} />
          </View>

          {/* Name + visa type */}
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[styles.name, { color: colors.ink }]}
              numberOfLines={1}
            >
              {countryName}
            </Text>
            <Text
              style={[
                styles.visaType,
                { color: colors.inkMute, letterSpacing: 9 * 0.22 },
              ]}
              numberOfLines={2}
            >
              {visaType.toUpperCase()}
            </Text>
          </View>

          {/* Progress ring — right side */}
          <View style={styles.ringWrap}>
            <ProgressRing
              percent={pct}
              size={68}
              strokeWidth={5}
              color={accentColor}
              trackColor={colors.line}
            />
            <View style={styles.ringInner} pointerEvents="none">
              <Text style={[styles.ringPct, { color: colors.ink }]}>
                {pct}%
              </Text>
            </View>
          </View>
        </View>

        {/* Doc squares strip */}
        {total > 0 ? (
          <View style={styles.squaresRow}>
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.square,
                  {
                    backgroundColor:
                      i < checked ? accentColor : colors.surfaceMuted,
                    borderColor: i < checked ? accentColor : colors.line,
                  },
                ]}
              />
            ))}
            <Text
              style={[
                styles.docCount,
                { color: colors.inkMute },
              ]}
            >
              {checked}/{total} DOCS
            </Text>
          </View>
        ) : null}

        {/* Bottom row: status pill + deadline + chevron */}
        <View style={styles.bottomRow}>
          <View style={styles.bottomLeftCluster}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: colors[visual.tokenBg] },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: colors[visual.tokenFg],
                    letterSpacing: 10 * 0.22,
                  },
                ]}
              >
                {visual.label}
              </Text>
            </View>

            {deadline ? (
              <View style={styles.deadlineCluster}>
                <Clock size={11} color={colors.inkMute} strokeWidth={2} />
                <Text
                  style={[
                    styles.deadlineText,
                    { color: colors.inkMute, letterSpacing: 10 * 0.22 },
                  ]}
                >
                  DEADLINE · {formatDeadline(deadline)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.iconCluster}>
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                hitSlop={6}
                accessibilityLabel="Delete guide"
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    borderColor: colors.line,
                    backgroundColor: pressed ? colors.dangerBg : 'transparent',
                  },
                ]}
              >
                <Trash2
                  size={13}
                  color={colors.inkMute}
                  strokeWidth={1.75}
                />
              </Pressable>
            ) : null}

            <View
              style={[
                styles.iconBtn,
                { borderColor: colors.line },
              ]}
            >
              <ChevronRight size={14} color={colors.inkMute} strokeWidth={2} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Circular progress ring (SVG). Stroke wraps clockwise from 12 o'clock. */
function ProgressRing({
  percent,
  size,
  strokeWidth,
  color,
  trackColor,
}: {
  percent: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Inner light ring (for the concentric look in the mockup) */}
      <Circle
        cx={cx}
        cy={cy}
        r={r - strokeWidth - 2}
        stroke={trackColor}
        strokeWidth={1}
        fill="none"
        opacity={0.5}
      />
      {/* Progress arc */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

function formatDeadline(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return iso;
  }
}

export default GuideApplicationCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  body: {
    padding: 16,
    paddingLeft: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flagWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  name: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -18 * 0.014,
  },
  visaType: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
  },
  ringWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: -14 * 0.014,
  },
  squaresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  square: {
    width: 14,
    height: 12,
    borderRadius: 2,
    borderWidth: 0.75,
  },
  docCount: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.22,
    marginLeft: 'auto',
    paddingLeft: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  bottomLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  deadlineCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deadlineText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  iconCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
