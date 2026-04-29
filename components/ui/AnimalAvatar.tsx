import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

export type AnimalKind = 'bear' | 'panda' | 'fox' | 'cat' | 'owl' | 'deer';

interface AnimalAvatarProps {
  kind: AnimalKind;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Flat-style cartoon animal illustration. Used as a charming stand-in for
 *  real travel-companion avatars in the planner sheet. */
export function AnimalAvatar({ kind, size = 32, style }: AnimalAvatarProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: BG[kind],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {render(kind)}
      </Svg>
    </View>
  );
}

const BG: Record<AnimalKind, string> = {
  bear: '#D4A875',
  panda: '#EFEAE0',
  fox: '#E8A573',
  cat: '#B8B0A4',
  owl: '#D4B470',
  deer: '#D8B894',
};

function render(kind: AnimalKind) {
  switch (kind) {
    case 'bear':
      return (
        <G>
          {/* Ears (outer) */}
          <Circle cx="9" cy="11" r="3.2" fill="#7A4F2E" />
          <Circle cx="23" cy="11" r="3.2" fill="#7A4F2E" />
          {/* Ears (inner) */}
          <Circle cx="9" cy="11" r="1.6" fill="#D4A875" />
          <Circle cx="23" cy="11" r="1.6" fill="#D4A875" />
          {/* Head */}
          <Circle cx="16" cy="17" r="9" fill="#8C5E3B" />
          {/* Snout */}
          <Ellipse cx="16" cy="20" rx="4.5" ry="3.3" fill="#E0C39E" />
          {/* Eyes */}
          <Circle cx="13" cy="16" r="1" fill="#2A1F1A" />
          <Circle cx="19" cy="16" r="1" fill="#2A1F1A" />
          {/* Nose */}
          <Ellipse cx="16" cy="19" rx="1.1" ry="0.8" fill="#2A1F1A" />
        </G>
      );
    case 'panda':
      return (
        <G>
          {/* Ears */}
          <Circle cx="9" cy="11" r="3" fill="#1F1A18" />
          <Circle cx="23" cy="11" r="3" fill="#1F1A18" />
          {/* Head */}
          <Circle cx="16" cy="17" r="9" fill="#F5F2E9" />
          {/* Eye patches */}
          <Ellipse cx="12.5" cy="16" rx="2" ry="2.6" fill="#1F1A18" transform="rotate(-12 12.5 16)" />
          <Ellipse cx="19.5" cy="16" rx="2" ry="2.6" fill="#1F1A18" transform="rotate(12 19.5 16)" />
          {/* Eye whites */}
          <Circle cx="12.5" cy="16" r="0.7" fill="#F5F2E9" />
          <Circle cx="19.5" cy="16" r="0.7" fill="#F5F2E9" />
          {/* Nose */}
          <Ellipse cx="16" cy="19.4" rx="1.2" ry="0.9" fill="#1F1A18" />
          {/* Mouth */}
          <Path d="M16 20.4 L 14.7 21.7 M 16 20.4 L 17.3 21.7" stroke="#1F1A18" strokeWidth="0.7" strokeLinecap="round" fill="none" />
        </G>
      );
    case 'fox':
      return (
        <G>
          {/* Ears (triangles) */}
          <Path d="M7 12 L11 6 L13 12 Z" fill="#B85F2D" />
          <Path d="M25 12 L21 6 L19 12 Z" fill="#B85F2D" />
          <Path d="M9 11 L11 8 L12 11 Z" fill="#F5E2D2" />
          <Path d="M23 11 L21 8 L20 11 Z" fill="#F5E2D2" />
          {/* Head */}
          <Path d="M6 17 Q 16 8 26 17 Q 24 25 16 25 Q 8 25 6 17 Z" fill="#D8804A" />
          {/* White muzzle */}
          <Path d="M11 20 Q 16 27 21 20 Q 16 22 11 20 Z" fill="#F5F2E9" />
          {/* Eyes */}
          <Circle cx="13" cy="16" r="1" fill="#1F1A18" />
          <Circle cx="19" cy="16" r="1" fill="#1F1A18" />
          {/* Nose */}
          <Ellipse cx="16" cy="20" rx="1.1" ry="0.9" fill="#1F1A18" />
        </G>
      );
    case 'cat':
      return (
        <G>
          {/* Ears */}
          <Path d="M7 12 L10 6 L13 12 Z" fill="#7E7972" />
          <Path d="M25 12 L22 6 L19 12 Z" fill="#7E7972" />
          <Path d="M9 11 L10 8.5 L11.5 11 Z" fill="#D9A496" />
          <Path d="M23 11 L22 8.5 L20.5 11 Z" fill="#D9A496" />
          {/* Head */}
          <Circle cx="16" cy="18" r="8.5" fill="#8E8B85" />
          {/* Cheek patches */}
          <Ellipse cx="13" cy="20" rx="2.4" ry="1.6" fill="#F5F2E9" />
          <Ellipse cx="19" cy="20" rx="2.4" ry="1.6" fill="#F5F2E9" />
          {/* Eyes */}
          <Ellipse cx="13" cy="16.5" rx="0.8" ry="1.4" fill="#1F1A18" />
          <Ellipse cx="19" cy="16.5" rx="0.8" ry="1.4" fill="#1F1A18" />
          {/* Nose */}
          <Ellipse cx="16" cy="19.5" rx="0.9" ry="0.7" fill="#D9A496" />
          {/* Whiskers */}
          <Path d="M11 21 L 8 20.5 M 11 21.5 L 8 22 M 21 21 L 24 20.5 M 21 21.5 L 24 22" stroke="#5A554F" strokeWidth="0.4" strokeLinecap="round" />
        </G>
      );
    case 'owl':
      return (
        <G>
          {/* Ear tufts */}
          <Path d="M8 10 L 10 6 L 12 10 Z" fill="#9C6E1F" />
          <Path d="M24 10 L 22 6 L 20 10 Z" fill="#9C6E1F" />
          {/* Body/head */}
          <Ellipse cx="16" cy="17" rx="9" ry="9.5" fill="#B8862B" />
          {/* Belly */}
          <Ellipse cx="16" cy="20" rx="5" ry="5.5" fill="#E8D4A0" />
          {/* Eye discs */}
          <Circle cx="12.5" cy="15" r="3" fill="#F5F2E9" />
          <Circle cx="19.5" cy="15" r="3" fill="#F5F2E9" />
          {/* Pupils */}
          <Circle cx="12.5" cy="15.2" r="1.3" fill="#1F1A18" />
          <Circle cx="19.5" cy="15.2" r="1.3" fill="#1F1A18" />
          {/* Eye glints */}
          <Circle cx="13" cy="14.7" r="0.4" fill="#F5F2E9" />
          <Circle cx="20" cy="14.7" r="0.4" fill="#F5F2E9" />
          {/* Beak */}
          <Path d="M16 17.5 L 14.5 19.5 L 17.5 19.5 Z" fill="#D9852F" />
        </G>
      );
    case 'deer':
      return (
        <G>
          {/* Antlers */}
          <Path d="M11 8 L 9.5 4 M 11 8 L 12.5 5.5 M 11 8 L 8 7" stroke="#7A5839" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <Path d="M21 8 L 22.5 4 M 21 8 L 19.5 5.5 M 21 8 L 24 7" stroke="#7A5839" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          {/* Ears */}
          <Ellipse cx="9" cy="12" rx="1.6" ry="2.6" fill="#A07953" transform="rotate(-22 9 12)" />
          <Ellipse cx="23" cy="12" rx="1.6" ry="2.6" fill="#A07953" transform="rotate(22 23 12)" />
          {/* Head */}
          <Ellipse cx="16" cy="18" rx="7.5" ry="8.5" fill="#C8A47E" />
          {/* Muzzle */}
          <Ellipse cx="16" cy="22.5" rx="3.5" ry="2.6" fill="#E8D4B6" />
          {/* Spots */}
          <Circle cx="12" cy="21" r="0.6" fill="#F5F2E9" opacity="0.7" />
          <Circle cx="20" cy="21" r="0.6" fill="#F5F2E9" opacity="0.7" />
          {/* Eyes */}
          <Circle cx="13" cy="17" r="0.95" fill="#1F1A18" />
          <Circle cx="19" cy="17" r="0.95" fill="#1F1A18" />
          {/* Nose */}
          <Ellipse cx="16" cy="22" rx="1" ry="0.7" fill="#1F1A18" />
        </G>
      );
  }
}

export const ANIMAL_KINDS: AnimalKind[] = ['bear', 'panda', 'fox', 'cat', 'owl', 'deer'];

export default AnimalAvatar;
