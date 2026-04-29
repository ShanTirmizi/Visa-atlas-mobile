/**
 * Thin adapter shim — maps legacy VisaCategory strings to the canonical
 * VisaBadge API in components/ui/Badge.tsx.
 *
 * Prefer importing VisaBadge directly from '@/components/ui/Badge' for new code.
 */
import React from 'react';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import type { VisaCategory } from '@/data/visaData';
import type { StyleProp, ViewStyle } from 'react-native';

interface VisaBadgeProps {
  category: VisaCategory;
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}

function toCat(category: VisaCategory): Cat {
  switch (category) {
    case 'visa-free':
      return 'free';
    case 'visa-on-arrival':
      return 'arrival';
    case 'evisa':
      return 'evisa';
    case 'visa-required':
      return 'required';
    default:
      return 'free';
  }
}

export default function CountryVisaBadge({ category, size = 'md', onDark, style }: VisaBadgeProps) {
  return <VisaBadge cat={toCat(category)} size={size} onDark={onDark} style={style} />;
}
