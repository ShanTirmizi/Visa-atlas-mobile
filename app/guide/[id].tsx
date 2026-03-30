import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  MapPin,
  FileText,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Banknote,
  BookOpen,
  Building2,
  Info,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
} from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CostLineItem {
  item: string;
  amount: string;
}

interface GuideData {
  visaType: string;
  overview: string;
  processingTime: string;
  cost: { items: CostLineItem[]; total: string };
  timeline: string[];
  whereToApply: {
    name: string;
    address: string;
    nearestTube?: string;
    bookingUrl?: string;
    walkIn?: boolean;
  };
  documents: string[];
  bankRequirements: {
    minimumBalance: string;
    monthsRequired: number;
    tips: string[];
  };
  rejectionReasons: string[];
  tips: string[];
  applicationUrl: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
  tip?: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type StatusKey = 'preparing' | 'submitted' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; bg: string }> = {
  preparing: { label: 'Preparing', color: '#E5A832', bg: 'rgba(229, 168, 50, 0.15)' },
  submitted: { label: 'Submitted', color: '#EB6D3A', bg: 'rgba(235, 109, 58, 0.15)' },
  approved:  { label: 'Approved',  color: '#2EAA6E', bg: 'rgba(46, 170, 110, 0.15)' },
  rejected:  { label: 'Rejected',  color: '#E05545', bg: 'rgba(224, 85, 69, 0.15)' },
};

const STATUS_OPTIONS: StatusKey[] = ['preparing', 'submitted', 'approved', 'rejected'];

const CATEGORY_ORDER = ['essential', 'financial', 'employment', 'travel', 'supporting'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  essential: 'Essential',
  financial: 'Financial',
  employment: 'Employment',
  travel: 'Travel',
  supporting: 'Supporting',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({ h, colors }: { h: number; colors: any }) {
  return (
    <View
      style={{
        height: h,
        borderRadius: Radius.md,
        backgroundColor: colors.shimmer,
        marginBottom: Spacing.md,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  iconColor,
  children,
  colors,
}: {
  title: string;
  icon: any;
  iconColor: string;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: iconColor, borderColor: 'transparent' },
      ]}
    >
      <View style={[styles.sectionHeader, { borderBottomColor: 'rgba(255,255,255,0.20)' }]}>
        <Icon size={16} strokeWidth={1.5} color={'#FFFFFF'} />
        <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const guide = useQuery(api.visaGuides.getGuide, id ? { id: id as Id<'visaGuides'> } : 'skip');
  const updateChecklist = useMutation(api.visaGuides.updateChecklist);
  const updateStatus = useMutation(api.visaGuides.updateStatus);

  const [statusOpen, setStatusOpen] = useState(false);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Parse guide JSON
  const guideData: GuideData | null = useMemo(
    () => safeParse<GuideData | null>(guide?.guide, null),
    [guide?.guide],
  );

  // Parse checklist
  const checklist: ChecklistItem[] = useMemo(
    () => safeParse<ChecklistItem[]>(guide?.checklist, []),
    [guide?.checklist],
  );

  // Group by category
  const groupedChecklist = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of checklist) {
      const cat = item.category?.toLowerCase() || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [checklist]);

  // Progress
  const totalItems = checklist.length;
  const checkedItems = checklist.filter((i) => i.checked).length;
  const progressPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Toggle checklist item
  const handleToggle = useCallback(
    async (itemId: string) => {
      if (!guide) return;
      const updated = checklist.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      );
      await updateChecklist({
        id: guide._id as Id<'visaGuides'>,
        checklist: JSON.stringify(updated),
      });
    },
    [guide, checklist, updateChecklist],
  );

  // Change status
  const handleStatusChange = useCallback(
    async (newStatus: StatusKey) => {
      if (!guide) return;
      await updateStatus({ id: guide._id as Id<'visaGuides'>, status: newStatus });
      setStatusOpen(false);
    },
    [guide, updateStatus],
  );

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (guide === undefined) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ArrowLeft color={colors.foreground} size={22} />
        </TouchableOpacity>
        <SkeletonBlock h={60} colors={colors} />
        <SkeletonBlock h={40} colors={colors} />
        <SkeletonBlock h={200} colors={colors} />
        <SkeletonBlock h={150} colors={colors} />
      </View>
    );
  }

  // Not found
  if (guide === null) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ArrowLeft color={colors.foreground} size={22} />
        </TouchableOpacity>
        <View style={styles.emptyWrap}>
          <FileText color={colors.textMuted} size={48} strokeWidth={1} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Guide not found</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            This visa guide may have been deleted or the link is invalid.
          </Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  const currentStatus = STATUS_CONFIG[guide.status as StatusKey] || STATUS_CONFIG.preparing;
  const flag = countryCodeToFlag(guide.countryCode);

  // Collect all category keys (ordered + remaining)
  const allCategories = [
    ...CATEGORY_ORDER.filter((c) => groupedChecklist[c]?.length),
    ...Object.keys(groupedChecklist).filter(
      (c) => !CATEGORY_ORDER.includes(c as any) && groupedChecklist[c]?.length,
    ),
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ────────────────────────────────── */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <ArrowLeft color={colors.foreground} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.countryName, { color: colors.foreground }]}>
              {flag} {guide.countryName}
            </Text>
            <Text style={[styles.visaType, { color: colors.textSecondary }]}>
              {guideData?.visaType || guide.visaType}
            </Text>
          </View>

          {/* Status dropdown */}
          <View style={{ position: 'relative', zIndex: 20 }}>
            <TouchableOpacity
              onPress={() => setStatusOpen(!statusOpen)}
              style={[styles.statusBadge, { backgroundColor: currentStatus.color }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusText, { color: '#FFFFFF' }]}>
                {currentStatus.label}
              </Text>
              <ChevronDown size={14} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>

            {statusOpen && (
              <View
                style={[
                  styles.statusDropdown,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {STATUS_OPTIONS.map((opt) => {
                  const cfg = STATUS_CONFIG[opt];
                  const isActive = guide.status === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => handleStatusChange(opt)}
                      style={[
                        styles.statusOption,
                        isActive && { backgroundColor: cfg.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          { color: isActive ? cfg.color : colors.textSecondary },
                        ]}
                      >
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Close status overlay */}
        {statusOpen && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setStatusOpen(false)}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* ── Progress overview ─────────────────────── */}
        {totalItems > 0 && (
          <View
            style={[
              styles.progressCard,
              { backgroundColor: colors.secondary, borderColor: 'transparent' },
            ]}
          >
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                {checkedItems} of {totalItems} documents ready
              </Text>
              <Text
                style={[
                  styles.progressPct,
                  { color: '#FFFFFF' },
                ]}
              >
                {progressPct}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: '#FFFFFF',
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Quick stats ───────────────────────────── */}
        {guideData && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={{ gap: Spacing.sm }}>
            {[
              { icon: Clock, label: 'Processing', value: guideData.processingTime || 'N/A', tint: colors.primary },
              { icon: DollarSign, label: 'Total Cost', value: guideData.cost?.total || 'N/A', tint: colors.secondary },
              { icon: MapPin, label: 'Where', value: guideData.whereToApply?.name || 'N/A', tint: colors.accent },
            ].map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: stat.tint, borderColor: 'transparent', minWidth: 150 },
                ]}
              >
                <View style={styles.statIconRow}>
                  <stat.icon size={13} strokeWidth={1.5} color={'#FFFFFF'} />
                  <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                    {stat.label}
                  </Text>
                </View>
                <Text
                  style={[styles.statValue, { color: '#FFFFFF' }]}
                  numberOfLines={3}
                >
                  {stat.value}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Document Checklist ────────────────────── */}
        {checklist.length > 0 && (
          <Section title="Document Checklist" icon={FileText} iconColor={colors.primary} colors={colors}>
            {allCategories.map((cat) => {
              const items = groupedChecklist[cat];
              if (!items || items.length === 0) return null;
              const catLabel = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
              const isExpanded = expandedSections[cat] !== false; // default open

              return (
                <View key={cat} style={styles.categoryGroup}>
                  <TouchableOpacity
                    onPress={() => toggleSection(cat)}
                    style={styles.categoryHeader}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                      {catLabel}
                    </Text>
                    <Text style={[styles.categoryCount, { color: 'rgba(255,255,255,0.60)' }]}>
                      {items.filter((i) => i.checked).length}/{items.length}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={14} color="rgba(255,255,255,0.60)" />
                    ) : (
                      <ChevronDown size={14} color="rgba(255,255,255,0.60)" />
                    )}
                  </TouchableOpacity>

                  {isExpanded &&
                    items.map((item) => (
                      <View key={item.id}>
                        <TouchableOpacity
                          onPress={() => handleToggle(item.id)}
                          style={[
                            styles.checkItem,
                            item.checked && { backgroundColor: 'rgba(255,255,255,0.15)' },
                          ]}
                          activeOpacity={0.7}
                        >
                          {item.checked ? (
                            <CheckCircle2 size={20} strokeWidth={2} color="rgba(255,255,255,0.90)" />
                          ) : (
                            <Circle size={20} strokeWidth={1.5} color="rgba(255,255,255,0.50)" />
                          )}
                          <Text
                            style={[
                              styles.checkLabel,
                              {
                                color: item.checked ? 'rgba(255,255,255,0.50)' : '#FFFFFF',
                                textDecorationLine: item.checked ? 'line-through' : 'none',
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.tip && (
                            <TouchableOpacity
                              onPress={() =>
                                setExpandedTip(expandedTip === item.id ? null : item.id)
                              }
                              hitSlop={8}
                            >
                              <Info
                                size={16}
                                strokeWidth={1.5}
                                color="rgba(255,255,255,0.70)"
                              />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {item.tip && expandedTip === item.id && (
                          <View
                            style={[
                              styles.tipBubble,
                              {
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderColor: 'rgba(255,255,255,0.20)',
                              },
                            ]}
                          >
                            <Text style={[styles.tipText, { color: 'rgba(255,255,255,0.80)' }]}>
                              {item.tip}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                </View>
              );
            })}
          </Section>
        )}

        {/* ── Cost Breakdown ────────────────────────── */}
        {guideData?.cost?.items && guideData.cost.items.length > 0 && (
          <Section title="Cost Breakdown" icon={DollarSign} iconColor={colors.secondary} colors={colors}>
            {guideData.cost.items.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.costRow,
                  idx < guideData.cost.items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(255,255,255,0.20)',
                  },
                ]}
              >
                <Text style={[styles.costItem, { color: 'rgba(255,255,255,0.70)' }]}>
                  {item.item}
                </Text>
                <Text style={[styles.costAmount, { color: '#FFFFFF' }]}>
                  {item.amount}
                </Text>
              </View>
            ))}
            <View style={[styles.costTotal, { borderTopColor: 'rgba(255,255,255,0.30)' }]}>
              <Text style={[styles.costTotalLabel, { color: '#FFFFFF' }]}>Total</Text>
              <Text style={[styles.costTotalValue, { color: '#FFFFFF' }]}>
                {guideData.cost.total}
              </Text>
            </View>
          </Section>
        )}

        {/* ── Application Timeline ──────────────────── */}
        {guideData?.timeline && guideData.timeline.length > 0 && (
          <Section title="Application Timeline" icon={Clock} iconColor={colors.primary} colors={colors}>
            {guideData.timeline.map((step, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: 'rgba(255,255,255,0.20)',
                      borderColor: 'rgba(255,255,255,0.40)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineDotText,
                      {
                        color: '#FFFFFF',
                      },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
                {idx < guideData.timeline.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: 'rgba(255,255,255,0.20)' }]} />
                )}
                <Text style={[styles.timelineLabel, { color: 'rgba(255,255,255,0.80)' }]}>
                  {step}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* ── Bank Requirements ─────────────────────── */}
        {guideData?.bankRequirements && (
          <Section title="Bank Requirements" icon={Banknote} iconColor={colors.secondary} colors={colors}>
            <View style={styles.bankGrid}>
              <View
                style={[
                  styles.bankCard,
                  { backgroundColor: colors.secondary, borderColor: 'transparent' },
                ]}
              >
                <Text style={[styles.bankLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                  Minimum Balance
                </Text>
                <Text style={[styles.bankValue, { color: '#FFFFFF' }]}>
                  {guideData.bankRequirements.minimumBalance}
                </Text>
              </View>
              <View
                style={[
                  styles.bankCard,
                  { backgroundColor: colors.secondary, borderColor: 'transparent' },
                ]}
              >
                <Text style={[styles.bankLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                  Months Required
                </Text>
                <Text style={[styles.bankValue, { color: '#FFFFFF' }]}>
                  {guideData.bankRequirements.monthsRequired} months
                </Text>
              </View>
            </View>

            {guideData.bankRequirements.tips?.map((tip, idx) => (
              <View
                key={idx}
                style={[
                  styles.bankTip,
                  { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.20)' },
                ]}
              >
                <Lightbulb size={14} strokeWidth={1.5} color="rgba(255,255,255,0.80)" />
                <Text style={[styles.bankTipText, { color: 'rgba(255,255,255,0.80)' }]}>{tip}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* ── Common Pitfalls ───────────────────────── */}
        {guideData?.rejectionReasons && guideData.rejectionReasons.length > 0 && (
          <Section title="Common Pitfalls" icon={AlertTriangle} iconColor={colors.danger} colors={colors}>
            {guideData.rejectionReasons.map((reason, idx) => (
              <View
                key={idx}
                style={[
                  styles.pitfallCard,
                  { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.20)' },
                ]}
              >
                <AlertTriangle size={15} strokeWidth={1.5} color="rgba(255,255,255,0.80)" />
                <Text style={[styles.pitfallText, { color: 'rgba(255,255,255,0.80)' }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* ── Pro Tips ──────────────────────────────── */}
        {guideData?.tips && guideData.tips.length > 0 && (
          <Section title="Pro Tips" icon={Lightbulb} iconColor={colors.primary} colors={colors}>
            {guideData.tips.map((tip, idx) => (
              <View
                key={idx}
                style={[
                  styles.proTipCard,
                  { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.20)' },
                ]}
              >
                <Text style={[styles.proTipNum, { color: 'rgba(255,255,255,0.80)' }]}>{idx + 1}</Text>
                <Text style={[styles.proTipText, { color: 'rgba(255,255,255,0.80)' }]}>{tip}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Bottom spacer */}
        <View style={{ height: insets.bottom + 32 }} />
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
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.subtle,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  countryName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    lineHeight: 40,
  },
  visaType: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.sm,
    marginTop: 2,
  },

  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 140,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.cardRaised,
  },
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusOptionText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
  },

  // Progress card
  progressCard: {
    borderRadius: 20,
    borderWidth: 0,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.sm,
  },
  progressPct: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Quick stats
  statsRow: {
    marginBottom: Spacing.lg,
  },
  statCard: {
    borderRadius: 14,
    borderWidth: 0,
    padding: Spacing.sm,
    ...Shadows.subtle,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },

  // Section
  section: {
    borderRadius: 20,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
  },
  sectionBody: {
    padding: Spacing.md,
  },

  // Checklist
  categoryGroup: {
    marginBottom: Spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  categoryLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  categoryCount: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
    marginRight: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.xs,
    marginBottom: 2,
  },
  checkLabel: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
  },
  tipBubble: {
    marginLeft: 40,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },

  // Costs
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  costItem: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
  },
  costAmount: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  costTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 2,
  },
  costTotalLabel: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.base,
  },
  costTotalValue: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.lg,
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
  },
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 30,
    width: 2,
    height: 20,
  },
  timelineLabel: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
    paddingTop: 4,
  },

  // Bank
  bankGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bankCard: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 0,
    padding: Spacing.sm,
  },
  bankLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bankValue: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.base,
  },
  bankTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.xs,
    borderWidth: 1,
    marginTop: 6,
  },
  bankTipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    flex: 1,
    lineHeight: 18,
  },

  // Pitfalls
  pitfallCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: 8,
  },
  pitfallText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
  },

  // Pro tips
  proTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: 8,
  },
  proTipNum: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.sm,
    minWidth: 20,
    textAlign: 'center',
  },
  proTipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});
