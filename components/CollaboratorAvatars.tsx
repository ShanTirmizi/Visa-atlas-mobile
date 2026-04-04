import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const AVATAR_COLORS = ['#E76F51', '#2A9D8F', '#E9C46A', '#264653', '#F4A261'];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.length % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export interface CollaboratorInfo {
  userId: string;
  userName: string | null;
  userImage?: string | null;
  role: string;
}

export interface PresenceUser {
  userId: string;
  name?: string | null;
  image?: string | null;
}

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  isOnline?: boolean;
}

export function Avatar({ name, imageUrl, size = 32, isOnline = false }: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.avatarBase,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bgColor,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              { fontSize: size * 0.35, lineHeight: size * 0.42 },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
      {isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: (size * 0.3) / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

interface CollaboratorAvatarsProps {
  collaborators: CollaboratorInfo[];
  presenceUsers: PresenceUser[];
  maxShow?: number;
}

export function CollaboratorAvatars({
  collaborators,
  presenceUsers,
  maxShow = 4,
}: CollaboratorAvatarsProps) {
  const onlineIds = new Set(presenceUsers.map((p) => p.userId));
  const visible = collaborators.slice(0, maxShow);
  const overflow = collaborators.length - maxShow;
  const AVATAR_SIZE = 32;
  const OVERLAP = 10;

  const totalWidth =
    visible.length * (AVATAR_SIZE - OVERLAP) +
    OVERLAP +
    (overflow > 0 ? AVATAR_SIZE - OVERLAP + 8 : 0);

  return (
    <View style={[styles.row, { width: totalWidth, height: AVATAR_SIZE }]}>
      {visible.map((c, idx) => (
        <View
          key={c.userId}
          style={[
            styles.avatarWrapper,
            {
              left: idx * (AVATAR_SIZE - OVERLAP),
              zIndex: visible.length - idx,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
            },
          ]}
        >
          <View
            style={[
              styles.avatarBorder,
              { borderRadius: AVATAR_SIZE / 2, width: AVATAR_SIZE, height: AVATAR_SIZE },
            ]}
          >
            <Avatar
              name={c.userName}
              imageUrl={c.userImage}
              size={AVATAR_SIZE - 2}
              isOnline={onlineIds.has(c.userId)}
            />
          </View>
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.avatarWrapper,
            {
              left: visible.length * (AVATAR_SIZE - OVERLAP),
              zIndex: 0,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
            },
          ]}
        >
          <View
            style={[
              styles.overflowCircle,
              { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
            ]}
          >
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarBase: {
    overflow: 'hidden',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBorder: {
    borderWidth: 1.5,
    borderColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowCircle: {
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  overflowText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
