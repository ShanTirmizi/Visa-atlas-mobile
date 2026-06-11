/**
 * PassportStamp — a single entry stamp on the passport wall.
 *
 * Art direction follows the house stamp (components/auth/VAStamp.tsx):
 * doubled SVG border (heavy outer ring + faint inner ring), mono letterspaced
 * caps, engraved single-ink look. Two shapes rotate through the wall the way
 * real passport pages mix border stamps:
 *
 *  - rounded-rect entry stamp — `ENTRY · 04` header, flag, country in mono
 *    caps, DD MMM YYYY date, port code footer, dashed rules between rows
 *  - circular stamp — country name set on the top text arc, `VISA ATLAS ·
 *    ENTRY` on the bottom arc, flag + date in the middle (VAStamp treatment)
 *
 * Rotation (±6°), ink tone (teal / coral-deep / ink) and shape are all
 * deterministic from the trip id — no Math.random at render, so the wall is
 * stable across visits like a real passport page.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Rect,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';
import { hashTripId, stampInk, stampRotation } from './passportData';

interface PassportStampProps {
  /** Convex trip id — seeds rotation / ink / shape deterministically. */
  tripId: string;
  countryCode: string;
  countryName: string;
  /** Pre-formatted entry date, e.g. `14 JUN 2026`. */
  dateLabel: string;
  /** Airport / port code shown in the footer, e.g. `NRT`. */
  iataCode?: string;
  /** Position on the wall (0-based) — printed as the entry number. */
  index: number;
  /** Grid cell width — height derives from it. */
  width: number;
  onPress?: () => void;
}

/** Cell aspect — slightly taller than square so rect stamps read as visas. */
const CELL_ASPECT = 1.08;

export function PassportStamp({
  tripId,
  countryCode,
  countryName,
  dateLabel,
  iataCode,
  index,
  width,
  onPress,
}: PassportStampProps) {
  const { colors } = useTheme();
  const height = Math.round(width * CELL_ASPECT);
  const ink = stampInk(tripId, colors);
  const rotation = stampRotation(tripId);
  // Roughly every third stamp goes circular — but only when the country name
  // is short enough to sit on the top arc without crowding the ring.
  const circular = hashTripId(tripId) % 3 === 0 && countryName.length <= 12;
  const entryNo = String(index + 1).padStart(2, '0');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${countryName} entry stamp, ${dateLabel}`}
      style={({ pressed }) => [
        {
          width,
          height,
          transform: [{ rotate: `${rotation}deg` }],
          // Inked, hand-pressed feel — full-strength vector borders read as
          // printed chrome, not a rubber stamp (same trick as ApprovedStamp).
          opacity: pressed ? 0.7 : 0.92,
        },
      ]}
    >
      {circular ? (
        <CircularStamp
          tripId={tripId}
          countryCode={countryCode}
          countryName={countryName}
          dateLabel={dateLabel}
          entryNo={entryNo}
          width={width}
          height={height}
          ink={ink}
        />
      ) : (
        <RectStamp
          countryCode={countryCode}
          countryName={countryName}
          dateLabel={dateLabel}
          iataCode={iataCode}
          entryNo={entryNo}
          width={width}
          height={height}
          ink={ink}
        />
      )}
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Rounded-rect entry stamp
// ──────────────────────────────────────────────
function RectStamp({
  countryCode,
  countryName,
  dateLabel,
  iataCode,
  entryNo,
  width,
  height,
  ink,
}: {
  countryCode: string;
  countryName: string;
  dateLabel: string;
  iataCode?: string;
  entryNo: string;
  width: number;
  height: number;
  ink: string;
}) {
  // Dashed rules sit just inside the header / footer text rows.
  const ruleTopY = 31;
  const ruleBottomY = height - 31;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Outer border — heavy ring */}
        <Rect
          x={1}
          y={1}
          width={width - 2}
          height={height - 2}
          rx={16}
          stroke={ink}
          strokeWidth={1.8}
          fill="none"
        />
        {/* Inner border — faint companion ring, VAStamp treatment */}
        <Rect
          x={6.5}
          y={6.5}
          width={width - 13}
          height={height - 13}
          rx={11}
          stroke={ink}
          strokeWidth={1}
          fill="none"
          opacity={0.55}
        />
        {/* Dashed rules separating header / body / footer */}
        <Line
          x1={18}
          y1={ruleTopY}
          x2={width - 18}
          y2={ruleTopY}
          stroke={ink}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.45}
        />
        <Line
          x1={18}
          y1={ruleBottomY}
          x2={width - 18}
          y2={ruleBottomY}
          stroke={ink}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.45}
        />
      </Svg>

      {/* Header — entry number */}
      <View style={[styles.rectHeader, { height: ruleTopY }]}>
        <Text style={[styles.ringText, { color: ink }]} numberOfLines={1}>
          {`ADMITTED · ENTRY ${entryNo}`}
        </Text>
      </View>

      {/* Body — flag, country, date */}
      <View
        style={[
          styles.rectBody,
          { top: ruleTopY, bottom: height - ruleBottomY },
        ]}
      >
        <Flag code={countryCode} size={22} />
        <Text
          style={[styles.rectCountry, { color: ink }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {countryName.toUpperCase()}
        </Text>
        <Text style={[styles.rectDate, { color: ink }]} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>

      {/* Footer — port code */}
      <View style={[styles.rectFooter, { height: height - ruleBottomY }]}>
        <Text style={[styles.ringText, { color: ink }]} numberOfLines={1}>
          {iataCode ? `${iataCode.toUpperCase()} · VISA ATLAS` : 'VISA ATLAS'}
        </Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Circular stamp — VAStamp's ring-text treatment with the country on the arc
// ──────────────────────────────────────────────
function CircularStamp({
  tripId,
  countryCode,
  countryName,
  dateLabel,
  entryNo,
  width,
  height,
  ink,
}: {
  tripId: string;
  countryCode: string;
  countryName: string;
  dateLabel: string;
  entryNo: string;
  width: number;
  height: number;
  ink: string;
}) {
  const size = Math.min(width, height) - 4;
  const r = size / 2;
  const arcR = r - 12;
  const cx = width / 2;
  const cy = height / 2;
  // Arc paths mirror VAStamp: text reads left-to-right over the top and
  // along the bottom of the ring.
  const topArcD = `M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`;
  const bottomArcD = `M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 0 ${cx + arcR} ${cy}`;
  // Per-stamp unique ids — TextPath href resolves globally within the page,
  // so two circular stamps must not share Defs ids.
  const topId = `stampTop-${tripId}`;
  const bottomId = `stampBottom-${tripId}`;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Path id={topId} d={topArcD} />
          <Path id={bottomId} d={bottomArcD} />
        </Defs>
        {/* Outer + inner rings */}
        <Circle cx={cx} cy={cy} r={r - 1.5} stroke={ink} strokeWidth={1.8} fill="none" />
        <Circle cx={cx} cy={cy} r={r - 8} stroke={ink} strokeWidth={1} fill="none" opacity={0.55} />
        {/* Country name on the top arc */}
        <SvgText
          fill={ink}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.075}
          letterSpacing={size * 0.018}
          textAnchor="middle"
        >
          <TextPath href={`#${topId}`} startOffset="50%">
            {`· ${countryName.toUpperCase()} ·`}
          </TextPath>
        </SvgText>
        {/* House mark on the bottom arc */}
        <SvgText
          fill={ink}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.066}
          letterSpacing={size * 0.014}
          textAnchor="middle"
        >
          <TextPath href={`#${bottomId}`} startOffset="50%">
            VISA ATLAS · ENTRY
          </TextPath>
        </SvgText>
        {/* Entry date through the centre */}
        <SvgText
          x={cx}
          y={cy + size * 0.21}
          fill={ink}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.082}
          letterSpacing={size * 0.008}
          textAnchor="middle"
        >
          {dateLabel}
        </SvgText>
        {/* Entry number, small, beneath the date */}
        <SvgText
          x={cx}
          y={cy + size * 0.33}
          fill={ink}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.06}
          letterSpacing={size * 0.012}
          textAnchor="middle"
          opacity={0.7}
        >
          {`ENTRY ${entryNo}`}
        </SvgText>
      </Svg>
      {/* Flag sits just above centre, between the arc text and the date */}
      <View style={{ position: 'absolute', top: cy - size * 0.26, left: 0, right: 0, alignItems: 'center' }}>
        <Flag code={countryCode} size={size * 0.2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 8 * 0.16,
    textTransform: 'uppercase',
  },
  rectHeader: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  rectBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rectCountry: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 12.5 * 0.1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rectDate: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 10 * 0.08,
  },
  rectFooter: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
});

export default PassportStamp;
