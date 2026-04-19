import React from 'react';
import { View } from 'react-native';
import { StopRow } from '@/components/ui/StopRow';
import type { PhotoTone } from '@/components/ui/Photo';

export interface Stop {
  title: string;
  meta?: string;
  thumbTone?: PhotoTone;
  thumbUri?: string;
  onPress?: () => void;
}

interface StopListProps {
  stops: Stop[];
}

const TONE_ROTATION: PhotoTone[] = ['forest', 'sunset', 'warm', 'ocean'];

function deterministicTone(index: number, title: string): PhotoTone {
  // Simple hash: sum char codes mod rotation length
  let hash = index;
  for (let i = 0; i < title.length; i++) {
    hash += title.charCodeAt(i);
  }
  return TONE_ROTATION[hash % TONE_ROTATION.length];
}

export function StopList({ stops }: StopListProps) {
  if (stops.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      {stops.map((stop, index) => (
        <StopRow
          key={`stop-${index}-${stop.title}`}
          meta={stop.meta ?? ''}
          title={stop.title}
          thumbTone={stop.thumbTone ?? deterministicTone(index, stop.title)}
          thumbUri={stop.thumbUri}
          onPress={stop.onPress}
        />
      ))}
    </View>
  );
}
