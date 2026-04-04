import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Camera, ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { endpoints } from '@/constants/api';
import type { BookingType } from '@/constants/bookings';
import type { BookingFormData } from './BookingForm';

interface ScanBookingProps {
  onScanComplete: (type: BookingType, data: Partial<BookingFormData>) => void;
}

export default function ScanBooking({ onScanComplete }: ScanBookingProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const processImage = useCallback(
    async (base64String: string) => {
      setLoading(true);
      try {
        const response = await fetch(endpoints.scanBooking, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String }),
        });
        const result = await response.json();

        if (result.success && result.data) {
          onScanComplete(result.data.type, result.data);
        } else {
          Alert.alert('Scan Failed', 'Could not read booking. Please try again or enter details manually.');
        }
      } catch {
        Alert.alert('Scan Failed', 'Could not read booking. Please try again or enter details manually.');
      } finally {
        setLoading(false);
      }
    },
    [onScanComplete],
  );

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to scan bookings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await processImage(result.assets[0].base64);
    }
  }, [processImage]);

  const chooseFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to scan bookings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await processImage(result.assets[0].base64);
    }
  }, [processImage]);

  const handlePress = useCallback(() => {
    if (loading) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          if (buttonIndex === 2) chooseFromLibrary();
        },
      );
    } else {
      Alert.alert('Scan Booking', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: chooseFromLibrary },
      ]);
    }
  }, [loading, takePhoto, chooseFromLibrary]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.card,
        {
          backgroundColor: colors.primary,
          ...Shadows.glow(colors.primary, 0.3),
        },
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.loadingText}>Analyzing your booking...</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.iconGroup}>
            <Camera size={22} color="#FFFFFF" />
            <ImageIcon size={18} color="rgba(255, 255, 255, 0.6)" />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.title}>Scan a Confirmation</Text>
            <Text style={styles.subtitle}>Take a photo or choose from gallery</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: Spacing.md,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
});
