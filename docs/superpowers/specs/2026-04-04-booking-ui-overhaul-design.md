# Booking UI Overhaul + Scan Booking Design

> Redesign the booking bottom sheet and forms to match the app's vibrant design language, and add AI-powered booking scan from photos/screenshots.

## Overview

The current booking form is a wall of identical white inputs on a peach background with no visual hierarchy, no contrast, and no smart grouping. This redesign fixes the visual issues and adds a "Scan Booking" feature that uses Claude's vision API to auto-fill booking details from a photo of a confirmation email, boarding pass, or reservation page.

## Part A: UI Overhaul

### Bottom Sheet
- Background: `colors.surface` (white in light mode, elevated dark in dark mode) — NOT the app's peach background
- Visible shadow on the sheet edge for clear modal separation
- Handle indicator styled with `colors.textMuted`

### Type Picker Screen (BookingTypePicker)
- Add "Scan Booking" as the first option — a prominent card with camera icon, spanning full width above the 2x3 grid
- Scan card: type-colored gradient or primary color background, Camera icon + "Scan a confirmation" text, white on color
- Existing 6 type tiles get slightly larger icons and more vibrant colored backgrounds (use the type's color at 20% opacity instead of 18%)

### Form Redesign (BookingForm)

**General principles:**
- Inputs use `colors.surfaceLight` background with 1px `colors.border` border (not plain white)
- Related fields grouped in bordered cards with subtle background
- Date inputs replaced with proper date pickers (using `@react-native-community/datetimepicker` or Expo DateTimePicker)
- Where there are limited options (class, room type), use pill selectors instead of text inputs
- Submit button uses the booking type's accent color with glow shadow, full opacity when enabled
- Reduce total visible fields — hide non-essential fields behind "More details" by default

**Flight form layout:**
1. Route card (bordered, slight background):
   - Two airport code input boxes side by side with a Plane icon + arrow between them
   - Departure (left) → Arrival (right), connected visual
2. Flight details row: Airline + Flight Number side by side
3. Date picker: single date picker for departure date
4. Class: pill selector — Economy | Business | First
5. More details (expandable): confirmation number, cost, notes

**Hotel form layout:**
1. Hotel name — large, prominent input
2. Date card: Check-in and Check-out as date pickers side by side with Calendar icon
3. Room type: pill selector — Single | Double | Suite | Studio
4. Location input
5. More details: confirmation number, cost, guests, notes

**Experience form layout:**
1. Activity name — large input
2. Date picker + duration side by side
3. Location / meeting point
4. Group size: numeric stepper or small input
5. More details: confirmation number, cost, notes

**Car rental form layout:**
1. Company — prominent input
2. Pickup card: date picker + location grouped
3. Dropoff card: date picker + location grouped
4. Car type: pill selector — Compact | SUV | Sedan | Van
5. More details: confirmation number, cost, notes

**Insurance form layout:**
1. Provider — prominent input
2. Date range: start/end date pickers
3. Policy number input
4. Coverage type input
5. More details: cost, travelers, notes

**Restaurant form layout:**
1. Restaurant name — large input
2. Date + time: date picker and time picker side by side
3. Party size: numeric stepper
4. Cuisine: text input
5. More details: confirmation number, notes

### Input Styling
- Background: `colors.surfaceLight` (warm light) instead of pure white
- Border: 1px `colors.border`
- Border radius: `Radius.md` (14px)
- Padding: 14px horizontal, 14px vertical
- Font: `FontFamily.regular`, `FontSize.base`
- Placeholder: `colors.textMuted`
- Label: integrated as floating label or positioned above with `FontFamily.condensedMedium`, `FontSize.xs`, uppercase

### Pill Selector Component
- Horizontal row of pills
- Active: booking type color background, white text
- Inactive: `colors.surface` background, `colors.textMuted` text, 1px border
- Font: `FontFamily.condensedMedium`, `FontSize.xs`, uppercase
- Border radius: `Radius.full`
- Consistent with existing sort pills pattern on trips screen

## Part B: Scan Booking

### Flow
1. User taps "Scan Booking" on the type picker screen
2. Action sheet: "Take Photo" | "Choose from Library" | "Cancel"
3. User captures or selects image (via expo-image-picker)
4. Loading state: "Analyzing your booking..." with spinner
5. Image sent as base64 to `visa-atlas.vercel.app/api/scan-booking`
6. API uses Claude vision to extract booking details
7. Response includes: detected booking type + all extractable fields
8. App auto-opens the correct form (e.g. flight form) with all fields pre-filled
9. User reviews, edits if needed, taps Save

### API Endpoint (`/api/scan-booking` on Vercel)
- Method: POST
- Body: `{ image: string }` (base64 encoded image)
- Uses Claude vision (Anthropic API) with a structured extraction prompt
- Prompt asks for: bookingType, title, startDate, endDate, location, countryCode, confirmationNumber, provider, cost, currency, and type-specific details
- Returns: `{ success: boolean, data: BookingFormData & { type: BookingType } }` or `{ success: false, error: string }`
- Graceful degradation: returns partial data if not everything is extractable

### Mobile Implementation
- Install `expo-image-picker` for camera/library access
- Convert selected image to base64
- Show loading state on the type picker screen while scanning
- On success: navigate to the pre-filled form for the detected type
- On failure: show toast error, let user pick type manually

### What It Can Scan
- Email confirmation screenshots
- Boarding passes (photo or screenshot)
- Hotel reservation confirmations
- Restaurant booking confirmations
- Any booking-related document with visible text

## Dependencies
- `expo-image-picker` — camera/library access (new install)
- `@react-native-community/datetimepicker` or Expo's built-in DateTimePicker — for date/time pickers (new install)
- Anthropic API on Vercel (already used for trip generation)

## Files Changed
- `components/booking/BookingTypePicker.tsx` — add scan option, visual refresh
- `components/booking/BookingForm.tsx` — complete rewrite with type-specific layouts
- `components/booking/AddBookingSheet.tsx` — update background color, handle scan flow
- `components/booking/PillSelector.tsx` — new reusable component
- `visa-atlas/src/app/api/scan-booking/route.ts` — new API endpoint (Vercel project)
- `constants/api.ts` — add scan-booking endpoint
