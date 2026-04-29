import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { bestTimeStatus } from '@/utils/bestTime';

interface BestTimeBarProps {
  /** 1–12 month numbers that are the country's best months. */
  bestMonths: number[] | undefined;
}

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 12-month visual climate bar — green = best, amber = shoulder, rose = avoid.
 *  The current month is ringed in ink so the user spots "now" instantly. */
export function BestTimeBar({ bestMonths }: BestTimeBarProps) {
  const { colors } = useTheme();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  if (!bestMonths || bestMonths.length === 0) {
    return null;
  }

  const palette = {
    good: colors.visaFree,        // green
    shoulder: colors.visaOnArrival, // amber
    avoid: colors.visaRequired,   // rose
  };

  // Find the longest contiguous "good" run for the headline label.
  const goodLabel = formatGoodRun(bestMonths);

  return (
    <View>
      {/* Headline row: italic label + small legend */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
            BEST TIME
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 17,
              fontWeight: '500',
              letterSpacing: -17 * 0.012,
              color: colors.ink,
              marginTop: 2,
            }}
          >
            {goodLabel}
          </Text>
        </View>
        <View style={styles.legend}>
          <LegendDot color={palette.good} label="Best" colors={colors} />
          <LegendDot color={palette.shoulder} label="OK" colors={colors} />
          <LegendDot color={palette.avoid} label="Skip" colors={colors} />
        </View>
      </View>

      {/* 12-cell month bar */}
      <View style={styles.bar}>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const status = bestTimeStatus(bestMonths, month);
          const color = palette[status];
          const isCurrent = month === currentMonth;

          // First cell rounds left, last cell rounds right; middle cells stay square
          // so the bar reads as one continuous segmented strip.
          const cellRadius = i === 0
            ? { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }
            : i === 11
              ? { borderTopRightRadius: 6, borderBottomRightRadius: 6 }
              : {};

          return (
            <View
              key={month}
              style={[
                styles.cell,
                cellRadius,
                {
                  backgroundColor: color,
                  borderRightWidth: i < 11 ? 1 : 0,
                  borderRightColor: colors.surface,
                },
              ]}
            >
              {isCurrent ? (
                <View
                  style={[
                    styles.currentRing,
                    { borderColor: colors.ink },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Month letters under the bar */}
      <View style={styles.labelsRow}>
        {MONTH_LETTERS.map((letter, i) => {
          const isCurrent = i + 1 === currentMonth;
          return (
            <Text
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: FontFamily.monoMedium,
                fontSize: 9,
                fontWeight: isCurrent ? '700' : '500',
                color: isCurrent ? colors.ink : colors.inkMute,
                letterSpacing: 0.3,
              }}
            >
              {letter}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function LegendDot({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: { inkMute: string };
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 8,
          fontWeight: '600',
          color: colors.inkMute,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Format the bestMonths array as a human-readable label for the headline. */
function formatGoodRun(bestMonths: number[]): string {
  // Group consecutive months (handling Dec→Jan wrap) into ranges.
  const sorted = [...bestMonths].sort((a, b) => a - b);
  const set = new Set(sorted);

  // Detect wraparound runs (e.g. [10,11,12,1,2,3])
  const ranges: Array<[number, number]> = [];
  let visited = new Set<number>();

  for (const m of sorted) {
    if (visited.has(m)) continue;
    let start = m;
    while (set.has(((start - 2 + 12) % 12) + 1)) {
      const prev = ((start - 2 + 12) % 12) + 1;
      if (visited.has(prev)) break;
      start = prev;
    }
    let end = start;
    visited.add(end);
    while (set.has((end % 12) + 1)) {
      const next = (end % 12) + 1;
      if (visited.has(next)) break;
      end = next;
      visited.add(end);
    }
    ranges.push([start, end]);
  }

  return ranges
    .map(([a, b]) =>
      a === b ? MONTH_NAMES[a - 1] : `${MONTH_NAMES[a - 1]} – ${MONTH_NAMES[b - 1]}`,
    )
    .join(', ');
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  legend: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  bar: {
    flexDirection: 'row',
    height: 22,
    overflow: 'hidden',
    borderRadius: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
});

export default BestTimeBar;
