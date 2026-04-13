import React from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';

interface CircleIconButtonProps {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: (e: GestureResponderEvent) => void;
  iconSize?: number;
}

function CircleIconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  iconSize = 20,
}: CircleIconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
    >
      <Icon size={iconSize} color={colors.textOnLight} />
    </Pressable>
  );
}

export default React.memo(CircleIconButton);

const styles = StyleSheet.create({
  // Photo-overlay rgba value below is an intentional exception — this button
  // is always rendered on top of a hero photo, and a near-opaque white pill
  // is required for legibility across arbitrary imagery (Airbnb/Apple pattern).
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
