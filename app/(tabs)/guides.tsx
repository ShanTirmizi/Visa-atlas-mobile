import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useConvexAuth } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOffline } from '@/contexts/offline-context';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Search, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Shadows } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { GuideHero, type GuideHeroData } from '@/components/guides/GuideHero';
import { GuideRow, type GuideRowData } from '@/components/guides/GuideRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

// ---------------------------------------------------------------------------
// Static demo data (used when no Convex guides exist yet)
// ---------------------------------------------------------------------------

const DEMO_GUIDES: GuideRowData[] = [
  { title: 'The quiet side of Kyoto, at 6 AM',  author: 'Mei Tanaka',  readMin: 12, category: 'Essay',       tone: 'mountain' },
  { title: 'Japan in 7 days',                     author: 'Visa Atlas',  readMin: 8,  category: 'Itinerary',   tone: 'sunset'   },
  { title: 'How to get a Japan e-visa',           author: 'Visa Atlas',  readMin: 6,  category: 'How-to',      tone: 'ocean'    },
  { title: 'Tokyo for food lovers',               author: 'Visa Atlas',  readMin: 10, category: 'Destinations',tone: 'warm'     },
];

const DEMO_HERO: GuideHeroData = {
  title: 'The quiet side of Kyoto, at 6 AM',
  author: 'Mei Tanaka',
  readMin: 12,
  tone: 'mountain',
  category: 'Essay',
};

const FILTER_TABS = ['Featured', 'Visas', 'Destinations', 'How-to'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChecklistProgress(json: string): { checked: number; total: number } {
  try {
    const items: ChecklistItem[] = JSON.parse(json);
    return { checked: items.filter((i) => i.checked).length, total: items.length };
  } catch {
    return { checked: 0, total: 0 };
  }
}

/* prettier-ignore */
const A3_TO_A2: Record<string,string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',SWZ:'SZ',ETH:'ET',FJI:'FJ',FIN:'FI',
  FRA:'FR',GAB:'GA',GMB:'GM',GEO:'GE',DEU:'DE',GHA:'GH',GRC:'GR',GRD:'GD',GTM:'GT',GIN:'GN',
  GNB:'GW',GUY:'GY',HTI:'HT',HND:'HN',HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRN:'IR',IRQ:'IQ',
  IRL:'IE',ISR:'IL',ITA:'IT',JAM:'JM',JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KIR:'KI',PRK:'KP',
  KOR:'KR',KWT:'KW',KGZ:'KG',LAO:'LA',LVA:'LV',LBN:'LB',LSO:'LS',LBR:'LR',LBY:'LY',LIE:'LI',
  LTU:'LT',LUX:'LU',MDG:'MG',MWI:'MW',MYS:'MY',MDV:'MV',MLI:'ML',MLT:'MT',MHL:'MH',MRT:'MR',
  MUS:'MU',MEX:'MX',FSM:'FM',MDA:'MD',MCO:'MC',MNG:'MN',MNE:'ME',MAR:'MA',MOZ:'MZ',MMR:'MM',
  NAM:'NA',NRU:'NR',NPL:'NP',NLD:'NL',NZL:'NZ',NIC:'NI',NER:'NE',NGA:'NG',MKD:'MK',NOR:'NO',
  OMN:'OM',PAK:'PK',PLW:'PW',PAN:'PA',PNG:'PG',PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',
  QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',KNA:'KN',LCA:'LC',VCT:'VC',WSM:'WS',SMR:'SM',STP:'ST',
  SAU:'SA',SEN:'SN',SRB:'RS',SYC:'SC',SLE:'SL',SGP:'SG',SVK:'SK',SVN:'SI',SLB:'SB',SOM:'SO',
  ZAF:'ZA',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',TJK:'TJ',
  TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',TUV:'TV',
  UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',VNM:'VN',
  YEM:'YE',ZMB:'ZM',ZWE:'ZW',PSE:'PS',XKX:'XK',
};
function countryCodeToFlag(code: string): string {
  const a2 = A3_TO_A2[code.toUpperCase()] || code.slice(0, 2).toUpperCase();
  return a2
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ---------------------------------------------------------------------------
// Status config (for user visa guides)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  preparing: { label: 'Preparing', color: '#B8861E' },
  submitted: { label: 'Submitted', color: '#D45E30' },
  approved:  { label: 'Approved',  color: '#228B57' },
  rejected:  { label: 'Rejected',  color: '#C43A2E' },
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function GuidesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('Featured');

  const { isAuthenticated } = useConvexAuth();
  const guides = useOfflineQuery(api.visaGuides.listGuides, isAuthenticated ? {} : 'skip');
  const { isOffline } = useOffline();
  const deleteGuide = useMutation(api.visaGuides.deleteGuide);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: Id<'visaGuides'>, name: string) => {
      if (isOffline) return;
      Alert.alert(
        'Delete visa guide',
        `Are you sure you want to delete the ${name} visa guide? Your checklist progress will be lost.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(id);
              await deleteGuide({ id });
              setDeletingId(null);
            },
          },
        ],
      );
    },
    [deleteGuide, isOffline],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[Type.body13, { color: colors.inkMute }]}>Editorial</Text>
            <Text style={[Type.display24, { color: colors.ink, marginTop: 2 }]}>Guides</Text>
          </View>
          <CircleBtn
            size={38}
            onPress={() => {}}
            accessibilityLabel="Search guides"
          >
            <Search size={18} color={colors.ink} strokeWidth={2} />
          </CircleBtn>
        </View>

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <View style={styles.filterRow}>
          <SegmentedControl
            options={[...FILTER_TABS]}
            value={activeTab}
            onChange={setActiveTab}
            variant="pill"
          />
        </View>

        {/* ── GuideHero (featured) ─────────────────────────────────────────── */}
        {(activeTab === 'Featured') && (
          <View style={styles.heroSection}>
            <GuideHero
              guide={DEMO_HERO}
              onPress={() => {}}
            />
          </View>
        )}

        {/* ── Editorial guide rows (static demo) ───────────────────────────── */}
        {(activeTab === 'Featured') && (
          <View style={styles.rowsSection}>
            {DEMO_GUIDES.slice(1).map((guide, i) => (
              <GuideRow key={i} guide={guide} onPress={() => {}} />
            ))}
          </View>
        )}

        {/* ── Filtered editorial rows ───────────────────────────────────────── */}
        {activeTab !== 'Featured' && (
          <View style={styles.rowsSection}>
            {DEMO_GUIDES.filter((g) => {
              if (activeTab === 'Visas') return g.category === 'How-to';
              if (activeTab === 'Destinations') return g.category === 'Destinations' || g.category === 'Essay' || g.category === 'Itinerary';
              if (activeTab === 'How-to') return g.category === 'How-to';
              return true;
            }).map((guide, i) => (
              <GuideRow key={i} guide={guide} onPress={() => {}} />
            ))}
          </View>
        )}

        {/* ── Your Visa Guides (Convex-backed) ────────────────────────────── */}
        {guides !== undefined && guides.length > 0 && (
          <View style={styles.visaGuidesSection}>
            <Text style={[Type.title15, { color: colors.ink, marginBottom: 12 }]}>
              Your Visa Applications
            </Text>
            <View style={{ gap: 10 }}>
              {guides.map((guide) => {
                const status = STATUS_CONFIG[guide.status] ?? STATUS_CONFIG.preparing;
                const progress = getChecklistProgress(guide.checklist);
                const pct = progress.total > 0
                  ? Math.round((progress.checked / progress.total) * 100)
                  : 0;
                const isDeleting = deletingId === guide._id;
                const flag = countryCodeToFlag(guide.countryCode);

                return (
                  <TouchableOpacity
                    key={guide._id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/guide/${guide._id}`)}
                    style={[
                      styles.visaGuideCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.line,
                        opacity: isDeleting ? 0.5 : 1,
                      },
                    ]}
                  >
                    <View style={styles.visaGuideBody}>
                      {/* Top row: flag + country + status pill */}
                      <View style={styles.visaGuideTop}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ fontSize: 22 }}>{flag}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[Type.title17, { color: colors.ink }]} numberOfLines={1}>
                              {guide.countryName}
                            </Text>
                            <Text
                              style={[Type.meta10_5, { color: colors.inkMute, marginTop: 2 }]}
                              numberOfLines={1}
                            >
                              {guide.visaType}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: colors.surfaceMuted },
                          ]}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: status.color,
                            }}
                          />
                          <Text style={[Type.meta11, { color: colors.ink, fontWeight: '600' }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      {/* Progress */}
                      {progress.total > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              marginBottom: 6,
                            }}
                          >
                            <Text style={[Type.meta11, { color: colors.inkMute }]}>
                              {progress.checked}/{progress.total} documents
                            </Text>
                            <Text style={[Type.meta11, { color: colors.ink, fontWeight: '600' }]}>
                              {pct}%
                            </Text>
                          </View>
                          <View style={[styles.visaProgressTrack, { backgroundColor: colors.surfaceMuted }]}>
                            <View
                              style={[
                                styles.visaProgressFill,
                                { width: `${pct}%`, backgroundColor: colors.ink },
                              ]}
                            />
                          </View>
                        </View>
                      )}

                      {/* Delete icon — inline, subtle */}
                      <View style={styles.visaGuideFooter}>
                        <TouchableOpacity
                          onPress={() =>
                            handleDelete(guide._id as Id<'visaGuides'>, guide.countryName)
                          }
                          disabled={isDeleting}
                          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                          style={[styles.deleteBtn, { borderColor: colors.line }]}
                          accessibilityLabel="Delete guide"
                        >
                          {isDeleting ? (
                            <ActivityIndicator size={14} color={colors.inkMute} />
                          ) : (
                            <Trash2
                              color={colors.inkMute}
                              size={15}
                              strokeWidth={1.75}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Loading */}
        {guides === undefined && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.inkMute} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {},

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'column',
  },

  // Filter chips
  filterRow: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },

  // Hero
  heroSection: {
    paddingTop: 8,
    paddingHorizontal: 18,
  },

  // Rows
  rowsSection: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },

  // Visa guides section
  visaGuidesSection: {
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  visaGuideCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  visaGuideBody: {
    padding: 14,
  },
  visaGuideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  visaProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  visaProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  visaGuideFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
});
