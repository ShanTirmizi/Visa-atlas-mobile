import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius } from '@/constants/theme';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { localInfo, type LocalInfo } from '@/data/localInfo';

interface Props {
  countryCode: string;
  countryName: string;
}

/** Travel-tips deep-dive — emergency numbers grid, info rows (tipping,
 *  money, tap water, sim, plugs, dress code), and bullet rows (scam
 *  warnings, local customs). Pulls from the curated localInfo data layer.
 *  Used by the country detail page Tips tab and the trip detail Tips tab. */
export function CountryTipsView({ countryCode, countryName }: Props) {
  const { colors } = useTheme();
  const local: LocalInfo | null = localInfo[countryCode] ?? null;

  if (!local) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          marginTop: 4,
        }}
      >
        <SectionKicker>TRAVEL TIPS</SectionKicker>
        <Text style={[Type.title17, { color: colors.ink, marginTop: 6 }]}>
          No saved tips for {countryName} yet
        </Text>
        <Text
          style={[
            Type.body14,
            { color: colors.inkMute, marginTop: 8, lineHeight: 21 },
          ]}
        >
          Tips for this country will be generated on-demand and saved here when
          you plan your first trip. For now, check the embassy website and your
          airline's entry requirements before travel.
        </Text>
      </View>
    );
  }

  const rows: Array<{ kicker: string; body: string | null }> = [
    { kicker: 'TIPPING', body: local.tippingCulture ?? null },
    { kicker: 'MONEY', body: local.currencyTip ?? null },
    {
      kicker: 'TAP WATER',
      body:
        local.tapWater === 'safe'
          ? 'Tap water is safe to drink.'
          : local.tapWater === 'unsafe'
          ? 'Tap water is NOT safe. Drink bottled or filtered water.'
          : 'Tap water safety varies — stick to bottled or filtered water to be safe.',
    },
    { kicker: 'SIM & DATA', body: local.simCard ?? null },
    { kicker: 'PLUGS', body: local.plugType ?? null },
    { kicker: 'DRESS CODE', body: local.dressCode ?? null },
  ];

  const bulletRows: Array<{ kicker: string; items: string[] }> = [];
  if (local.scamWarnings?.length) {
    bulletRows.push({ kicker: 'SCAM WARNINGS', items: local.scamWarnings });
  }
  if (local.localCustoms?.length) {
    bulletRows.push({ kicker: 'LOCAL CUSTOMS', items: local.localCustoms });
  }

  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      {/* Emergency strip */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <SectionKicker color={colors.danger}>EMERGENCY</SectionKicker>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 10,
            gap: 8,
          }}
        >
          {[
            { label: 'General', value: local.emergencyNumber },
            { label: 'Police', value: local.policeNumber },
            { label: 'Ambulance', value: local.ambulanceNumber },
            { label: 'Fire', value: local.fireNumber },
          ].map((e) => (
            <View
              key={e.label}
              style={{
                flexBasis: '48%',
                flexGrow: 1,
                backgroundColor: colors.surfaceMuted,
                borderRadius: Radius.md,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Text
                style={[Type.meta10_5, { color: colors.inkMute, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {e.label}
              </Text>
              <Text style={[Type.title17, { color: colors.ink }]} numberOfLines={1}>
                {e.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Info rows */}
      {rows
        .filter((r) => r.body)
        .map((r) => (
          <View
            key={r.kicker}
            style={{
              backgroundColor: colors.surface,
              borderRadius: Radius.xl,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <SectionKicker>{r.kicker}</SectionKicker>
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, marginTop: 6, lineHeight: 21 },
              ]}
            >
              {r.body}
            </Text>
          </View>
        ))}

      {/* Bullet rows */}
      {bulletRows.map((r) => (
        <View
          key={r.kicker}
          style={{
            backgroundColor: colors.surface,
            borderRadius: Radius.xl,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <SectionKicker>{r.kicker}</SectionKicker>
          <View style={{ marginTop: 8, gap: 4 }}>
            {r.items.map((item, i) => (
              <Text
                key={i}
                style={[Type.body13, { color: colors.inkSoft, lineHeight: 20 }]}
              >
                • {item}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default CountryTipsView;
