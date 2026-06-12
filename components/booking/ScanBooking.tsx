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
import { Camera, ChevronRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { BOOKING_TYPES, type BookingType } from '@/constants/bookings';
import type { BookingFormData } from './BookingForm';

interface ScanBookingProps {
  onScanComplete: (type: BookingType, data: Partial<BookingFormData>) => void;
}

export default function ScanBooking({ onScanComplete }: ScanBookingProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const proxyScanBooking = useAction(api.aiProxy.scanBooking);

  const processImage = useCallback(
    async (base64String: string) => {
      setLoading(true);
      try {
        // Authenticated + rate-limited proxy (convex/aiProxy.ts) — failures
        // reject into the existing catch → 'Scan Failed' alert.
        const result = (await proxyScanBooking({
          body: JSON.stringify({ image: base64String }),
        })) as { success?: boolean; data?: { type?: unknown } & Partial<BookingFormData> };

        // Never trust the server-returned `type` blindly — an unexpected
        // string would crash BookingForm (BOOKING_TYPES[type] lookup).
        // hasOwnProperty rather than `in` so prototype keys can't pass.
        if (
          result.success &&
          result.data &&
          typeof result.data.type === 'string' &&
          Object.prototype.hasOwnProperty.call(BOOKING_TYPES, result.data.type)
        ) {
          onScanComplete(result.data.type as BookingType, result.data as Partial<BookingFormData>);
        } else {
          Alert.alert('Scan Failed', 'Could not read booking. Please try again or enter details manually.');
        }
      } catch {
        Alert.alert('Scan Failed', 'Could not read booking. Please try again or enter details manually.');
      } finally {
        setLoading(false);
      }
    },
    [onScanComplete, proxyScanBooking],
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
      activeOpacity={0.85}
      onPress={handlePress}
      style={[styles.card, { backgroundColor: colors.ink }]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.loadingText}>Analyzing your booking…</Text>
        </View>
      ) : (
        <View style={styles.row}>
          {/* Camera icon in a paper-edged dark square */}
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.solidOverlayFaint },
            ]}
          >
            <Camera size={22} color="#FFFFFF" strokeWidth={1.7} />
          </View>

          <View style={styles.textGroup}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.coral, fontSize: 9, letterSpacing: 9 * 0.18 },
              ]}
            >
              FASTEST
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 17,
                fontWeight: '500',
                color: '#FFFFFF',
                letterSpacing: -17 * 0.012,
                marginTop: 2,
              }}
            >
              Scan a confirmation
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.regular,
                fontSize: 12,
                color: colors.solidTextMuted,
                marginTop: 2,
              }}
            >
              Photo or screenshot — we&apos;ll fill the form.
            </Text>
          </View>

          <ChevronRight size={18} color={colors.solidTextSub} strokeWidth={2} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
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
