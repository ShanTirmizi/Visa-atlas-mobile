import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';

// ════════════════════════════════════════════════════════════════════════
// CollabStack — overlapping initials avatars for trip collaborators.
//
// Facepile pattern (Google Docs / Figma / Notion headers): circles overlap
// by 8pt with a paper-coloured separation ring; collaborators who are
// active on the trip right now (tripPresence, lastSeen ≤ 60s — the server
// query already filters) swap that ring for teal. No dots — the ring IS
// the presence signal, per the house rule against status dots.
//
// Hidden entirely on solo trips (fewer than 2 collaborators) so the header
// stays quiet for the common case.
// ════════════════════════════════════════════════════════════════════════

const AVATAR_SIZE = 24;
const RING_WIDTH = 2;
const OVERLAP = -8;
const VISIBLE_CAP = 3;

function initialsFor(name: string | null, email: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    const result = (first + last).toUpperCase();
    if (result) return result;
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

function roleLabel(role: 'owner' | 'editor' | 'viewer'): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface CollabStackProps {
  tripId: Id<'trips'>;
}

export function CollabStack({ tripId }: CollabStackProps) {
  const { colors } = useTheme();

  const collaborators = useQuery(api.trips.getCollaborators, { tripId });
  const presence = useQuery(api.tripPresence.getPresence, { tripId });

  // Solo trip (or still loading) — render nothing, zero layout cost.
  if (!collaborators || collaborators.length < 2) return null;

  const activeIds = new Set((presence ?? []).map((p) => String(p.userId)));

  // Match the planner AvatarStack overflow rule: when the count exceeds the
  // cap, show one fewer avatar so the "+N" chip takes that slot — the strip
  // width stays fixed.
  const count = collaborators.length;
  const shown = count <= VISIBLE_CAP ? count : VISIBLE_CAP - 1;
  const overflow = count - shown;

  const handlePress = () => {
    hapticSelect();
    const lines = collaborators.map((c) => {
      const name = c.userName ?? c.userEmail ?? 'Traveler';
      const here = activeIds.has(String(c.userId)) ? ' · here now' : '';
      return `${name} — ${roleLabel(c.role)}${here}`;
    });
    Alert.alert('Travelers', lines.join('\n'), [
      {
        text: 'Invite a travel partner',
        onPress: () => router.push(`/trip/invite?tripId=${tripId}` as never),
      },
      { text: 'Done', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${count} travelers on this trip. View collaborators`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {collaborators.slice(0, shown).map((c, i) => {
        const isActive = activeIds.has(String(c.userId));
        // Soft-pill colouring: same-token text on the matching *Bg tint,
        // alternating teal / coral so adjacent avatars read distinctly.
        const isTeal = i % 2 === 0;
        return (
          <View
            key={String(c._id)}
            style={[
              styles.ring,
              {
                marginLeft: i === 0 ? 0 : OVERLAP,
                // The ring doubles as the overlap separator: paper-coloured
                // normally, teal when the collaborator is here right now.
                borderColor: isActive ? colors.teal : colors.background,
                backgroundColor: colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: isTeal ? colors.tealBg : colors.coralBg },
              ]}
            >
              <Text
                style={[
                  styles.initials,
                  { color: isTeal ? colors.teal : colors.coralDeep },
                ]}
              >
                {initialsFor(c.userName, c.userEmail)}
              </Text>
            </View>
          </View>
        );
      })}
      {overflow > 0 && (
        <View
          style={[
            styles.ring,
            {
              marginLeft: OVERLAP,
              borderColor: colors.background,
              backgroundColor: colors.background,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.teal }]}>
            <Text style={[styles.initials, { color: '#FFFFFF' }]}>
              +{overflow}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ring: {
    width: AVATAR_SIZE + RING_WIDTH * 2,
    height: AVATAR_SIZE + RING_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + RING_WIDTH * 2) / 2,
    borderWidth: RING_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export default CollabStack;
