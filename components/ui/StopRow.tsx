import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Photo, PhotoTone } from './Photo';
import { DarkOrb } from './DarkOrb';

interface StopRowProps {
  meta: string; // e.g. "9:00 · 90 min"
  title: string;
  thumbTone?: PhotoTone;
  thumbUri?: string;
  onPress?: () => void;
}

// Spec: 52×52 thumb (radius 14), meta mono-10 inkMute, title Inter 600/14, nav orb 36px muted.
export function StopRow({ meta, title, thumbTone = 'forest', thumbUri, onPress }: StopRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surface,
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Photo
        tone={thumbTone}
        uri={thumbUri}
        radius={14}
        style={{ width: 52, height: 52 }}
        showPlaceholderGlyph={false}
      />
      <View style={{ flex: 1 }}>
        <Text style={[Type.mono10, { color: colors.inkMute }]}>{meta}</Text>
        <Text style={[Type.title14, { color: colors.ink, marginTop: 2 }]}>{title}</Text>
      </View>
      <DarkOrb size={36} muted>
        <ArrowRight size={14} color={colors.ink} strokeWidth={2} />
      </DarkOrb>
    </Pressable>
  );
}
