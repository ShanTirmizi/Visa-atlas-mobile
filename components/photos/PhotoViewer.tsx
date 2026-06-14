// components/photos/PhotoViewer.tsx
//
// Full-screen photo lightbox — iOS Photos / Airbnb gallery pattern:
// pinch + double-tap zoom, horizontal paging, vertical pull-to-dismiss
// with the backdrop fading as the photo follows the finger, tap to
// toggle chrome. Gesture math comes from react-native-zoom-toolkit's
// Gallery (v5, May 2026) — never hand-rolled.
//
// Mounted once by PhotoViewerProvider (app/_layout.tsx); any screen opens
// it imperatively:
//
//   const { openPhotoViewer } = usePhotoViewer();
//   openPhotoViewer(album, startIndex);

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gallery,
  type SwipeDirection,
  type VerticalPullOptions,
} from 'react-native-zoom-toolkit';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarHidden } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { hapticSelect } from '@/utils/haptics';
import type { AlbumPhoto } from '@/utils/photoAlbum';

// Dismissal thresholds — UIKit-interactive-dismissal feel: a decisive
// flick commits even on short travel, otherwise distance decides (same
// rule DayDetailScreen's page swipe applies horizontally).
const PULL_DISMISS_DISTANCE = 110;
const PULL_DISMISS_VELOCITY = 800;

interface PhotoViewerApi {
  openPhotoViewer: (photos: AlbumPhoto[], startIndex?: number) => void;
}

const PhotoViewerContext = createContext<PhotoViewerApi | null>(null);

export function usePhotoViewer(): PhotoViewerApi {
  const ctx = useContext(PhotoViewerContext);
  if (!ctx) {
    throw new Error('usePhotoViewer must be used within PhotoViewerProvider');
  }
  return ctx;
}

interface ViewerSession {
  photos: AlbumPhoto[];
  startIndex: number;
}

export function PhotoViewerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ViewerSession | null>(null);

  const openPhotoViewer = useCallback((photos: AlbumPhoto[], startIndex = 0) => {
    const usable = photos.filter((p) => !!p?.url);
    if (usable.length === 0) return;
    hapticSelect();
    setStatusBarHidden(true, 'fade');
    setSession({
      photos: usable,
      startIndex: Math.max(0, Math.min(startIndex, usable.length - 1)),
    });
  }, []);

  const close = useCallback(() => {
    setStatusBarHidden(false, 'fade');
    setSession(null);
  }, []);

  const api = useMemo(() => ({ openPhotoViewer }), [openPhotoViewer]);

  return (
    <PhotoViewerContext.Provider value={api}>
      {children}
      {session ? <PhotoViewerModal session={session} onClose={close} /> : null}
    </PhotoViewerContext.Provider>
  );
}

// ── The modal viewer ─────────────────────────────────────────────────

function PhotoViewerModal({
  session,
  onClose,
}: {
  session: ViewerSession;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // react-native-zoom-toolkit's Gallery measures each page from its
  // renderItem child's onLayout and feeds that size into the pan/zoom math.
  // The child therefore MUST carry a concrete size — an absolutely-filled
  // image measures 0×0 and collapses to nothing (the black-screen bug).
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { photos, startIndex } = session;

  const [index, setIndex] = useState(startIndex);
  // Chrome visibility is mirrored: shared value drives the UI-thread fade,
  // JS state drives pointerEvents (a worklet can't toggle those).
  const [chromeOn, setChromeOn] = useState(true);
  const chrome = useSharedValue(1);
  // Mirrors the gallery item's vertical pull so the backdrop and chrome
  // fade as the photo follows the finger (iOS Photos dismissal feel).
  const pullY = useSharedValue(0);

  const toggleChrome = useCallback(() => {
    setChromeOn((on) => {
      chrome.value = withTiming(on ? 0 : 1, { duration: 160 });
      return !on;
    });
  }, [chrome]);

  const dismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const onVerticalPull = useCallback(
    (options: VerticalPullOptions) => {
      'worklet';
      pullY.value = options.translateY;
      if (!options.released) return;
      if (
        Math.abs(options.translateY) > PULL_DISMISS_DISTANCE ||
        Math.abs(options.velocityY) > PULL_DISMISS_VELOCITY
      ) {
        runOnJS(dismiss)();
      } else {
        // Gallery springs the photo back on its own; ease the mirror value
        // home so the backdrop fades back in step.
        pullY.value = withTiming(0, { duration: 200 });
      }
    },
    [dismiss, pullY],
  );

  const onSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (direction === 'up' || direction === 'down') dismiss();
    },
    [dismiss],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(pullY.value), [0, 260], [1, 0.35], 'clamp'),
  }));

  // Chrome hides while pulling even when toggled on — captions floating
  // over a half-dismissed photo read as broken.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity:
      chrome.value * interpolate(Math.abs(pullY.value), [0, 80], [1, 0], 'clamp'),
  }));

  const renderItem = useCallback(
    (item: AlbumPhoto, itemIndex: number) => (
      // Full-screen, explicitly sized box (black, so 'contain' letterboxes on
      // true black like iOS Photos). The size is what the Gallery measures.
      <View style={{ width: screenW, height: screenH, backgroundColor: '#000000' }}>
        <ExpoImage
          source={{ uri: item.url }}
          // Strip thumbs are the same cached 1200px file, so this is usually
          // an instant cache hit; distinct thumbs paint low-res first.
          placeholder={item.thumb && item.thumb !== item.url ? { uri: item.thumb } : undefined}
          contentFit="contain"
          transition={120}
          recyclingKey={`${item.url}-${itemIndex}`}
          style={{ width: screenW, height: screenH }}
          accessibilityLabel={item.title ?? 'Trip photo'}
        />
      </View>
    ),
    [screenW, screenH],
  );

  const keyExtractor = useCallback(
    (item: AlbumPhoto, itemIndex: number) => `${item.url}-${itemIndex}`,
    [],
  );

  const current = photos[Math.max(0, Math.min(index, photos.length - 1))];

  const openCredit = useCallback(() => {
    if (current?.creditUrl) {
      Linking.openURL(current.creditUrl).catch(() => {});
    }
  }, [current?.creditUrl]);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={dismiss}
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* Gestures inside an RN Modal need their own gesture root on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />

        <Gallery
          data={photos}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialIndex={startIndex}
          gap={24}
          maxScale={6}
          onIndexChange={setIndex}
          onTap={toggleChrome}
          onVerticalPull={onVerticalPull}
          onSwipe={onSwipe}
        />

        {/* ── Chrome: top bar ── */}
        <Animated.View
          style={[styles.topChrome, chromeStyle]}
          pointerEvents={chromeOn ? 'box-none' : 'none'}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[styles.topBar, { top: insets.top + 8 }]}>
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel="Close photos"
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <X size={18} color={colors.solidText} strokeWidth={2.4} />
            </Pressable>

            {/* Same glass-pill vocabulary as the day screen's "Day 4 of 10". */}
            <View style={styles.counterPill}>
              <Text style={[styles.counterText, { color: colors.solidText }]}>
                {`${index + 1} of ${photos.length}`}
              </Text>
            </View>

            {/* Balance spacer so the counter stays optically centred. */}
            <View style={styles.closeBtnGhost} />
          </View>
        </Animated.View>

        {/* ── Chrome: bottom caption ── */}
        <Animated.View
          style={[styles.bottomChrome, chromeStyle]}
          pointerEvents={chromeOn ? 'box-none' : 'none'}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Keyed remount per photo → soft crossfade as you page. */}
          <Animated.View
            key={`caption-${index}`}
            entering={FadeIn.duration(180)}
            style={[styles.caption, { paddingBottom: insets.bottom + 18 }]}
          >
            {current?.kicker ? (
              <Text
                style={[styles.captionKicker, { color: colors.solidTextSub }]}
                numberOfLines={1}
              >
                {current.kicker}
              </Text>
            ) : null}
            {current?.title ? (
              <Text
                style={[styles.captionTitle, { color: colors.solidText }]}
                numberOfLines={2}
              >
                {current.title}
              </Text>
            ) : null}
            {current?.credit ? (
              <Pressable
                onPress={openCredit}
                disabled={!current.creditUrl}
                accessibilityRole={current.creditUrl ? 'link' : 'text'}
                accessibilityLabel={`Photo by ${current.credit}`}
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text
                  style={[styles.captionCredit, { color: colors.solidTextMuted }]}
                  numberOfLines={1}
                >
                  {`Photo · ${current.credit}`}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // The photo canvas is always true black (iOS Photos / every premium
  // lightbox) regardless of app theme.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },

  // ── Top chrome ──
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  topBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Glass chrome on photography — exact values from DayDetailScreen's
  // day-nav pill so the two surfaces read as one system.
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  closeBtnGhost: {
    width: 38,
    height: 38,
  },
  counterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  counterText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // ── Bottom chrome ──
  bottomChrome: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 160,
    justifyContent: 'flex-end',
  },
  caption: {
    paddingHorizontal: 22,
  },
  captionKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.18,
  },
  captionTitle: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -20 * 0.018,
    lineHeight: 24,
    marginTop: 3,
  },
  captionCredit: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    marginTop: 6,
  },
});
