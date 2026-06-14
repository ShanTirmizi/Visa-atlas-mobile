// components/chat/ChatHistorySheet.tsx
//
// Trip-copilot conversation history — the ChatGPT / Claude "past chats" list.
// Lists every session for a trip newest-active first; tapping one switches
// the copilot to that thread, and a "New chat" row starts a fresh one. Built
// on AppBottomSheet so it inherits the house dynamic-sizing + backdrop chrome.

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useConvexAuth, useQuery } from 'convex/react';
import { Check, SquarePen, MessageCircle } from 'lucide-react-native';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { hapticSelect } from '@/utils/haptics';

export interface ChatHistorySheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ChatHistorySheetProps {
  tripId: Id<'trips'>;
  activeSessionId: Id<'tripChatSessions'> | null;
  onSelect: (id: Id<'tripChatSessions'>) => void;
  onNewChat: () => void;
}

/** Compact relative time — "just now", "5m", "2h", "3d", else a short date. */
function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ChatHistorySheet = forwardRef<ChatHistorySheetRef, ChatHistorySheetProps>(
  function ChatHistorySheet({ tripId, activeSessionId, onSelect, onNewChat }, ref) {
    const { colors } = useTheme();
    const { isAuthenticated } = useConvexAuth();
    const modalRef = useRef<BottomSheetModal>(null);
    // Only subscribe while the sheet is actually open — this component is
    // mounted for the whole chat screen, so an ungated query would re-run the
    // session list on every message the user sends.
    const [presented, setPresented] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          setPresented(true);
          modalRef.current?.present();
        },
        dismiss: () => modalRef.current?.dismiss(),
      }),
      [],
    );

    const sessions =
      useQuery(
        api.trips.listChatSessions,
        isAuthenticated && presented ? { tripId } : 'skip',
      ) ?? [];
    // toLocaleDateString is fine in render; relative math needs a single
    // "now" so every row reads against the same instant.
    const now = Date.now();

    const handleSelect = (id: Id<'tripChatSessions'>) => {
      hapticSelect();
      modalRef.current?.dismiss();
      onSelect(id);
    };

    const handleNew = () => {
      modalRef.current?.dismiss();
      onNewChat();
    };

    return (
      <AppBottomSheet ref={modalRef} onDismiss={() => setPresented(false)}>
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Text style={[Type.kicker, { color: colors.coralDeep, fontSize: 10 }]}>
              CONVERSATIONS
            </Text>
          </View>

          {/* New chat */}
          <Pressable
            onPress={handleNew}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.coralBg }]}>
              <SquarePen size={16} color={colors.coralDeep} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 16,
                  fontWeight: '500',
                  color: colors.ink,
                  letterSpacing: -16 * 0.012,
                }}
              >
                New chat
              </Text>
            </View>
          </Pressable>

          {sessions.length > 0 ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              {sessions.map((s) => {
                const active = s._id === activeSessionId;
                const label =
                  s.title && s.title.trim().length > 0 ? s.title.trim() : 'New conversation';
                const meta = `${relativeTime(s.lastMessageAt, now)} · ${s.messageCount} ${
                  s.messageCount === 1 ? 'message' : 'messages'
                }`;
                return (
                  <Pressable
                    key={s._id}
                    onPress={() => handleSelect(s._id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open conversation: ${label}`}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: active ? colors.coralBg : colors.surface,
                        borderColor: active ? colors.coralDeep : colors.line,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: active ? colors.surface : colors.surfaceMuted },
                      ]}
                    >
                      <MessageCircle
                        size={15}
                        color={active ? colors.coralDeep : colors.inkMute}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: FontFamily.semibold,
                          fontSize: 14,
                          color: colors.ink,
                          letterSpacing: -0.1,
                        }}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                      <Text
                        style={[Type.meta11, { color: colors.inkMute, marginTop: 2 }]}
                        numberOfLines={1}
                      >
                        {meta}
                      </Text>
                    </View>
                    {active ? (
                      <Check size={16} color={colors.coralDeep} strokeWidth={2.4} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[Type.meta11, { color: colors.inkMute, marginTop: 14, marginLeft: 2 }]}>
              Your conversations will appear here.
            </Text>
          )}
        </BottomSheetScrollView>
      </AppBottomSheet>
    );
  },
);

export default ChatHistorySheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
