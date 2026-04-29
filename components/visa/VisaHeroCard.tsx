import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FontFamily,
  visaCategoryColors,
  type VisaHeroCategory,
} from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Guilloche } from '@/components/ui/Guilloche';
import { PassportStamp } from './PassportStamp';
import { VisaMetaStrip, type MetaItem } from './VisaMetaStrip';
import { VisaGuideCTA } from './VisaGuideCTA';

interface VisaHeroCardProps {
  category: VisaHeroCategory;
  /** Top-left mono kicker — e.g. "YOU'RE COVERED", "PAY AT THE GATE". */
  kicker: string;
  /** First line of the italic headline. */
  headlineLine1: string;
  /** Second line of the italic headline. The period is appended automatically in accent ink. */
  headlineLine2: string;
  /** Body — pre-built React node so the call site controls underline / bold spans. */
  body: React.ReactNode;
  /** 3 meta cells in display order. */
  meta: [MetaItem, MetaItem, MetaItem];
  /** Stamp content — rotation is read from theme tokens per category. */
  stamp: { label: string; date: string };
  /** Optional CTA — only renders for evisa / required. Ignored for free / arrival. */
  onCreateGuide?: () => void;
  ctaLabel?: string;
  ctaKicker?: string;
  /** Optional soft footer row (free / arrival) — pre-built so the call site controls bold spans. */
  footerRow?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const KICKER_DOT = 8;

export function VisaHeroCard({
  category,
  kicker,
  headlineLine1,
  headlineLine2,
  body,
  meta,
  stamp,
  onCreateGuide,
  ctaLabel,
  ctaKicker,
  footerRow,
  style,
}: VisaHeroCardProps) {
  const tokens = visaCategoryColors[category];
  const { colors } = useTheme();
  const showCTA = (category === 'evisa' || category === 'required') && !!onCreateGuide;

  return (
    <View style={style}>
      {/* Outer wrapper — carries shadow + matching radius, does NOT clip
          (CLAUDE.md "Drop shadows on rounded cards"). */}
      <View
        style={{
          borderRadius: 22,
          shadowColor: '#1F1A14',
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.18,
          shadowRadius: 32,
          elevation: 8,
        }}
      >
        {/* Inner clipped gradient — the guilloche + content lives here */}
        <View style={{ borderRadius: 22, overflow: 'hidden', position: 'relative' }}>
          <LinearGradient
            colors={[tokens.bgFrom, tokens.bgTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 1 }}
            style={{ paddingTop: 22, paddingBottom: 20, paddingHorizontal: 22 }}
          >
            <Guilloche
              variant="wavy"
              color={tokens.ink}
              opacity={tokens.guillocheOpacity}
              density={category === 'required' ? 'tight' : 'med'}
            />

            {/* Top row — kicker dot + label, stamp right */}
            <View
              style={{
                position: 'relative',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 4,
                  flexShrink: 1,
                }}
              >
                <View
                  style={{
                    width: KICKER_DOT,
                    height: KICKER_DOT,
                    borderRadius: KICKER_DOT / 2,
                    backgroundColor: category === 'required' ? tokens.accent : tokens.ink,
                  }}
                />
                <Text
                  style={{
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 11,
                    fontWeight: '600',
                    color: tokens.ink,
                    letterSpacing: 11 * 0.22,
                  }}
                  numberOfLines={1}
                >
                  {kicker}
                </Text>
              </View>

              <PassportStamp
                label={stamp.label}
                date={stamp.date}
                color={tokens.accent}
                rotation={tokens.stampRotation}
              />
            </View>

            {/* Headline */}
            <View style={{ position: 'relative', marginTop: 22 }}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 48,
                  fontWeight: '500',
                  lineHeight: 52,
                  letterSpacing: -48 * 0.022,
                  color: tokens.ink,
                }}
              >
                {headlineLine1}
                {'\n'}
                {headlineLine2}
                <Text
                  style={{
                    fontStyle: 'normal',
                    color: category === 'evisa' ? tokens.ink : tokens.accent,
                    opacity: category === 'evisa' ? 0.55 : 1,
                  }}
                >
                  .
                </Text>
              </Text>

              {/* Body */}
              <View style={{ marginTop: 14, maxWidth: 300 }}>
                <Text
                  style={{
                    fontFamily: FontFamily.regular,
                    fontSize: 14,
                    lineHeight: 21,
                    color: tokens.inkSoft,
                  }}
                >
                  {body}
                </Text>
              </View>
            </View>

            {/* Meta strip */}
            <View style={{ position: 'relative', marginTop: 28 }}>
              <VisaMetaStrip items={meta} color={tokens.ink} divider={tokens.divider} />
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* CTA — evisa / required only */}
      {showCTA && (
        <VisaGuideCTA
          kicker={
            ctaKicker ??
            (category === 'evisa'
              ? 'STEP-BY-STEP APPLICATION'
              : 'DOCS · APPOINTMENTS · INTERVIEW')
          }
          label={
            ctaLabel ??
            (category === 'evisa' ? 'Create my e-visa guide' : 'Create my embassy guide')
          }
          accent={tokens.accent}
          onPress={onCreateGuide!}
        />
      )}

      {/* Soft footer row — free / arrival */}
      {!showCTA && footerRow ? (
        <View
          style={{
            marginTop: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {footerRow}
        </View>
      ) : null}
    </View>
  );
}

export default VisaHeroCard;
