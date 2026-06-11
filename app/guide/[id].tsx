import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Animated from 'react-native-reanimated';
import { tabSlideIn } from '@/utils/tabAnimation';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConvexAuth } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
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
  Info,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
} from '@/constants/theme';
import BackButton from '@/components/ui/BackButton';
import { Squiggle } from '@/components/ui/Squiggle';
import { Guilloche } from '@/components/ui/Guilloche';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';

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

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; tokenFg: 'warning' | 'coralDeep' | 'visaFree' | 'rose'; tokenBg: 'warningBg' | 'coralBg' | 'visaFreeBg' | 'dangerBg' }
> = {
  preparing: { label: 'Preparing', tokenFg: 'warning',   tokenBg: 'warningBg' },
  submitted: { label: 'Submitted', tokenFg: 'coralDeep', tokenBg: 'coralBg'   },
  approved:  { label: 'Approved',  tokenFg: 'visaFree',  tokenBg: 'visaFreeBg' },
  rejected:  { label: 'Rejected',  tokenFg: 'rose',      tokenBg: 'dangerBg'  },
};

const STATUS_OPTIONS: StatusKey[] = ['preparing', 'submitted', 'approved', 'rejected'];

const CATEGORY_ORDER = ['essential', 'financial', 'employment', 'travel', 'supporting'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  essential: 'Essentials',
  financial: 'Financial',
  employment: 'Employment',
  travel: 'Travel',
  supporting: 'Supporting',
};

// Editorial kicker for each status — what shows above the country headline.
const STATUS_KICKER: Record<StatusKey, string> = {
  preparing: 'IN PREPARATION',
  submitted: 'SUBMITTED · AWAITING DECISION',
  approved:  'APPROVED · STAMPED & SEALED',
  rejected:  'REJECTED · NEEDS REWORK',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// AI-generated guide fields sometimes come back as the literal string "N/A"
// (or "—" / "none") when the model has no value. Treat those as missing so
// we never render a button or kicker that points nowhere.
function hasValue(s: string | undefined | null): s is string {
  if (!s) return false;
  const t = s.trim().toLowerCase();
  return t.length > 0 && t !== 'n/a' && t !== 'na' && t !== 'none' && t !== '-' && t !== '—';
}

function isHttpUrl(s: string | undefined | null): boolean {
  if (!hasValue(s)) return false;
  return /^https?:\/\//i.test(s.trim());
}

// ---------------------------------------------------------------------------
// Editorial building blocks
// ---------------------------------------------------------------------------

function Kicker({
  children,
  color,
  size = 11,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FontFamily.monoMedium,
        fontSize: size,
        fontWeight: '700',
        letterSpacing: size * 0.22,
        textTransform: 'uppercase',
        color: color ?? colors.inkMute,
      }}
    >
      {children}
    </Text>
  );
}

function EditorialTitle({
  children,
  size = 24,
  color,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FontFamily.displayItalic,
        fontStyle: 'italic',
        fontSize: size,
        lineHeight: size * 1.1,
        letterSpacing: -size * 0.018,
        fontWeight: '500',
        color: color ?? colors.ink,
      }}
    >
      {children}
      <Text style={{ color: colors.coral }}>.</Text>
    </Text>
  );
}

function IconOrb({
  icon: Icon,
  iconColor,
  orbBg,
  size = 32,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  orbBg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: orbBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.5} color={iconColor} strokeWidth={1.8} />
    </View>
  );
}

/** Editorial section card — kicker + icon orb + italic title + squiggle. The
 *  go-to wrapper for visa-guide content blocks. */
function GuideSection({
  kicker,
  title,
  icon: Icon,
  iconColor,
  orbBg,
  children,
}: {
  kicker: string;
  title: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  orbBg: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconOrb icon={Icon} iconColor={iconColor} orbBg={orbBg} />
        <Kicker color={colors.inkMute}>{kicker}</Kicker>
      </View>
      <EditorialTitle size={22}>{title}</EditorialTitle>
      <Squiggle width={40} color={colors.coral} style={{ marginTop: 6, marginBottom: 14 }} />
      {children}
    </View>
  );
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
// Main component
// ---------------------------------------------------------------------------

export default function GuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { isAuthenticated } = useConvexAuth();
  const guide = useOfflineQuery(
    api.visaGuides.getGuide,
    isAuthenticated && id ? { id: id as Id<'visaGuides'> } : 'skip',
  );
  const updateChecklist = useOfflineMutation(api.visaGuides.updateChecklist);
  const updateStatus = useOfflineMutation(api.visaGuides.updateStatus);
  const router = useRouter();

  const [statusOpen, setStatusOpen] = useState(false);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  type GuideTab = 'Checklist' | 'Details' | 'Tips';
  const GUIDE_TABS: ReadonlyArray<GuideTab> = ['Checklist', 'Details', 'Tips'];
  const [activeTab, setActiveTab] = useState<GuideTab>('Checklist');
  const prevTabRef = useRef<GuideTab>('Checklist');
  const tabDirection =
    GUIDE_TABS.indexOf(activeTab) >= GUIDE_TABS.indexOf(prevTabRef.current) ? 1 : -1;
  useEffect(() => {
    prevTabRef.current = activeTab;
  }, [activeTab]);

  const guideData: GuideData | null = useMemo(
    () => safeParse<GuideData | null>(guide?.guide, null),
    [guide?.guide],
  );

  const checklist: ChecklistItem[] = useMemo(
    () => safeParse<ChecklistItem[]>(guide?.checklist, []),
    [guide?.checklist],
  );

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of checklist) {
      const cat = item.category?.toLowerCase() || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [checklist]);

  const totalItems = checklist.length;
  const checkedItems = checklist.filter((i) => i.checked).length;
  const progressPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

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
        <BackButton />
        <View style={{ height: Spacing.lg }} />
        <SkeletonBlock h={60} colors={colors} />
        <SkeletonBlock h={40} colors={colors} />
        <SkeletonBlock h={200} colors={colors} />
        <SkeletonBlock h={150} colors={colors} />
      </View>
    );
  }

  if (guide === null) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
        ]}
      >
        <BackButton />
        <View style={styles.emptyWrap}>
          <FileText color={colors.inkMute} size={48} strokeWidth={1} />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Guide not found</Text>
          <Text style={[styles.emptyBody, { color: colors.inkSoft }]}>
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
  const currentStatusKey = (guide.status as StatusKey) || 'preparing';
  const alpha2 = toAlpha2(guide.countryCode);

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
      <View style={styles.headerRow}>
        <BackButton />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Editorial header ─────────────────────── */}
        <View style={{ marginBottom: 18 }}>
          {/* Status kicker + squiggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Kicker color={colors[currentStatus.tokenFg]}>
              {STATUS_KICKER[currentStatusKey]}
            </Kicker>
            <Squiggle width={36} color={colors.coral} />
          </View>

          {/* Title row: flag + name + status pill */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.line,
                marginTop: 2,
              }}
            >
              <Flag code={alpha2} size={56} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 30,
                  lineHeight: 32,
                  letterSpacing: -30 * 0.022,
                  fontWeight: '500',
                  color: colors.ink,
                }}
                numberOfLines={2}
              >
                {guide.countryName}
                <Text style={{ color: colors.coral }}>.</Text>
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 10 * 0.22,
                  textTransform: 'uppercase',
                  color: colors.inkMute,
                  marginTop: 6,
                }}
                numberOfLines={2}
              >
                {(guideData?.visaType || guide.visaType)}
              </Text>
            </View>

            {/* Status pill — soft pill with dot */}
            <View style={{ position: 'relative', zIndex: 20, marginTop: 2 }}>
              <TouchableOpacity
                onPress={() => setStatusOpen(!statusOpen)}
                style={[
                  styles.statusBadge,
                  { backgroundColor: colors[currentStatus.tokenBg] },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors[currentStatus.tokenFg],
                  }}
                />
                <Text style={[styles.statusText, { color: colors[currentStatus.tokenFg] }]}>
                  {currentStatus.label}
                </Text>
                <ChevronDown size={12} color={colors[currentStatus.tokenFg]} strokeWidth={2.2} />
              </TouchableOpacity>

              {statusOpen && (
                <View style={styles.statusDropdownShadow}>
                  <View
                    style={[
                      styles.statusDropdownInner,
                      { backgroundColor: colors.surface, borderColor: colors.line },
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
                            isActive && { backgroundColor: colors[cfg.tokenBg] },
                          ]}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: colors[cfg.tokenFg],
                            }}
                          />
                          <Text
                            style={{
                              fontFamily: FontFamily.monoMedium,
                              fontSize: 11,
                              fontWeight: '700',
                              letterSpacing: 11 * 0.18,
                              textTransform: 'uppercase',
                              color: isActive ? colors[cfg.tokenFg] : colors.inkSoft,
                            }}
                          >
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
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

        {/* ── Progress hero — wavy guilloche bg + italic % ──────── */}
        {totalItems > 0 && (
          <View
            style={{
              backgroundColor: colors.coralBg,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.line,
              padding: 20,
              marginBottom: 14,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Guilloche variant="wavy" color={colors.coral} opacity={0.06} density="med" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Kicker color={colors.coralDeep}>READY TO LODGE</Kicker>
              <Squiggle width={28} color={colors.coralDeep} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 56,
                  lineHeight: 56,
                  letterSpacing: -56 * 0.022,
                  fontWeight: '500',
                  color: colors.coralDeep,
                }}
              >
                {progressPct}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 28,
                  fontWeight: '500',
                  color: colors.coralDeep,
                }}
              >
                %
              </Text>
              <View style={{ flex: 1 }} />
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 10 * 0.18,
                  textTransform: 'uppercase',
                  color: colors.inkMute,
                }}
              >
                {checkedItems} OF {totalItems} DOCS
              </Text>
            </View>

            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)', overflow: 'hidden' }}>
              <View
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: colors.coral,
                }}
              />
            </View>
          </View>
        )}

        {/* ── Meta strip — Processing / Cost / Where ─────────── */}
        {guideData && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: 18,
              overflow: 'hidden',
            }}
          >
            {[
              { kicker: 'PROCESSING', value: guideData.processingTime || '—', icon: Clock },
              { kicker: 'TOTAL COST', value: guideData.cost?.total || '—', icon: DollarSign },
              { kicker: 'LODGE AT',   value: guideData.whereToApply?.name || '—', icon: MapPin },
            ].map((m, idx) => (
              <View
                key={idx}
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderRightWidth: idx < 2 ? StyleSheet.hairlineWidth : 0,
                  borderRightColor: colors.line,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <m.icon size={10} color={colors.inkMute} strokeWidth={2} />
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 9,
                      fontWeight: '700',
                      letterSpacing: 9 * 0.22,
                      color: colors.inkMute,
                    }}
                  >
                    {m.kicker}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 15,
                    lineHeight: 18,
                    letterSpacing: -15 * 0.014,
                    fontWeight: '500',
                    color: colors.ink,
                  }}
                  numberOfLines={2}
                >
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Tabs ──────────────────────────────────── */}
        <View style={{ marginBottom: 14 }}>
          <SegmentedControl
            options={['Checklist', 'Details', 'Tips']}
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'Checklist' | 'Details' | 'Tips')}
            variant="squiggle"
          />
        </View>

        {/* ── Checklist tab ─────────────────────────── */}
        {activeTab === 'Checklist' && checklist.length > 0 && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)}>
            <GuideSection
              kicker="DOCUMENT CHECKLIST"
              title="Pack the paperwork"
              icon={FileText}
              iconColor={colors.coral}
              orbBg={colors.coralBg}
            >
              {allCategories.map((cat, catIdx) => {
                const items = groupedChecklist[cat];
                if (!items || items.length === 0) return null;
                const catLabel = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                const isExpanded = expandedSections[cat] !== false;
                const catChecked = items.filter((i) => i.checked).length;

                return (
                  <View key={cat} style={{ marginTop: catIdx === 0 ? 0 : 14 }}>
                    <TouchableOpacity
                      onPress={() => toggleSection(cat)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 17,
                          letterSpacing: -17 * 0.014,
                          fontWeight: '500',
                          color: colors.ink,
                          flex: 1,
                        }}
                      >
                        {catLabel}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: catChecked === items.length ? colors.visaFreeBg : colors.surfaceMuted,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FontFamily.monoMedium,
                            fontSize: 9,
                            fontWeight: '700',
                            letterSpacing: 9 * 0.18,
                            color: catChecked === items.length ? colors.visaFree : colors.inkMute,
                          }}
                        >
                          {catChecked}/{items.length}
                        </Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={14} color={colors.inkFaint} strokeWidth={2} />
                      ) : (
                        <ChevronDown size={14} color={colors.inkFaint} strokeWidth={2} />
                      )}
                    </TouchableOpacity>

                    {isExpanded &&
                      items.map((item) => (
                        <View key={item.id}>
                          <TouchableOpacity
                            onPress={() => handleToggle(item.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              gap: 12,
                              paddingVertical: 10,
                              paddingHorizontal: 4,
                            }}
                            activeOpacity={0.7}
                          >
                            {item.checked ? (
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: colors.coral,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginTop: 1,
                                }}
                              >
                                <CheckCircle2 size={14} strokeWidth={2.5} color="#FFFFFF" />
                              </View>
                            ) : (
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  borderWidth: 1.5,
                                  borderColor: colors.line,
                                  marginTop: 1,
                                }}
                              />
                            )}
                            <Text
                              style={{
                                fontFamily: FontFamily.regular,
                                fontSize: 14,
                                lineHeight: 20,
                                color: item.checked ? colors.inkFaint : colors.inkSoft,
                                textDecorationLine: item.checked ? 'line-through' : 'none',
                                flex: 1,
                              }}
                            >
                              {item.label}
                            </Text>
                            {item.tip && (
                              <TouchableOpacity
                                onPress={() =>
                                  setExpandedTip(expandedTip === item.id ? null : item.id)
                                }
                                hitSlop={8}
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: colors.surfaceMuted,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginTop: 1,
                                }}
                              >
                                <Info size={12} strokeWidth={2} color={colors.inkMute} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>

                          {item.tip && expandedTip === item.id && (
                            <View
                              style={{
                                marginLeft: 34,
                                marginBottom: 8,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: colors.surfaceMuted,
                                borderLeftWidth: 2,
                                borderLeftColor: colors.coral,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: FontFamily.regular,
                                  fontSize: 13,
                                  lineHeight: 19,
                                  color: colors.inkSoft,
                                  fontStyle: 'italic',
                                }}
                              >
                                {item.tip}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                  </View>
                );
              })}
            </GuideSection>
          </Animated.View>
        )}

        {/* ── Details tab — Cost + Timeline + Bank + Where ── */}
        {activeTab === 'Details' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)}>
            {/* Cost Breakdown */}
            {guideData?.cost?.items && guideData.cost.items.length > 0 && (
              <GuideSection
                kicker="COST BREAKDOWN"
                title="Where the money goes"
                icon={DollarSign}
                iconColor={colors.coralDeep}
                orbBg={colors.coralBg}
              >
                {guideData.cost.items.map((item, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      paddingVertical: 10,
                      borderBottomWidth: idx < guideData.cost.items.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FontFamily.regular,
                        fontSize: 14,
                        lineHeight: 20,
                        color: colors.inkSoft,
                        flex: 1,
                      }}
                    >
                      {item.item}
                    </Text>
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 16,
                        letterSpacing: -16 * 0.014,
                        fontWeight: '500',
                        color: colors.ink,
                      }}
                    >
                      {item.amount}
                    </Text>
                  </View>
                ))}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    paddingTop: 14,
                    marginTop: 6,
                    borderTopWidth: 1.5,
                    borderTopColor: colors.ink,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 11 * 0.22,
                      textTransform: 'uppercase',
                      color: colors.inkMute,
                      flex: 1,
                    }}
                  >
                    All in
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 26,
                      letterSpacing: -26 * 0.02,
                      fontWeight: '500',
                      color: colors.ink,
                    }}
                  >
                    {guideData.cost.total}
                    <Text style={{ color: colors.coral }}>.</Text>
                  </Text>
                </View>
              </GuideSection>
            )}

            {/* Timeline */}
            {guideData?.timeline && guideData.timeline.length > 0 && (
              <GuideSection
                kicker="THE JOURNEY"
                title="From draft to decision"
                icon={Clock}
                iconColor={colors.teal}
                orbBg={colors.tealBg}
              >
                {guideData.timeline.map((step, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 14,
                      marginBottom: idx < guideData.timeline.length - 1 ? 14 : 0,
                      position: 'relative',
                    }}
                  >
                    {/* Stamped step circle (rotated, double-bordered) */}
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: colors.coralDeep,
                        backgroundColor: colors.coralBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ rotate: '-4deg' }],
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 15,
                          fontWeight: '500',
                          color: colors.coralDeep,
                        }}
                      >
                        {idx + 1}
                      </Text>
                    </View>

                    {/* Connector line */}
                    {idx < guideData.timeline.length - 1 && (
                      <View
                        style={{
                          position: 'absolute',
                          left: 15,
                          top: 32,
                          width: 1,
                          height: 16,
                          backgroundColor: colors.line,
                        }}
                      />
                    )}

                    <Text
                      style={{
                        fontFamily: FontFamily.regular,
                        fontSize: 14,
                        lineHeight: 20,
                        color: colors.inkSoft,
                        flex: 1,
                        paddingTop: 6,
                      }}
                    >
                      {step}
                    </Text>
                  </View>
                ))}
              </GuideSection>
            )}

            {/* Bank Requirements */}
            {guideData?.bankRequirements && (
              <GuideSection
                kicker="SHOW THE FUNDS"
                title="Bank balance"
                icon={Banknote}
                iconColor={colors.gold}
                orbBg={colors.goldSoft}
              >
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.coralBg,
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <Kicker color={colors.coralDeep} size={9}>MIN BALANCE</Kicker>
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 22,
                        letterSpacing: -22 * 0.018,
                        fontWeight: '500',
                        color: colors.coralDeep,
                        marginTop: 6,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {guideData.bankRequirements.minimumBalance}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.tealBg,
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <Kicker color={colors.teal} size={9}>STATEMENT WINDOW</Kicker>
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 22,
                        letterSpacing: -22 * 0.018,
                        fontWeight: '500',
                        color: colors.teal,
                        marginTop: 6,
                      }}
                    >
                      {guideData.bankRequirements.monthsRequired} mo
                    </Text>
                  </View>
                </View>

                {guideData.bankRequirements.tips?.map((tip, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      paddingVertical: 8,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.line,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.gold,
                        marginTop: 8,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: FontFamily.regular,
                        fontSize: 13,
                        lineHeight: 19,
                        color: colors.inkSoft,
                        flex: 1,
                      }}
                    >
                      {tip}
                    </Text>
                  </View>
                ))}
              </GuideSection>
            )}

            {/* Where to Apply */}
            {guideData?.whereToApply && (
              <GuideSection
                kicker="WHERE TO LODGE"
                title="The application desk"
                icon={MapPin}
                iconColor={colors.teal}
                orbBg={colors.tealBg}
              >
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 18,
                    letterSpacing: -18 * 0.014,
                    fontWeight: '500',
                    color: colors.ink,
                    marginBottom: 6,
                  }}
                >
                  {guideData.whereToApply.name}
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.regular,
                    fontSize: 13,
                    lineHeight: 19,
                    color: colors.inkSoft,
                    marginBottom: 10,
                  }}
                >
                  {guideData.whereToApply.address}
                </Text>
                {hasValue(guideData.whereToApply.nearestTube) ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: isHttpUrl(guideData.whereToApply.bookingUrl) ? 12 : 0,
                    }}
                  >
                    <Kicker size={9}>NEAREST · {guideData.whereToApply.nearestTube!.toUpperCase()}</Kicker>
                  </View>
                ) : null}
                {isHttpUrl(guideData.whereToApply.bookingUrl) ? (
                  <Pressable
                    onPress={() => Linking.openURL(guideData.whereToApply.bookingUrl!)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.coralDeep : colors.coral,
                      marginTop: 8,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 15,
                        fontWeight: '500',
                        color: '#FFFFFF',
                      }}
                    >
                      Book appointment
                    </Text>
                    <ExternalLink size={14} color="#FFFFFF" strokeWidth={2} />
                  </Pressable>
                ) : null}
              </GuideSection>
            )}
          </Animated.View>
        )}

        {/* ── Tips tab — Pitfalls (dark verdict) + Pro Tips (teal) ── */}
        {activeTab === 'Tips' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)}>
            {guideData?.rejectionReasons && guideData.rejectionReasons.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.ink,
                  borderRadius: 22,
                  padding: 20,
                  marginBottom: 14,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
                    <AlertTriangle size={16} color={colors.coral} strokeWidth={2} />
                  </View>
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
                  <Kicker color={colors.coral}>COMMON PITFALLS</Kicker>
                </View>

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
                  Don't trip up
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>

                <View style={{ gap: 12 }}>
                  {guideData.rejectionReasons.map((reason, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.coral,
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: FontFamily.regular,
                          fontSize: 13,
                          lineHeight: 20,
                          color: colors.solidTextSub,
                          flex: 1,
                        }}
                      >
                        {reason}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pro Tips — soft teal verdict card */}
            {guideData?.tips && guideData.tips.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.tealBg,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.tealSoft,
                  padding: 20,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <IconOrb icon={Lightbulb} iconColor={colors.teal} orbBg={colors.tealSoft} />
                  <Kicker color={colors.teal}>INSIDER TIPS</Kicker>
                </View>

                <EditorialTitle size={22}>From those who've done it</EditorialTitle>
                <Squiggle width={40} color={colors.coral} style={{ marginTop: 6, marginBottom: 14 }} />

                <View style={{ gap: 14 }}>
                  {guideData.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 24,
                          lineHeight: 24,
                          fontWeight: '500',
                          color: colors.teal,
                          minWidth: 24,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FontFamily.regular,
                          fontSize: 13,
                          lineHeight: 20,
                          color: colors.inkSoft,
                          flex: 1,
                          paddingTop: 2,
                        }}
                      >
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: insets.bottom + 90 }} />
      </ScrollView>

      {/* ── Floating "Ask Visa Atlas AI" FAB ───── */}
      <Pressable
        onPress={() => {
          // Open the visa chat as a full-screen route. The previous bottom-sheet
          // implementation never presented reliably (ref timing on iOS); a
          // dedicated route also gives the AI conversation the full editorial
          // canvas it deserves.
          router.push({ pathname: '/visa-chat/[guideId]', params: { guideId: String(guide._id) } });
        }}
        accessibilityRole="button"
        accessibilityLabel="Ask Visa Atlas AI"
        accessibilityHint="Opens an AI chat about this visa"
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.coral,
            bottom: insets.bottom + 22,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Sparkles size={22} color="#FFFFFF" strokeWidth={2.2} fill="#FFFFFF" />
      </Pressable>
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

  headerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },

  fab: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },

  // Status pill
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 10 * 0.18,
    textTransform: 'uppercase',
  },
  statusDropdownShadow: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 168,
    borderRadius: Radius.md,
    ...Shadows.cardRaised,
  },
  statusDropdownInner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
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
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});
