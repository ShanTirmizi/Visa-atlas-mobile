# App Store Deployment Guide (EAS + TestFlight)

## Prerequisites

- Apple Developer account ($99/yr) — https://developer.apple.com/enroll
- Expo account — https://expo.dev/signup
- EAS CLI installed: `npm install -g eas-cli`

## Project Config

Your app already has these set in `app.json`:
- **Bundle ID (iOS):** `com.tirmazilabs.visaatlas`
- **Package (Android):** `com.tirmazilabs.visaatlas`
- **Icon:** `./assets/icon.png` (1024x1024, no transparency, no rounded corners)
- **Splash:** `./assets/splash-icon.png` on `#F5D9C0` background

EAS config is in `eas.json` with `development`, `preview`, and `production` profiles.

---

## Step-by-Step: Build + TestFlight

### 1. Log in

```bash
eas login
```

### 2. Build for iOS

```bash
eas build -p ios --profile production
```

EAS will:
- Ask you to log in to your Apple Developer account
- Auto-register the Bundle ID
- Auto-generate certificates and provisioning profiles
- Build the `.ipa` in the cloud (~15-20 min)

When prompted:
- "Uses standard/exempt encryption?" → **Y** (your app only uses HTTPS)

### 3. Submit to TestFlight

```bash
eas submit -p ios --latest
```

EAS will:
- Upload the build to App Store Connect
- Create the app entry if it doesn't exist
- Apple processes it (~10-30 min)

### 4. Invite testers

1. Go to **App Store Connect** → your app → **TestFlight** tab
2. **Internal Testing** (up to 100 people, no Apple review):
   - Add testers by Apple ID email
3. **External Testing** (up to 10,000 people, needs brief Apple review):
   - Create a test group → add testers by email
4. Testers install the **TestFlight** app → tap the invite link → install

---

## Step-by-Step: Production App Store Release

### 1. Build (same as above)

```bash
eas build -p ios --profile production
```

### 2. Submit to App Store (not TestFlight)

```bash
eas submit -p ios --latest
```

### 3. Prepare the listing in App Store Connect

Go to **App Store Connect** → your app → **App Store** tab:

- **Screenshots:** Required sizes: 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208). Minimum 1 per size.
- **Description:** What your app does
- **Keywords:** Comma-separated, 100 char max
- **Support URL:** Required
- **Privacy Policy URL:** Required
- **Category:** Travel
- **Age Rating:** Fill out the questionnaire (likely 4+)

### 4. Submit for review

Click **Submit for Review** in App Store Connect. Apple reviews in 24-48 hours typically.

---

## Android: Build + Google Play

### 1. Build for Android

```bash
eas build -p android --profile production
```

### 2. Submit to Google Play

```bash
eas submit -p android --latest
```

First time requires uploading manually to Google Play Console to create the app entry. After that, EAS can submit directly.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `eas build -p ios --profile production` | Build iOS production binary |
| `eas build -p android --profile production` | Build Android production binary |
| `eas submit -p ios --latest` | Upload latest iOS build to App Store Connect |
| `eas submit -p android --latest` | Upload latest Android build to Google Play |
| `eas build:list` | List all your builds |
| `eas build:view` | View details of a specific build |
| `eas update` | Push an OTA update (JS-only changes, no rebuild needed) |
| `eas credentials` | Manage signing credentials |

## OTA Updates (no rebuild needed)

For JS-only changes (no native module changes), you can push updates instantly without going through the App Store:

```bash
npx expo install expo-updates
eas update --branch production --message "description of changes"
```

Users get the update next time they open the app. No App Store review required.

---

## Troubleshooting

**"Bundle ID not found"** — EAS auto-registers it. If it fails, register manually at https://developer.apple.com/account/resources/identifiers/add/bundleId

**"Missing compliance"** — Add to `app.json` under `ios`:
```json
"infoPlist": {
  "ITSAppUsesNonExemptEncryption": false
}
```

**Build fails** — Check logs at the URL EAS provides. Common issues:
- Missing native modules → run `npx expo prebuild --clean`
- Node version mismatch → check `.nvmrc`

**"Processing" stuck in TestFlight** — Apple processing can take up to 30 min. If stuck longer, check App Store Connect for issues.
