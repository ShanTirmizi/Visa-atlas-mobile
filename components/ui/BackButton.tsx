import React from 'react';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { CircleBtn } from './CircleBtn';

interface BackButtonProps {
  onPress?: () => void;
  size?: number;
  solid?: boolean;
}

export function BackButton({ onPress, size = 38, solid = true }: BackButtonProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const handle = onPress ?? (() => router.back());
  return (
    <CircleBtn size={size} solid={solid} onPress={handle} accessibilityLabel="Back">
      <ChevronLeft size={18} color={colors.ink} strokeWidth={2} />
    </CircleBtn>
  );
}

export default BackButton;
