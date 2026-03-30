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
  preparing: { label: 'Preparing', color: '#e9c46a', bg: 'rgba(233, 196, 106, 0.15)' },
  submitted: { label: 'Submitted', color: '#f4a261', bg: 'rgba(244, 162, 97, 0.15)' },
  approved:  { label: 'Approved',  color: '#2a9d8f', bg: 'rgba(42, 157, 143, 0.15)' },
  rejected:  { label: 'Rejected',  color: '#e76f51', bg: 'rgba(231, 111, 81, 0.15)' },
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

function countryCodeToFlag(code: string): string {
  const a2 = code.slice(0, 2).toUpperCase();
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
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
      ]}
    >
      <View style={[styles.sectionHeader, { borderBottomColor: colors.borderSubtle }]}>
        <Icon size={16} strokeWidth={1.5} color={iconColor} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
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
              style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusText, { color: currentStatus.color }]}>
                {currentStatus.label}
              </Text>
              <ChevronDown size={14} color={currentStatus.color} strokeWidth={2} />
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
              { backgroundColor: colors.card, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                {checkedItems} of {totalItems} documents ready
              </Text>
              <Text
                style={[
                  styles.progressPct,
                  { color: progressPct === 100 ? colors.success : colors.textMuted },
                ]}
              >
                {progressPct}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.shimmer }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: progressPct === 100 ? colors.success : colors.secondary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Quick stats ───────────────────────────── */}
        {guideData && (
          <View style={styles.statsRow}>
            {[
              { icon: Clock, label: 'Processing', value: guideData.processingTime || 'N/A' },
              { icon: DollarSign, label: 'Total Cost', value: guideData.cost?.total || 'N/A' },
              { icon: MapPin, label: 'Where', value: guideData.whereToApply?.name || 'N/A' },
            ].map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.statIconRow}>
                  <stat.icon size={13} strokeWidth={1.5} color={colors.primary} />
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {stat.label}
                  </Text>
                </View>
                <Text
                  style={[styles.statValue, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
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
                    <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>
                      {catLabel}
                    </Text>
                    <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                      {items.filter((i) => i.checked).length}/{items.length}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={14} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={14} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  {isExpanded &&
                    items.map((item) => (
                      <View key={item.id}>
                        <TouchableOpacity
                          onPress={() => handleToggle(item.id)}
                          style={[
                            styles.checkItem,
                            item.checked && { backgroundColor: colors.primaryBg },
                          ]}
                          activeOpacity={0.7}
                        >
                          {item.checked ? (
                            <CheckCircle2 size={20} strokeWidth={2} color={colors.primary} />
                          ) : (
                            <Circle size={20} strokeWidth={1.5} color={colors.textMuted} />
                          )}
                          <Text
                            style={[
                              styles.checkLabel,
                              {
                                color: item.checked ? colors.textMuted : colors.foreground,
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
                                color={
                                  expandedTip === item.id ? colors.secondary : colors.textMuted
                                }
                              />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {item.tip && expandedTip === item.id && (
                          <View
                            style={[
                              styles.tipBubble,
                              {
                                backgroundColor: colors.secondaryBg,
                                borderColor: 'rgba(233, 196, 106, 0.2)',
                              },
                            ]}
                          >
                            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
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
                    borderBottomColor: colors.borderSubtle,
                  },
                ]}
              >
                <Text style={[styles.costItem, { color: colors.textSecondary }]}>
                  {item.item}
                </Text>
                <Text style={[styles.costAmount, { color: colors.foreground }]}>
                  {item.amount}
                </Text>
              </View>
            ))}
            <View style={[styles.costTotal, { borderTopColor: colors.border }]}>
              <Text style={[styles.costTotalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.costTotalValue, { color: colors.primary }]}>
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
                      backgroundColor:
                        idx === 0 || idx === guideData.timeline.length - 1
                          ? colors.primaryBg
                          : colors.shimmer,
                      borderColor:
                        idx === 0 || idx === guideData.timeline.length - 1
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineDotText,
                      {
                        color:
                          idx === 0 || idx === guideData.timeline.length - 1
                            ? colors.primary
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
                {idx < guideData.timeline.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.borderSubtle }]} />
                )}
                <Text style={[styles.timelineLabel, { color: colors.textSecondary }]}>
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
                  { backgroundColor: colors.shimmer, borderColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.bankLabel, { color: colors.textMuted }]}>
                  Minimum Balance
                </Text>
                <Text style={[styles.bankValue, { color: colors.secondary }]}>
                  {guideData.bankRequirements.minimumBalance}
                </Text>
              </View>
              <View
                style={[
                  styles.bankCard,
                  { backgroundColor: colors.shimmer, borderColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.bankLabel, { color: colors.textMuted }]}>
                  Months Required
                </Text>
                <Text style={[styles.bankValue, { color: colors.secondary }]}>
                  {guideData.bankRequirements.monthsRequired} months
                </Text>
              </View>
            </View>

            {guideData.bankRequirements.tips?.map((tip, idx) => (
              <View
                key={idx}
                style={[
                  styles.bankTip,
                  { backgroundColor: colors.secondaryBg, borderColor: 'rgba(233, 196, 106, 0.15)' },
                ]}
              >
                <Lightbulb size={14} strokeWidth={1.5} color={colors.secondary} />
                <Text style={[styles.bankTipText, { color: colors.textSecondary }]}>{tip}</Text>
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
                  { backgroundColor: colors.dangerBg, borderColor: 'rgba(231, 111, 81, 0.2)' },
                ]}
              >
                <AlertTriangle size={15} strokeWidth={1.5} color={colors.danger} />
                <Text style={[styles.pitfallText, { color: colors.textSecondary }]}>
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
                  { backgroundColor: colors.primaryBg, borderColor: 'rgba(42, 157, 143, 0.15)' },
                ]}
              >
                <Text style={[styles.proTipNum, { color: colors.primary }]}>{idx + 1}</Text>
                <Text style={[styles.proTipText, { color: colors.textSecondary }]}>{tip}</Text>
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
    width: 36,
    height: 36,
    justifyContent: 'center',
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
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
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
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
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
    borderRadius: Radius.md,
    borderWidth: 1,
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
    borderWidth: 1,
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
