# Booking UI Overhaul + Scan Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the booking bottom sheet and forms with type-specific smart layouts, proper visual hierarchy, and add AI-powered photo scanning to auto-fill booking details from confirmation screenshots.

**Architecture:** Complete rewrite of BookingForm with type-specific sub-forms (FlightForm, HotelForm, etc.) that use smart grouping (route cards, date pickers, pill selectors). New PillSelector reusable component. Scan feature uses expo-image-picker on mobile + Claude vision API on Vercel to extract booking data from photos. Bottom sheet uses white/surface background for modal contrast.

**Tech Stack:** expo-image-picker, @react-native-community/datetimepicker, Anthropic Claude API (vision), existing booking components from Phase 1.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `components/booking/PillSelector.tsx` | **NEW** — Reusable pill selector component (Economy/Business/First, room types, etc.) |
| `components/booking/DateInput.tsx` | **NEW** — Date picker wrapper that shows a formatted date button and opens native picker |
| `components/booking/RouteInput.tsx` | **NEW** — Flight-specific connected departure → arrival input with plane icon |
| `components/booking/ScanBooking.tsx` | **NEW** — Scan button + image picker + loading state + API call |
| `components/booking/BookingForm.tsx` | **REWRITE** — Type-specific form layouts with smart grouping |
| `components/booking/BookingTypePicker.tsx` | **MODIFY** — Add scan booking card, visual refresh |
| `components/booking/AddBookingSheet.tsx` | **MODIFY** — White background, handle scan flow with pre-fill |
| `constants/api.ts` | **MODIFY** — Add scan-booking endpoint |
| `visa-atlas/src/app/api/scan-booking/route.ts` | **NEW** — Vercel API: Claude vision booking extraction |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install date picker and image picker**

Run:
```bash
npx expo install expo-image-picker @react-native-community/datetimepicker
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: add expo-image-picker and datetimepicker dependencies"
```

---

### Task 2: Create PillSelector component

**Files:**
- Create: `components/booking/PillSelector.tsx`

- [ ] **Step 1: Create the component**

Create `components/booking/PillSelector.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface PillSelectorProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor: string;
}

export default function PillSelector({ options, selected, onSelect, accentColor }: PillSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
            style={[
              styles.pill,
              isActive
                ? { backgroundColor: accentColor }
                : { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  pillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/PillSelector.tsx
git commit -m "feat: add PillSelector reusable component"
```

---

### Task 3: Create DateInput component

**Files:**
- Create: `components/booking/DateInput.tsx`

- [ ] **Step 1: Create the component**

Create `components/booking/DateInput.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface DateInputProps {
  label: string;
  value: string; // ISO date string YYYY-MM-DD or ''
  onChange: (dateString: string) => void;
  accentColor: string;
}

export default function DateInput({ label, value, onChange, accentColor }: DateInputProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const dateValue = value ? new Date(value) : new Date();

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      onChange(iso);
      if (Platform.OS === 'ios') {
        setShowPicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowPicker(false);
    }
  };

  const displayValue = value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={[
          styles.button,
          { backgroundColor: colors.surfaceLight, borderColor: colors.border },
        ]}
      >
        <Calendar color={accentColor} size={16} />
        <Text
          style={[
            styles.buttonText,
            { color: value ? colors.foreground : colors.textMuted },
          ]}
        >
          {displayValue || 'Select date'}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          accentColor={accentColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/DateInput.tsx
git commit -m "feat: add DateInput component with native date picker"
```

---

### Task 4: Create RouteInput component

**Files:**
- Create: `components/booking/RouteInput.tsx`

- [ ] **Step 1: Create the component**

Create `components/booking/RouteInput.tsx`:

```tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface RouteInputProps {
  departure: string;
  arrival: string;
  onDepartureChange: (value: string) => void;
  onArrivalChange: (value: string) => void;
  accentColor: string;
}

export default function RouteInput({
  departure,
  arrival,
  onDepartureChange,
  onArrivalChange,
  accentColor,
}: RouteInputProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>ROUTE</Text>
      <View style={styles.routeRow}>
        {/* Departure */}
        <View style={styles.airportBox}>
          <Text style={[styles.airportLabel, { color: colors.textMuted }]}>FROM</Text>
          <TextInput
            style={[styles.airportInput, { color: colors.foreground }]}
            placeholder="LHR"
            placeholderTextColor={colors.textMuted}
            value={departure}
            onChangeText={onDepartureChange}
            autoCapitalize="characters"
            maxLength={4}
          />
        </View>

        {/* Arrow */}
        <View style={[styles.arrowCircle, { backgroundColor: accentColor }]}>
          <Plane color="#FFFFFF" size={16} style={{ transform: [{ rotate: '90deg' }] }} />
        </View>

        {/* Arrival */}
        <View style={styles.airportBox}>
          <Text style={[styles.airportLabel, { color: colors.textMuted }]}>TO</Text>
          <TextInput
            style={[styles.airportInput, { color: colors.foreground }]}
            placeholder="NRT"
            placeholderTextColor={colors.textMuted}
            value={arrival}
            onChangeText={onArrivalChange}
            autoCapitalize="characters"
            maxLength={4}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  airportBox: {
    flex: 1,
    alignItems: 'center',
  },
  airportLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  airportInput: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 2,
    paddingVertical: 4,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/RouteInput.tsx
git commit -m "feat: add RouteInput component for flight departure/arrival"
```

---

### Task 5: Create ScanBooking component

**Files:**
- Create: `components/booking/ScanBooking.tsx`
- Modify: `constants/api.ts`

- [ ] **Step 1: Add scan-booking endpoint to api.ts**

Read `constants/api.ts` and add:
```typescript
  scanBooking: `${API_BASE}/api/scan-booking`,
```

- [ ] **Step 2: Create the scan component**

Create `components/booking/ScanBooking.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ActionSheetIOS, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
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
  const [isScanning, setIsScanning] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', `${useCamera ? 'Camera' : 'Photo library'} access is needed to scan bookings.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setIsScanning(true);
    try {
      const response = await fetch(endpoints.scanBooking, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: result.assets[0].base64 }),
      });

      if (!response.ok) throw new Error('Scan failed');

      const json = await response.json();

      if (!json.success || !json.data) {
        Alert.alert('Could not read booking', 'Try a clearer photo or enter details manually.');
        return;
      }

      onScanComplete(json.data.type, json.data);
    } catch (error: any) {
      Alert.alert('Scan Failed', error.message || 'Something went wrong. Try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage(true);
          if (buttonIndex === 2) pickImage(false);
        }
      );
    } else {
      Alert.alert('Scan Booking', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => pickImage(true) },
        { text: 'Choose from Library', onPress: () => pickImage(false) },
      ]);
    }
  };

  if (isScanning) {
    return (
      <View style={[styles.scanCard, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color="#FFFFFF" size="small" />
        <Text style={styles.scanningText}>Analyzing your booking...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[styles.scanCard, { backgroundColor: colors.primary }, Shadows.glow(colors.primary, 0.3)]}
    >
      <View style={styles.scanIconRow}>
        <Camera color="#FFFFFF" size={22} />
        <ImageIcon color="rgba(255,255,255,0.6)" size={18} />
      </View>
      <View>
        <Text style={styles.scanTitle}>Scan a Confirmation</Text>
        <Text style={styles.scanSubtitle}>Take a photo or choose from gallery</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  scanIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  scanSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  scanningText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/booking/ScanBooking.tsx constants/api.ts
git commit -m "feat: add ScanBooking component with image picker and API call"
```

---

### Task 6: Rewrite BookingForm with type-specific layouts

**Files:**
- Modify: `components/booking/BookingForm.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite the form**

Read the current `components/booking/BookingForm.tsx` fully, then replace its ENTIRE content with a new version that:

1. Keeps the same `BookingFormProps` and `BookingFormData` interfaces
2. Uses `DateInput` instead of text inputs for dates
3. Uses `RouteInput` for flight departure/arrival
4. Uses `PillSelector` for flight class (Economy, Business, First) and hotel room type (Single, Double, Suite)
5. Groups related fields in bordered cards with `colors.surfaceLight` background
6. Uses `colors.surfaceLight` background on all text inputs (not plain white)
7. Has a prominent type-colored submit button with glow when enabled
8. Arranges fields differently per booking type:
   - **Flight**: RouteInput → Airline + Flight Number row → Date picker → Class pills → More details
   - **Hotel**: Hotel name → Check-in/Check-out dates row → Room type pills → Location → More details
   - **Experience**: Activity name → Date + Duration row → Location → Group size → More details
   - **Car rental**: Company → Pickup (date + location card) → Dropoff (date + location card) → Car type pills → More details
   - **Insurance**: Provider → Date range row → Policy number → Coverage → More details
   - **Restaurant**: Name → Date + Time row → Party size → Cuisine → More details
9. "More details" section has: confirmation number, cost + currency row, notes textarea
10. Accept optional `prefillData` prop for scan pre-fill: `prefillData?: Partial<BookingFormData>`

The form should import:
```tsx
import DateInput from './DateInput';
import RouteInput from './RouteInput';
import PillSelector from './PillSelector';
```

Key styling changes:
- All `TextInput` fields: `backgroundColor: colors.surfaceLight`, `borderColor: colors.border`, `borderWidth: 1`, `borderRadius: Radius.md`, `paddingHorizontal: 14`, `paddingVertical: 14`
- Labels: `FontFamily.condensedMedium`, `FontSize.xs`, uppercase, `letterSpacing: 0.5`, `color: colors.textSecondary`, `marginBottom: 6`
- Grouped cards: `backgroundColor: colors.surfaceLight`, `borderWidth: 1`, `borderColor: colors.border`, `borderRadius: Radius.lg`, `padding: Spacing.md`
- Submit button: `backgroundColor: typeColor` (not textMuted when disabled — use `opacity: 0.4` instead), `Shadows.glow(typeColor, 0.3)`, `borderRadius: Radius.md`, `paddingVertical: 16`
- Header: back arrow + type icon in colored circle + "Add {type}" title — same as before but with more spacing

**The `prefillData` prop**: When provided, initialize all form state from it. This is used when scanning pre-fills the form.

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingForm.tsx
git commit -m "feat: rewrite BookingForm with type-specific layouts and smart grouping"
```

---

### Task 7: Update BookingTypePicker with scan card

**Files:**
- Modify: `components/booking/BookingTypePicker.tsx`

- [ ] **Step 1: Add scan card and visual refresh**

Read the current file. Add the import:
```tsx
import ScanBooking from './ScanBooking';
import type { BookingFormData } from './BookingForm';
```

Update the props:
```tsx
interface BookingTypePickerProps {
  onSelect: (type: BookingType) => void;
  onScanComplete: (type: BookingType, data: Partial<BookingFormData>) => void;
}
```

Add `<ScanBooking onScanComplete={onScanComplete} />` BEFORE the title "What are you booking?" and the grid.

Change the tile icon circle background from `typeColor + '18'` to `typeColor + '22'` (slightly more vibrant).

Change the tile label color from `colors.textMuted` to `colors.foreground` for better readability.

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingTypePicker.tsx
git commit -m "feat: add scan booking card and visual refresh to type picker"
```

---

### Task 8: Update AddBookingSheet with white background and scan flow

**Files:**
- Modify: `components/booking/AddBookingSheet.tsx`

- [ ] **Step 1: Read and update the sheet**

Read the full file. Make these changes:

1. Update state to include `prefillData`:
```tsx
const [prefillData, setPrefillData] = useState<Partial<BookingFormData> | undefined>();
```

2. Add `handleScanComplete` callback:
```tsx
const handleScanComplete = useCallback((type: BookingType, data: Partial<BookingFormData>) => {
  setSelectedType(type);
  setPrefillData(data);
  setStep('form');
}, []);
```

3. Update `handleTypeSelect` to clear prefillData:
```tsx
const handleTypeSelect = useCallback((type: BookingType) => {
  setSelectedType(type);
  setPrefillData(undefined);
  setStep('form');
}, []);
```

4. Update `onDismiss` to also clear prefillData.

5. Change the `backgroundStyle` to use `colors.surface` (white) instead of `colors.background` (peach):
```tsx
backgroundStyle={{ backgroundColor: colors.surface }}
```

6. Pass `onScanComplete` to BookingTypePicker:
```tsx
<BookingTypePicker onSelect={handleTypeSelect} onScanComplete={handleScanComplete} />
```

7. Pass `prefillData` to BookingForm:
```tsx
<BookingForm
  type={selectedType}
  onBack={handleBack}
  onSubmit={handleSubmit}
  defaultCountryCode={linkedTrip?.countryCode}
  defaultStartDate={linkedTrip?.startDate}
  defaultEndDate={linkedTrip?.endDate}
  prefillData={prefillData}
/>
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/AddBookingSheet.tsx
git commit -m "feat: update AddBookingSheet with white background and scan pre-fill flow"
```

---

### Task 9: Create scan-booking API endpoint on Vercel

**Files:**
- Create: `visa-atlas/src/app/api/scan-booking/route.ts` (in the visa-atlas web project)

- [ ] **Step 1: Create the API route**

Create the file at `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas/src/app/api/scan-booking/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { image } = (await request.json()) as { image: string };

    if (!image) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `Analyze this booking confirmation image and extract the booking details. Return a JSON object with these fields:

{
  "type": "flight" | "hotel" | "experience" | "car_rental" | "insurance" | "restaurant",
  "title": "descriptive title for the booking",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or empty",
  "location": "city, country or address",
  "confirmationNumber": "booking reference if visible",
  "provider": "company name (airline, hotel chain, etc.)",
  "cost": "numeric amount only, no currency symbol",
  "currency": "3-letter currency code",
  "typeDetails": {
    // For flights: "airline", "flightNumber", "departure" (airport code), "arrival" (airport code), "class"
    // For hotels: "hotelName", "checkIn" (time), "checkOut" (time), "roomType"
    // For restaurants: "name", "time", "partySize", "cuisine"
    // For car rentals: "company", "pickupLocation", "dropoffLocation", "carType"
    // For experiences: "activityName", "duration", "meetingPoint"
    // For insurance: "provider", "policyNumber", "coverage"
  }
}

Return ONLY the JSON object, no markdown or explanation. If you can't determine a field, omit it. Always include at least "type" and "title".`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: "Could not parse booking data" });
    }

    const data = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Scan booking error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to scan booking" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit in the visa-atlas web project**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas
git add src/app/api/scan-booking/route.ts
git commit -m "feat: add scan-booking API endpoint with Claude vision"
```

---

### Task 10: Verify everything compiles and works

**Files:** None (testing only)

- [ ] **Step 1: Run TypeScript check on mobile project**

Run: `npx tsc --noEmit` in the visa-atlas-mobile directory.

Expected: No new errors.

- [ ] **Step 2: Fix any issues**

- [ ] **Step 3: Test the flow**

1. Open app → Trips tab → Bookings → FAB → verify white bottom sheet
2. Verify "Scan a Confirmation" card at the top
3. Tap Flight → verify RouteInput, date picker, class pills
4. Tap Hotel → verify date pickers, room type pills
5. Test scan with a screenshot of a booking confirmation

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: address issues found during booking UI verification"
```
