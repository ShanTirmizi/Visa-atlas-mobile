import React from 'react';
import { View, Text } from 'react-native';
import {
  Phone,
  Banknote,
  Droplet,
  Shirt,
  AlertTriangle,
  Heart,
} from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Radius } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { Guilloche } from '@/components/ui/Guilloche';
import { localInfo, type LocalInfo } from '@/data/localInfo';
import { TipsTabSkeleton } from '@/components/trip/skeletons/TipsTabSkeleton';
import { toAlpha3 } from '@/utils/countryCode';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  countryCode: string;
  countryName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal building blocks
// ─────────────────────────────────────────────────────────────────────────────

/** Mono kicker text — always uppercased by font's textTransform */
function Kicker({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        Type.kicker,
        { color: color ?? colors.inkMute },
      ]}
    >
      {children}
    </Text>
  );
}

/** Italic Fraunces editorial title with an inline coral period */
function EditorialTitle({
  children,
  size = 22,
  color,
}: {
  children: string;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const titleColor = color ?? colors.ink;

  const titleStyle = {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic' as const,
    fontSize: size,
    lineHeight: size * 1.1,
    letterSpacing: -size * 0.018,
    fontWeight: '500' as const,
  };

  return (
    <Text style={[titleStyle, { color: titleColor }]}>
      {children}
      <Text style={{ color: colors.coral }}>.</Text>
    </Text>
  );
}

/** 32×32 rounded square icon orb */
function IconOrb({
  icon: Icon,
  iconColor,
  orbBg,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  orbBg: string;
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: orbBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={16} color={iconColor} />
    </View>
  );
}

/** Thin hairline divider */
function Hairline() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.line,
        marginVertical: 14,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY HERO CARD
// ─────────────────────────────────────────────────────────────────────────────

function EmergencyCard({ local }: { local: LocalInfo }) {
  const { colors } = useTheme();

  const numbers = [
    { label: 'GENERAL', value: local.emergencyNumber },
    { label: 'POLICE', value: local.policeNumber },
    { label: 'AMBULANCE', value: local.ambulanceNumber },
    { label: 'FIRE', value: local.fireNumber },
  ];

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: colors.coralSoft,
        padding: 18,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Wavy guilloche watermark */}
      <Guilloche
        variant="wavy"
        color={colors.coralDeep}
        opacity={0.04}
        density="med"
      />

      {/* Header row */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}
      >
        <IconOrb
          icon={Phone}
          iconColor={colors.coralDeep}
          orbBg={colors.coralBg}
        />
        <View>
          <Kicker color={colors.coralDeep}>EMERGENCY · DIAL</Kicker>
        </View>
      </View>

      <EditorialTitle size={22}>Save these</EditorialTitle>

      {/* 2×2 number grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 14,
        }}
      >
        {numbers.map((n) => (
          <View
            key={n.label}
            style={{
              // Each tile takes exactly half width minus half the gap
              flexBasis: '48%',
              flexGrow: 1,
              backgroundColor: colors.surface,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <Text
              style={[
                Type.kicker,
                { color: colors.inkMute, marginBottom: 4 },
              ]}
              numberOfLines={1}
            >
              {n.label}
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 24,
                lineHeight: 28,
                letterSpacing: -24 * 0.018,
                fontWeight: '500',
                color: colors.coral,
              }}
              numberOfLines={1}
            >
              {n.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MONEY CARD (TIPPING + CURRENCY)
// ─────────────────────────────────────────────────────────────────────────────

function MoneyCard({ local }: { local: LocalInfo }) {
  const { colors } = useTheme();

  const hasAny = local.tippingCulture || local.currencyTip;
  if (!hasAny) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 18,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconOrb
          icon={Banknote}
          iconColor={colors.coralDeep}
          orbBg={colors.coralBg}
        />
        <Kicker color={colors.inkMute}>TIPPING · MONEY</Kicker>
      </View>

      <EditorialTitle size={22}>What it costs</EditorialTitle>

      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6 }} />

      <View style={{ marginTop: 14, gap: 0 }}>
        {local.tippingCulture ? (
          <View>
            <Kicker color={colors.inkMute}>TIPPING</Kicker>
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, lineHeight: 21, marginTop: 4 },
              ]}
            >
              {local.tippingCulture}
            </Text>
          </View>
        ) : null}

        {local.tippingCulture && local.currencyTip ? <Hairline /> : null}

        {local.currencyTip ? (
          <View>
            <Kicker color={colors.inkMute}>MONEY</Kicker>
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, lineHeight: 21, marginTop: 4 },
              ]}
            >
              {local.currencyTip}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CARD (TAP WATER + PLUGS + SIM)
// ─────────────────────────────────────────────────────────────────────────────

const TAP_WATER_CHIP: Record<
  'safe' | 'unsafe' | 'varies',
  { label: string; textColor: string; bgColor: string }
> = {
  safe: { label: 'Safe to drink', textColor: '', bgColor: '' },
  unsafe: { label: 'Bottled only', textColor: '', bgColor: '' },
  varies: { label: 'Filter or bottle', textColor: '', bgColor: '' },
};

function TapWaterChip({ status }: { status: 'safe' | 'unsafe' | 'varies' }) {
  const { colors } = useTheme();

  const config = {
    safe: { label: 'Safe to drink', textColor: colors.visaFree, bgColor: colors.visaFreeBg },
    unsafe: { label: 'Bottled only', textColor: colors.rose, bgColor: colors.dangerBg },
    varies: { label: 'Filter or bottle', textColor: colors.warning, bgColor: colors.warningBg },
  }[status];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: config.bgColor,
        borderRadius: Radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 6,
      }}
    >
      <Text
        style={[
          Type.meta11,
          { color: config.textColor, fontWeight: '600' },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const TAP_WATER_BODY: Record<'safe' | 'unsafe' | 'varies', string> = {
  safe: 'The tap water here is safe to drink straight from the tap.',
  unsafe: 'Tap water is not safe to drink. Stick to sealed bottled water throughout your stay.',
  varies: 'Tap water safety varies by area — use a filter or buy bottled water to be safe.',
};

function DailyCard({ local }: { local: LocalInfo }) {
  const { colors } = useTheme();

  const hasPlug = !!local.plugType;
  const hasSim = !!local.simCard;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 18,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconOrb
          icon={Droplet}
          iconColor={colors.teal}
          orbBg={colors.tealBg}
        />
        <Kicker color={colors.inkMute}>WATER · POWER · NETWORK</Kicker>
      </View>

      <EditorialTitle size={22}>Day-to-day</EditorialTitle>

      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6 }} />

      <View style={{ marginTop: 14 }}>
        {/* TAP WATER */}
        <Kicker color={colors.inkMute}>TAP WATER</Kicker>
        <TapWaterChip status={local.tapWater} />
        <Text
          style={[
            Type.body14,
            { color: colors.inkSoft, lineHeight: 21, marginTop: 6 },
          ]}
        >
          {TAP_WATER_BODY[local.tapWater]}
        </Text>

        {hasPlug ? (
          <>
            <Hairline />
            <Kicker color={colors.inkMute}>PLUGS</Kicker>
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, lineHeight: 21, marginTop: 4 },
              ]}
            >
              {local.plugType}
            </Text>
          </>
        ) : null}

        {hasSim ? (
          <>
            <Hairline />
            <Kicker color={colors.inkMute}>SIM & DATA</Kicker>
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, lineHeight: 21, marginTop: 4 },
              ]}
            >
              {local.simCard}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRESS CODE CARD
// ─────────────────────────────────────────────────────────────────────────────

function DressCodeCard({ dressCode }: { dressCode: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 18,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconOrb
          icon={Shirt}
          iconColor={colors.gold}
          orbBg={colors.goldSoft}
        />
        <Kicker color={colors.inkMute}>DRESS CODE</Kicker>
      </View>

      <EditorialTitle size={22}>What to wear</EditorialTitle>

      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6 }} />

      <Text
        style={[
          Type.body14,
          { color: colors.inkSoft, lineHeight: 21, marginTop: 12 },
        ]}
      >
        {dressCode}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAM WARNINGS — dark ink verdict card
// ─────────────────────────────────────────────────────────────────────────────

function ScamWarningsCard({ warnings }: { warnings: string[] }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: 18,
        padding: 20,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header row with coral open-quote + WATCH YOUR STEP kicker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {/* Icon orb with semi-transparent white bg on dark card */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={16} color={colors.coral} />
        </View>

        {/* Open-quote glyph */}
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 22,
            color: colors.coralDeep,
            lineHeight: 22,
            marginBottom: -4,
          }}
        >
          "
        </Text>

        <Kicker color={colors.coral}>WATCH YOUR STEP</Kicker>
      </View>

      {/* Italic Fraunces title — white on dark */}
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 22,
          lineHeight: 22 * 1.1,
          letterSpacing: -22 * 0.018,
          fontWeight: '500',
          color: '#FFFFFF',
          marginBottom: 14,
        }}
      >
        Don't fall for these
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>

      {/* Coral-bulleted warnings */}
      <View style={{ gap: 10 }}>
        {warnings.map((warning, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            {/* Coral bullet dot */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.coral,
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <Text
              style={[
                Type.body13,
                {
                  color: colors.solidTextSub,
                  lineHeight: 20,
                  flex: 1,
                },
              ]}
            >
              {warning}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL CUSTOMS — soft teal card
// ─────────────────────────────────────────────────────────────────────────────

function LocalCustomsCard({ customs }: { customs: string[] }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.tealBg,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.tealSoft,
        padding: 18,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconOrb
          icon={Heart}
          iconColor={colors.teal}
          orbBg={colors.tealSoft}
        />
        <Kicker color={colors.teal}>LOCAL CUSTOMS</Kicker>
      </View>

      <EditorialTitle size={22}>When in Rome</EditorialTitle>

      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6, marginBottom: 14 }} />

      {/* Teal-bulleted customs */}
      <View style={{ gap: 10 }}>
        {customs.map((custom, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            {/* Teal bullet dot */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.teal,
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <Text
              style={[
                Type.body13,
                {
                  color: colors.inkSoft,
                  lineHeight: 20,
                  flex: 1,
                },
              ]}
            >
              {custom}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ countryName }: { countryName: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 20,
        marginTop: 4,
      }}
    >
      <Kicker color={colors.coral}>LOCAL LIFE</Kicker>

      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 22,
          lineHeight: 22 * 1.1,
          letterSpacing: -22 * 0.018,
          fontWeight: '500',
          color: colors.ink,
          marginTop: 6,
        }}
      >
        Nothing yet<Text style={{ color: colors.coral }}>.</Text>
      </Text>

      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6 }} />

      <Text
        style={[
          Type.body14,
          { color: colors.inkSoft, lineHeight: 21, marginTop: 12 },
        ]}
      >
        Tips for {countryName} will be generated when you plan your first trip. For now, check the embassy site.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP HEADER (no card — just typography)
// ─────────────────────────────────────────────────────────────────────────────

function TopHeader({ countryName }: { countryName: string }) {
  const { colors } = useTheme();

  return (
    <View style={{ paddingBottom: 6 }}>
      <Kicker color={colors.coral}>LOCAL LIFE</Kicker>

      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 26,
          lineHeight: 26 * 1.0,
          letterSpacing: -26 * 0.02,
          fontWeight: '500',
          color: colors.ink,
          marginTop: 6,
        }}
      >
        On the ground<Text style={{ color: colors.coral }}>.</Text>
      </Text>

      <Squiggle width={48} color={colors.coral} style={{ marginTop: 8 }} />

      <Text
        style={[
          Type.body13,
          { color: colors.inkSoft, lineHeight: 20, marginTop: 10 },
        ]}
      >
        In {countryName}, here's what to know before you land.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/** Travel-tips deep-dive — emergency numbers grid, info cards (tipping,
 *  money, tap water, sim, plugs, dress code), and verdict cards (scam
 *  warnings, local customs). Used by the country detail page Tips tab
 *  and the trip detail Tips tab.
 *
 *  Three data sources, queried in priority order:
 *    1. Static `data/localInfo.ts` — 88 hand-written countries, free,
 *       instant. Hits the vast majority of real traffic.
 *    2. Convex `countryTipsCache` — LLM-generated rows for any country
 *       not in the static table. Filled in lazily by trip generation
 *       and reused forever.
 *    3. Empty state — only if the country isn't in either source AND
 *       no in-flight generation is filling it in.
 *
 *  The component accepts either alpha-2 (from a trip's countryCode)
 *  or alpha-3 (from the country detail route). Internally normalised
 *  to alpha-3, the canonical key for both sources. */
export function CountryTipsView({ countryCode, countryName }: Props) {
  // Both sources are keyed by alpha-3. Trips pass alpha-2 ("MU"), the
  // country detail page passes alpha-3 ("MUS") — normalise here so
  // the lookup hits regardless of caller.
  const alpha3 =
    countryCode.length === 3
      ? countryCode.toUpperCase()
      : toAlpha3(countryCode);

  const staticLocal: LocalInfo | null = alpha3 ? localInfo[alpha3] ?? null : null;

  // Only query the cache when the static lookup missed — saves a
  // subscription + re-render for the 88 covered countries.
  const cached = useQuery(
    api.countryTips.getCountryTips,
    staticLocal === null && alpha3 ? { countryCode: alpha3 } : 'skip',
  );

  const local: LocalInfo | null = staticLocal ?? (cached as LocalInfo | null) ?? null;

  // While the cache query is in-flight (cached === undefined) and we
  // have no static fallback, render the skeleton — the trip generation
  // is likely populating the cache right now and Convex's reactive
  // query will auto-render the data the moment it lands.
  if (local === null && cached === undefined) {
    return <TipsTabSkeleton />;
  }

  if (!local) {
    return <EmptyState countryName={countryName} />;
  }

  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <TopHeader countryName={countryName} />

      <EmergencyCard local={local} />

      <MoneyCard local={local} />

      <DailyCard local={local} />

      {local.dressCode ? <DressCodeCard dressCode={local.dressCode} /> : null}

      {local.scamWarnings && local.scamWarnings.length > 0 ? (
        <ScamWarningsCard warnings={local.scamWarnings} />
      ) : null}

      {local.localCustoms && local.localCustoms.length > 0 ? (
        <LocalCustomsCard customs={local.localCustoms} />
      ) : null}
    </View>
  );
}

export default CountryTipsView;
