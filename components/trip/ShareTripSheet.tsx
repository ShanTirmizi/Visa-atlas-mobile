import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Share,
  StyleSheet,
} from 'react-native';
import { BottomSheetView, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
// expo-file-system v19 (SDK 54) modern object API: File.downloadFileAsync
// streams straight to a File destination and rejects with UnableToDownload
// on any non-2xx response — no manual status checks needed.
import { File, Paths } from 'expo-file-system';
import {
  Link as LinkIcon,
  Copy,
  Share2,
  FileText,
  Users,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import { shareUrlForToken, sharePdfUrlForToken } from '@/constants/share';
import { AppBottomSheet, useSheetSettled } from '@/components/ui/AppBottomSheet';
import { AnimatedSwitch } from '@/components/ui/AnimatedSwitch';
import { SectionKicker } from '@/components/ui/SectionKicker';

// ──────────────────────────────────────────────
// ShareTripSheet
//
// The Notion/Wanderlog-style "share to web" sheet: a single link card with
// an iOS switch that mints/revokes the public /t/<token> link
// (convex/tripShares.ts), a copy / share / PDF action row that appears only
// while the link is live, and a handoff row into the collaborator invite
// flow. Public link = read-only web view; invite = in-app collaboration —
// the sheet keeps the two concepts visually separate (link card vs. divider
// + invite row), matching how Notion splits "Publish" from "Invite".
// ──────────────────────────────────────────────

export interface ShareTripSheetProps {
  tripId: Id<'trips'>;
  countryName: string;
  tripStatus?: string;
  /** Collaborator role from getTrip's `_role`. Viewers can copy/share an
   *  already-on link, but only editors may toggle it on or off. */
  role?: string;
}

export interface ShareTripSheetRef {
  present: () => void;
  dismiss: () => void;
}

/** Surface the backend's generation-guard messages faithfully; collapse
 *  everything else (network blips, request-id noise) to one calm line. */
function shareErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  // Widened to plain 'generating' so BOTH backend guards (still-generating
  // and didn't-finish/failed) surface their copy verbatim.
  if (raw.includes('generating')) {
    return raw.includes("didn't finish")
      ? "This trip didn't finish generating — retry it before sharing"
      : "This trip is still generating — try again when it's ready";
  }
  return "Couldn't update the share link — try again.";
}

const ShareTripSheet = forwardRef<ShareTripSheetRef, ShareTripSheetProps>(
  ({ tripId, countryName, tripStatus, role }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { showToast } = useToast();

    const sheetRef = useRef<BottomSheetModal>(null);
    // Present-gated subscription (EditDaySheet ref idiom): the share-status
    // query stays 'skip' until the sheet is first opened, so the trip screen
    // doesn't pay an always-on Convex subscription for a sheet most sessions
    // never present. Once opened it stays live — reopens are instant.
    const [everPresented, setEverPresented] = useState(false);
    useImperativeHandle(ref, () => ({
      present: () => {
        setEverPresented(true);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    // ── Share-link state ────────────────────────────────────
    const { isAuthenticated } = useConvexAuth();
    const status = useQuery(
      api.tripShares.getShareStatus,
      isAuthenticated && everPresented ? { tripId } : 'skip',
    );
    const createShareLink = useMutation(api.tripShares.createShareLink);
    const revokeShareLink = useMutation(api.tripShares.revokeShareLink);

    // Optimistic toggle: the switch follows the user's intent the moment
    // they tap; the reactive query is the source of truth and the effect
    // below clears the override once the server agrees (also covers the
    // idempotent no-op cases where the query result never changes).
    const [pendingOn, setPendingOn] = useState<boolean | null>(null);
    useEffect(() => {
      if (pendingOn === null || status === undefined) return;
      const serverOn = status !== null;
      if (serverOn === pendingOn) setPendingOn(null);
    }, [status, pendingOn]);

    const linkOn = pendingOn ?? (status !== null && status !== undefined);

    // Generating/failed trips can't mint links (backend enforces it too) —
    // premium behavior is to explain up front and disable, not error.
    const generationBlocked = tripStatus === 'generating' || tripStatus === 'failed';
    // Viewers can't toggle the link (createShareLink/revokeShareLink need
    // editor), but Copy/Share/PDF stay available while the link is on.
    const isViewer = role === 'viewer';
    const switchDisabled = status === undefined || generationBlocked || isViewer;

    const handleToggle = useCallback(() => {
      // One in-flight mutation at a time — taps during the spring are
      // ignored, exactly like an iOS Settings switch mid-animation.
      if (switchDisabled || pendingOn !== null || status === undefined) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const next = status === null;
      setPendingOn(next);
      const op = next ? createShareLink({ tripId }) : revokeShareLink({ tripId });
      op.catch((err: unknown) => {
        setPendingOn(null);
        showToast('error', shareErrorMessage(err));
      });
    }, [switchDisabled, pendingOn, status, createShareLink, revokeShareLink, tripId, showToast]);

    // ── Actions ─────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
      if (!status) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        await Clipboard.setStringAsync(shareUrlForToken(status.token));
        showToast('success', 'Link copied');
      } catch {
        showToast('error', "Couldn't copy the link — try again.");
      }
    }, [status, showToast]);

    const handleShare = useCallback(() => {
      if (!status) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const url = shareUrlForToken(status.token);
      // message + url + title — same shape as app/trip/invite.tsx; iOS
      // attaches the url, Android shares the message text.
      Share.share({
        message: `${countryName} itinerary on VisaAtlas\n${url}`,
        url,
        title: `${countryName} itinerary`,
      }).catch(() => {});
    }, [status, countryName]);

    const [pdfBusy, setPdfBusy] = useState(false);
    const handlePdf = useCallback(async () => {
      if (!status || pdfBusy) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setPdfBusy(true);
      try {
        // NFD splits accented chars into base + combining mark so the ASCII
        // strip keeps the base letter: "Türkiye" → "Turkiye", not "Trkiye".
        const safeName =
          countryName
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9 ]/gi, '')
            .trim() || 'Trip';
        // idempotent: a re-export overwrites the cached copy instead of
        // rejecting with DestinationAlreadyExists.
        const file = await File.downloadFileAsync(
          sharePdfUrlForToken(status.token),
          new File(Paths.cache, `${safeName} itinerary.pdf`),
          { idempotent: true },
        );
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: `${countryName} itinerary`,
        });
      } catch {
        showToast('error', "Couldn't fetch the PDF — try again.");
      } finally {
        setPdfBusy(false);
      }
    }, [status, pdfBusy, countryName, showToast]);

    // ── Invite handoff ──────────────────────────────────────
    // AppBottomSheet onDismiss recipe (see TripPlannerSheet's
    // pendingTripIdRef): the intent parks in a ref while the close
    // animation plays, and onDismiss fires the navigation exactly when it
    // completes. Never approximate the close animation with a setTimeout.
    const pendingInviteRef = useRef(false);
    const handleRequestInvite = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      pendingInviteRef.current = true;
      sheetRef.current?.dismiss();
    }, []);
    const handleDismiss = useCallback(() => {
      if (!pendingInviteRef.current) return;
      pendingInviteRef.current = false;
      router.push(`/trip/invite?tripId=${tripId}` as never);
    }, [router, tripId]);

    // ── Derived display ─────────────────────────────────────
    const displayUrl = status ? shareUrlForToken(status.token).replace(/^https?:\/\//, '') : '';

    return (
      <AppBottomSheet ref={sheetRef} onDismiss={handleDismiss}>
        <BottomSheetView
          style={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }}
        >
          {/* ── Header — mono kicker + Fraunces title + coral period ── */}
          <SectionKicker>SHARE</SectionKicker>
          <Text
            style={{
              fontFamily: FontFamily.displaySemibold,
              fontSize: FontSize['2xl'],
              // Fraunces descenders clip at 1.0 line-height (see
              // constants/typography.ts) — keep ~1.15×.
              lineHeight: 30,
              letterSpacing: -FontSize['2xl'] * 0.022,
              color: colors.ink,
              marginTop: 4,
            }}
          >
            Share this{' '}
            <Text style={{ fontFamily: FontFamily.displaySemiboldItalic, fontStyle: 'italic' }}>
              trip
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
            {tripStatus === 'failed'
              ? 'This trip didn’t finish generating, so there’s nothing to share yet.'
              : tripStatus === 'generating'
                ? 'Your trip is still generating — sharing unlocks when it’s ready.'
                : isViewer
                  ? 'Only trip editors can turn the link on or off.'
                  : 'Anyone with the link can view — no app needed.'}
          </Text>

          {/* ── Link card ── */}
          <View
            style={[
              styles.linkCard,
              { backgroundColor: colors.card, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.tealBg }]}>
              <LinkIcon size={20} color={colors.teal} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: colors.ink }]}>
                Anyone with the link
              </Text>
              {linkOn ? (
                status ? (
                  <Text
                    style={[styles.linkUrl, { color: colors.inkSoft }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {displayUrl}
                  </Text>
                ) : (
                  <Text style={[styles.linkUrl, { color: colors.inkMute }]}>
                    Creating link…
                  </Text>
                )
              ) : (
                <Text style={[styles.linkOff, { color: colors.inkMute }]}>
                  Link is off
                </Text>
              )}
              {linkOn && status && status.viewCount > 0 ? (
                <Text style={[styles.viewedLine, { color: colors.inkMute }]}>
                  Viewed {status.viewCount} time{status.viewCount === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleToggle}
              disabled={switchDisabled}
              hitSlop={10}
              accessibilityRole="switch"
              accessibilityState={{ checked: linkOn, disabled: switchDisabled }}
              accessibilityLabel="Public share link"
              style={{ opacity: switchDisabled ? 0.45 : 1 }}
            >
              <AnimatedSwitch value={linkOn} />
            </Pressable>
          </View>

          {/* ── Action row — only while the link is live ── */}
          {linkOn && status ? (
            // No `exiting`: inside a dynamic-sizing sheet an exiting view
            // leaves layout immediately and overlaps the rows below while it
            // fades — the sheet's own height animation covers the collapse.
            <Animated.View entering={FadeInDown.duration(220)} style={styles.actionRow}>
              <ActionPill icon={Copy} label="Copy link" onPress={handleCopy} />
              <ActionPill icon={Share2} label="Share…" onPress={handleShare} />
              <ActionPill icon={FileText} label="PDF" onPress={handlePdf} busy={pdfBusy} />
            </Animated.View>
          ) : null}

          {/* ── Divider ── */}
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          {/* ── Collaborate handoff ── */}
          <InviteRow onPress={handleRequestInvite} />
        </BottomSheetView>
      </AppBottomSheet>
    );
  },
);

ShareTripSheet.displayName = 'ShareTripSheet';
export default ShareTripSheet;

// ════════════════════════════════════════════════════════════════════════
// ActionPill — soft teal pill, equal-width row member. Fixed 16px icon slot
// so the ActivityIndicator swap never changes the pill's height.
// ════════════════════════════════════════════════════════════════════════
function ActionPill({
  icon: Icon,
  label,
  onPress,
  busy = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy }}
      style={({ pressed }) => [
        styles.actionPill,
        { backgroundColor: colors.tealBg, opacity: busy ? 0.6 : pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.actionPillIconSlot}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={colors.teal}
            style={{ transform: [{ scale: 0.8 }] }}
          />
        ) : (
          <Icon size={15} color={colors.teal} strokeWidth={2} />
        )}
      </View>
      <Text numberOfLines={1} style={[styles.actionPillText, { color: colors.teal }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════
// InviteRow — collaborate handoff. Lives in its own component so it can
// read useSheetSettled (the context is provided inside AppBottomSheet):
// a tap that lands mid-present/dismiss animation is ignored, preventing
// the wedged-modal state documented in AppBottomSheet.tsx.
// ════════════════════════════════════════════════════════════════════════
function InviteRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const settled = useSheetSettled();
  return (
    <Pressable
      onPress={() => {
        if (!settled) return;
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Invite a travel partner"
      style={({ pressed }) => [styles.inviteRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.coralBg }]}>
        <Users size={20} color={colors.coral} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.linkTitle, { color: colors.ink }]}>
          Invite a travel partner
        </Text>
        <Text style={[styles.inviteSub, { color: colors.inkSoft }]}>
          Plan together — edits, votes and chat in the app
        </Text>
      </View>
      <ChevronRight size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginTop: 4,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  linkUrl: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  linkOff: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  viewedLine: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  actionPillIconSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
});
