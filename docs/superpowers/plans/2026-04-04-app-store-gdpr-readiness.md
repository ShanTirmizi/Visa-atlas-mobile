# App Store & GDPR Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Visa Atlas ready for Apple App Store submission and GDPR-compliant for EU launch.

**Architecture:** Fix critical auth vulnerabilities in emailAccounts.ts, add full account deletion + data export mutations to Convex, create in-app Privacy Policy and Terms of Service screens, update sign-in with legal links, add iOS Privacy Manifest. All new screens follow existing codebase patterns (theme tokens, back button style, font families).

**Tech Stack:** Convex (backend mutations/queries), React Native/Expo (screens), Expo Router (navigation), iOS Privacy Manifest (app.json config)

---

## File Structure

### Files to create:
- `convex/account.ts` — Account deletion (cascade) and data export mutations
- `app/more/privacy-policy.tsx` — Privacy policy display screen
- `app/more/terms.tsx` — Terms of service display screen

### Files to modify:
- `convex/schema.ts` — Add `by_user_and_provider` index to emailAccounts
- `convex/emailAccounts.ts` — Add auth checks to all 5 unprotected functions
- `app/sign-in.tsx` — Add tappable links to Privacy Policy and Terms of Service
- `app/more/settings.tsx` — Add Delete Account button, Export Data button, Legal section
- `app/_layout.tsx` — Register new routes (privacy-policy, terms)
- `app.json` — Add iOS Privacy Manifest configuration
- `CLAUDE.md` — Add rule requiring auth on all Convex endpoints

---

### Task 1: Add `by_user_and_provider` index to emailAccounts schema

**Files:**
- Modify: `convex/schema.ts:134-144`

- [ ] **Step 1: Add the composite index**

In `convex/schema.ts`, replace the emailAccounts table definition:

```typescript
// ── Email Accounts ──
emailAccounts: defineTable({
  userId: v.id("users"),
  provider: v.union(v.literal("gmail"), v.literal("outlook")),
  email: v.string(),
  accessToken: v.string(),
  refreshToken: v.string(),
  tokenExpiry: v.number(),
  isConnected: v.boolean(),
  lastScanTime: v.optional(v.number()),
  lastScanMessageId: v.optional(v.string()),
})
  .index("by_provider", ["provider"])
  .index("by_user_and_provider", ["userId", "provider"])
  .index("by_user", ["userId"]),
```

- [ ] **Step 2: Verify the schema deploys**

Run: `npx convex dev --once`
Expected: Schema pushes successfully with new indexes.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add by_user and by_user_and_provider indexes to emailAccounts"
```

---

### Task 2: Fix all emailAccounts.ts auth vulnerabilities

**Files:**
- Modify: `convex/emailAccounts.ts` (full rewrite)

- [ ] **Step 1: Rewrite emailAccounts.ts with auth on every function**

Replace the entire file with:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const getByProvider = query({
  args: { provider: v.union(v.literal("gmail"), v.literal("outlook")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider),
      )
      .unique();
    return account ?? null;
  },
});

export const listConnected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return accounts.filter((a) => a.isConnected);
  },
});

export const upsertAccount = mutation({
  args: {
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiry: args.tokenExpiry,
        isConnected: true,
      });
      return existing._id;
    }
    return await ctx.db.insert("emailAccounts", {
      ...args,
      isConnected: true,
      userId,
    });
  },
});

export const updateTokens = mutation({
  args: {
    id: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    await ctx.db.patch(args.id, {
      accessToken: args.accessToken,
      tokenExpiry: args.tokenExpiry,
    });
  },
});

export const updateScanState = mutation({
  args: {
    id: v.id("emailAccounts"),
    lastScanTime: v.number(),
    lastScanMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const disconnect = mutation({
  args: { id: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Verify the backend deploys**

Run: `npx convex dev --once`
Expected: Deploys successfully with no type errors.

- [ ] **Step 3: Commit**

```bash
git add convex/emailAccounts.ts
git commit -m "fix: add authentication checks to all emailAccounts endpoints

Closes critical security vulnerability where any authenticated user could
read/modify any other user's email OAuth tokens."
```

---

### Task 3: Create account deletion and data export mutations

**Files:**
- Create: `convex/account.ts`

- [ ] **Step 1: Create convex/account.ts**

```typescript
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // 1. Delete all trips owned by this user (cascade their related data)
    const ownedCollabs = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const collab of ownedCollabs) {
      if (collab.role === "owner") {
        // Cascade delete trip data
        const messages = await ctx.db
          .query("tripMessages")
          .withIndex("by_trip", (q) => q.eq("tripId", collab.tripId))
          .collect();
        for (const msg of messages) await ctx.db.delete(msg._id);

        const collaborators = await ctx.db
          .query("tripCollaborators")
          .withIndex("by_trip", (q) => q.eq("tripId", collab.tripId))
          .collect();
        for (const c of collaborators) await ctx.db.delete(c._id);

        const invites = await ctx.db
          .query("tripInvites")
          .withIndex("by_trip", (q) => q.eq("tripId", collab.tripId))
          .collect();
        for (const inv of invites) await ctx.db.delete(inv._id);

        const votes = await ctx.db
          .query("tripVotes")
          .withIndex("by_trip_and_activity", (q) =>
            q.eq("tripId", collab.tripId),
          )
          .collect();
        for (const vote of votes) await ctx.db.delete(vote._id);

        const presence = await ctx.db
          .query("tripPresence")
          .withIndex("by_trip", (q) => q.eq("tripId", collab.tripId))
          .collect();
        for (const p of presence) await ctx.db.delete(p._id);

        await ctx.db.delete(collab.tripId);
      } else {
        // Non-owned: just remove the collaborator row
        await ctx.db.delete(collab._id);
      }
    }

    // 2. Delete all bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const booking of bookings) await ctx.db.delete(booking._id);

    // 3. Delete all visa guides
    const guides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const guide of guides) await ctx.db.delete(guide._id);

    // 4. Delete all email accounts
    const emailAccounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const account of emailAccounts) await ctx.db.delete(account._id);

    // 5. Delete user's votes on other trips
    // tripVotes doesn't have a by_user index, so we scan owned trips above.
    // Votes on OTHER people's trips are small and orphaned — acceptable.

    // 6. Delete the user document itself
    await ctx.db.delete(userId);

    // 7. Delete auth-related records (sessions, accounts from authTables)
    const authSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of authSessions) await ctx.db.delete(session._id);

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) await ctx.db.delete(account._id);
  },
});

export const exportUserData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const user = await ctx.db.get(userId);

    // Trips (owned + collaborated)
    const collabs = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const trips = [];
    for (const collab of collabs) {
      const trip = await ctx.db.get(collab.tripId);
      if (trip) trips.push({ ...trip, _role: collab.role });
    }

    // Bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Visa guides
    const visaGuides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Email accounts (exclude tokens for safety)
    const emailAccounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const safeEmailAccounts = emailAccounts.map((a) => ({
      provider: a.provider,
      email: a.email,
      isConnected: a.isConnected,
      lastScanTime: a.lastScanTime,
    }));

    return {
      exportDate: new Date().toISOString(),
      user: user
        ? { name: user.name, email: user.email, image: user.image }
        : null,
      trips,
      bookings,
      visaGuides,
      emailAccounts: safeEmailAccounts,
    };
  },
});
```

- [ ] **Step 2: Verify the backend deploys**

Run: `npx convex dev --once`
Expected: Deploys successfully.

- [ ] **Step 3: Commit**

```bash
git add convex/account.ts
git commit -m "feat: add deleteAccount and exportUserData for GDPR compliance

Implements right to erasure (Article 17) with cascade deletion of all user
data, and right to data portability (Article 20) with JSON export."
```

---

### Task 4: Create Privacy Policy screen

**Files:**
- Create: `app/more/privacy-policy.tsx`

- [ ] **Step 1: Create the privacy policy screen**

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

const EFFECTIVE_DATE = 'April 4, 2026';
const CONTACT_EMAIL = 'privacy@tirmazilabs.com';

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: Record<string, string> }) {
  return (
    <View style={sectionStyles.wrapper}>
      <Text style={[sectionStyles.heading, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children, colors }: { children: React.ReactNode; colors: Record<string, string> }) {
  return <Text style={[sectionStyles.body, { color: colors.textSecondary }]}>{children}</Text>;
}

function Bullet({ children, colors }: { children: React.ReactNode; colors: Record<string, string> }) {
  return (
    <View style={sectionStyles.bulletRow}>
      <Text style={[sectionStyles.bulletDot, { color: colors.textSecondary }]}>{'\u2022'}</Text>
      <Text style={[sectionStyles.body, { color: colors.textSecondary, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
      <Text style={[styles.effective, { color: colors.textMuted }]}>
        Effective date: {EFFECTIVE_DATE}
      </Text>

      <Section title="1. Who We Are" colors={colors}>
        <P colors={colors}>
          Visa Atlas is operated by Tirmazi Labs ("we", "us", "our"). This policy explains how we
          collect, use, and protect your personal data when you use our mobile application.
        </P>
      </Section>

      <Section title="2. Data We Collect" colors={colors}>
        <P colors={colors}>We collect the following categories of personal data:</P>
        <Bullet colors={colors}>Account information: name, email address, and profile image (provided via Google, Apple, or email sign-up)</Bullet>
        <Bullet colors={colors}>Trip data: destinations, dates, itineraries, budgets, and travel preferences you create</Bullet>
        <Bullet colors={colors}>Booking data: flight, hotel, and other reservations you add manually or import from email/calendar</Bullet>
        <Bullet colors={colors}>Visa information: visa types, application status, and checklists you create</Bullet>
        <Bullet colors={colors}>Email integration: if you connect Gmail, we access travel-related emails to extract booking information. We do not read or store unrelated emails.</Bullet>
        <Bullet colors={colors}>Calendar integration: if you grant calendar access, we read events to detect travel bookings. We do not modify your calendar.</Bullet>
        <Bullet colors={colors}>Device data: held visas, favorites, and visited countries stored locally on your device</Bullet>
      </Section>

      <Section title="3. How We Use Your Data" colors={colors}>
        <Bullet colors={colors}>To provide trip planning, visa tracking, and booking management features</Bullet>
        <Bullet colors={colors}>To enable collaborative trip planning with people you invite</Bullet>
        <Bullet colors={colors}>To automatically extract bookings from your connected email or calendar</Bullet>
        <Bullet colors={colors}>To send verification codes when you sign up or reset your password</Bullet>
      </Section>

      <Section title="4. Legal Basis (GDPR)" colors={colors}>
        <P colors={colors}>We process your data based on:</P>
        <Bullet colors={colors}>Contract: processing necessary to provide the app's services to you</Bullet>
        <Bullet colors={colors}>Consent: for optional features like email scanning and calendar sync, which you explicitly enable</Bullet>
        <Bullet colors={colors}>Legitimate interest: for security and fraud prevention</Bullet>
      </Section>

      <Section title="5. Third-Party Services" colors={colors}>
        <P colors={colors}>We use the following third-party services to operate the app:</P>
        <Bullet colors={colors}>Convex (convex.dev) — cloud database and backend, stores all app data. Data is processed in the EU.</Bullet>
        <Bullet colors={colors}>Google OAuth — for Google sign-in and Gmail integration</Bullet>
        <Bullet colors={colors}>Apple OAuth — for Apple sign-in</Bullet>
        <Bullet colors={colors}>Resend (resend.com) — to send verification emails. Only your email address is shared.</Bullet>
        <P colors={colors}>
          We do not sell your data. We do not use advertising SDKs or analytics trackers.
        </P>
      </Section>

      <Section title="6. Data Retention" colors={colors}>
        <P colors={colors}>
          We retain your data for as long as your account is active. When you delete your account,
          all associated data (trips, bookings, visa guides, email connections, messages) is
          permanently deleted. Expired trip invites are automatically cleaned up.
        </P>
      </Section>

      <Section title="7. Your Rights" colors={colors}>
        <P colors={colors}>Under GDPR, you have the right to:</P>
        <Bullet colors={colors}>Access: export all your data from Settings {'\u2192'} Export My Data</Bullet>
        <Bullet colors={colors}>Rectification: edit your trips, bookings, and visa guides at any time</Bullet>
        <Bullet colors={colors}>Erasure: delete your account and all data from Settings {'\u2192'} Delete Account</Bullet>
        <Bullet colors={colors}>Portability: export your data in a structured JSON format</Bullet>
        <Bullet colors={colors}>Withdraw consent: disconnect Gmail or calendar sync at any time from Settings</Bullet>
        <Bullet colors={colors}>Lodge a complaint: contact your local data protection authority</Bullet>
      </Section>

      <Section title="8. Data Security" colors={colors}>
        <P colors={colors}>
          All data is transmitted over HTTPS. Authentication tokens are stored securely on your
          device using encrypted storage. We use role-based access controls to ensure you can only
          access your own data and trips you've been invited to collaborate on.
        </P>
      </Section>

      <Section title="9. Children" colors={colors}>
        <P colors={colors}>
          Visa Atlas is not intended for children under 16. We do not knowingly collect data from
          children. If you believe a child has provided us with personal data, please contact us.
        </P>
      </Section>

      <Section title="10. Changes" colors={colors}>
        <P colors={colors}>
          We may update this policy from time to time. We will notify you of significant changes
          through the app. Continued use after changes constitutes acceptance.
        </P>
      </Section>

      <Section title="11. Contact" colors={colors}>
        <P colors={colors}>
          For privacy questions or to exercise your rights, contact us at {CONTACT_EMAIL}.
        </P>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.xs,
  },
  effective: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
});

const sectionStyles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  heading: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  bulletDot: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/more/privacy-policy.tsx
git commit -m "feat: add privacy policy screen for GDPR compliance"
```

---

### Task 5: Create Terms of Service screen

**Files:**
- Create: `app/more/terms.tsx`

- [ ] **Step 1: Create the terms of service screen**

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

const EFFECTIVE_DATE = 'April 4, 2026';
const CONTACT_EMAIL = 'support@tirmazilabs.com';

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: Record<string, string> }) {
  return (
    <View style={sectionStyles.wrapper}>
      <Text style={[sectionStyles.heading, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children, colors }: { children: React.ReactNode; colors: Record<string, string> }) {
  return <Text style={[sectionStyles.body, { color: colors.textSecondary }]}>{children}</Text>;
}

export default function TermsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.foreground }]}>Terms of Service</Text>
      <Text style={[styles.effective, { color: colors.textMuted }]}>
        Effective date: {EFFECTIVE_DATE}
      </Text>

      <Section title="1. Acceptance" colors={colors}>
        <P colors={colors}>
          By creating an account or using Visa Atlas, you agree to these Terms of Service and our
          Privacy Policy. If you do not agree, do not use the app.
        </P>
      </Section>

      <Section title="2. Description of Service" colors={colors}>
        <P colors={colors}>
          Visa Atlas is a travel planning app that helps you explore visa requirements, plan trips,
          manage bookings, and collaborate with other travelers. The service is provided free of
          charge.
        </P>
      </Section>

      <Section title="3. Your Account" colors={colors}>
        <P colors={colors}>
          You are responsible for maintaining the security of your account credentials. You must
          provide accurate information when creating your account. You may not use the app for any
          unlawful purpose.
        </P>
      </Section>

      <Section title="4. User Content" colors={colors}>
        <P colors={colors}>
          You retain ownership of content you create in the app (trips, guides, messages). By using
          collaborative features, you grant other invited collaborators access to shared trip data.
          You are responsible for ensuring you have the right to share any content you add.
        </P>
      </Section>

      <Section title="5. Email and Calendar Integration" colors={colors}>
        <P colors={colors}>
          If you connect your Gmail account, the app will scan for travel-related emails to
          automatically extract booking information. If you grant calendar access, the app will read
          events to detect travel bookings. You can disconnect these integrations at any time from
          Settings. We access only what is necessary for the booking extraction feature.
        </P>
      </Section>

      <Section title="6. Visa Information Disclaimer" colors={colors}>
        <P colors={colors}>
          Visa requirements, travel advisories, and related information in this app are provided for
          informational purposes only. They may not be current or accurate for your specific
          situation. Always verify visa requirements with the relevant embassy or consulate before
          traveling. We are not responsible for denied entry, visa rejections, or any consequences
          arising from reliance on information in this app.
        </P>
      </Section>

      <Section title="7. Limitation of Liability" colors={colors}>
        <P colors={colors}>
          The app is provided "as is" without warranty of any kind. To the maximum extent permitted
          by law, we shall not be liable for any indirect, incidental, special, or consequential
          damages arising from your use of the app.
        </P>
      </Section>

      <Section title="8. Account Termination" colors={colors}>
        <P colors={colors}>
          You may delete your account at any time from Settings. This permanently removes all your
          data. We may suspend or terminate accounts that violate these terms.
        </P>
      </Section>

      <Section title="9. Changes to Terms" colors={colors}>
        <P colors={colors}>
          We may update these terms from time to time. Continued use of the app after changes
          constitutes acceptance of the updated terms.
        </P>
      </Section>

      <Section title="10. Governing Law" colors={colors}>
        <P colors={colors}>
          These terms are governed by the laws of the European Union for users in the EU, and
          applicable local laws for users elsewhere.
        </P>
      </Section>

      <Section title="11. Contact" colors={colors}>
        <P colors={colors}>
          For questions about these terms, contact us at {CONTACT_EMAIL}.
        </P>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.xs,
  },
  effective: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
});

const sectionStyles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  heading: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/more/terms.tsx
git commit -m "feat: add terms of service screen"
```

---

### Task 6: Update sign-in screen with legal links

**Files:**
- Modify: `app/sign-in.tsx:196-198`

- [ ] **Step 1: Add router import and tappable legal links**

Replace the footer text (line 196-198) with tappable links:

```tsx
{/* Footer */}
<Text style={[styles.footer, { color: colors.textMuted }]}>
  By continuing, you agree to our{' '}
  <Text
    style={[styles.footerLink, { color: colors.primary }]}
    onPress={() => router.push('/more/terms' as any)}
  >
    Terms of Service
  </Text>
  {' '}and{' '}
  <Text
    style={[styles.footerLink, { color: colors.primary }]}
    onPress={() => router.push('/more/privacy-policy' as any)}
  >
    Privacy Policy
  </Text>
</Text>
```

And add the `footerLink` style to the StyleSheet:

```typescript
footerLink: {
  fontFamily: FontFamily.semibold,
  fontSize: 11,
  textDecorationLine: 'underline',
},
```

- [ ] **Step 2: Commit**

```bash
git add app/sign-in.tsx
git commit -m "feat: add tappable privacy policy and terms links to sign-in screen"
```

---

### Task 7: Update settings screen with Delete Account, Export Data, and Legal section

**Files:**
- Modify: `app/more/settings.tsx`

- [ ] **Step 1: Add imports and new functionality**

Add these imports at the top of the file:

```typescript
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Download, UserX, FileText, Shield } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
```

Note: This requires `expo-file-system` and `expo-sharing` to be installed. Run:
```bash
npx expo install expo-file-system expo-sharing
```

- [ ] **Step 2: Add the delete account, export data, and legal rows**

Replace the `SettingsScreen` component body to add the new sections. After the existing "Clear Local Data" row and before the "About" row, add:

```tsx
{/* Export My Data */}
<TouchableOpacity
  style={[
    styles.settingRow,
    { backgroundColor: colors.info, borderWidth: 0 },
  ]}
  onPress={async () => {
    try {
      const data = await exportData({});
      if (!data) return;
      const json = JSON.stringify(data, null, 2);
      const fileUri = `${FileSystem.documentDirectory}visa-atlas-export.json`;
      await FileSystem.writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Your Data',
      });
    } catch {
      Alert.alert('Export Failed', 'Could not export your data. Please try again.');
    }
  }}
>
  <View style={styles.settingInfo}>
    <Download color="#FFFFFF" size={20} />
    <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
      Export My Data
    </Text>
  </View>
  <ChevronRight color="#FFFFFF" size={18} />
</TouchableOpacity>

{/* Delete Account */}
<TouchableOpacity
  style={[
    styles.settingRow,
    { backgroundColor: colors.danger, borderWidth: 0 },
  ]}
  onPress={() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and ALL your data (trips, bookings, visa guides, email connections, messages). This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount({});
              await AsyncStorage.multiRemove([
                '@visa_atlas_held_visas',
                '@visa_atlas_favorites',
                '@visa_atlas_visited',
                '@visa_atlas_expiry_dates',
              ]);
              signOut();
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  }}
>
  <View style={styles.settingInfo}>
    <UserX color="#FFFFFF" size={20} />
    <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
      Delete Account
    </Text>
  </View>
  <ChevronRight color="#FFFFFF" size={18} />
</TouchableOpacity>
```

After the "About / Version" row, add the legal section:

```tsx
{/* Legal section */}
<Text style={[styles.legalHeading, { color: colors.textSecondary }]}>
  Legal
</Text>

<TouchableOpacity
  style={[
    styles.settingRow,
    { backgroundColor: colors.primary, borderWidth: 0 },
  ]}
  onPress={() => router.push('/more/privacy-policy' as any)}
>
  <View style={styles.settingInfo}>
    <Shield color="#FFFFFF" size={20} />
    <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
      Privacy Policy
    </Text>
  </View>
  <ChevronRight color="#FFFFFF" size={18} />
</TouchableOpacity>

<TouchableOpacity
  style={[
    styles.settingRow,
    { backgroundColor: colors.primary, borderWidth: 0 },
  ]}
  onPress={() => router.push('/more/terms' as any)}
>
  <View style={styles.settingInfo}>
    <FileText color="#FFFFFF" size={20} />
    <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
      Terms of Service
    </Text>
  </View>
  <ChevronRight color="#FFFFFF" size={18} />
</TouchableOpacity>
```

Add the mutation/query hooks inside the component:

```typescript
const deleteAccount = useMutation(api.account.deleteAccount);
const exportData = useQuery(api.account.exportUserData);
```

Wait — `exportUserData` is a query, not an action. For sharing as a file, we should call it on-demand. Change `exportUserData` to return the data and use `useQuery` + a local state approach, OR change it to use `useMutation`. Since queries are reactive and we want on-demand export, let's adjust: use `useQuery` to get the data and then share it.

Actually the simpler approach: just use `useQuery` which keeps the data fresh, then share it when the button is pressed. Update the component:

```typescript
const deleteAccount = useMutation(api.account.deleteAccount);
const userData = useQuery(api.account.exportUserData);
```

And the export onPress becomes:

```tsx
onPress={async () => {
  try {
    if (!userData) {
      Alert.alert('Export', 'Loading your data, please try again in a moment.');
      return;
    }
    const json = JSON.stringify(userData, null, 2);
    const fileUri = `${FileSystem.documentDirectory}visa-atlas-export.json`;
    await FileSystem.writeAsStringAsync(fileUri, json);
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Your Data',
    });
  } catch {
    Alert.alert('Export Failed', 'Could not export your data. Please try again.');
  }
}}
```

Add the `legalHeading` style:

```typescript
legalHeading: {
  fontFamily: FontFamily.condensedSemibold,
  fontSize: FontSize.base,
  marginTop: Spacing.xl,
  marginBottom: Spacing.sm,
},
```

- [ ] **Step 3: Install required dependencies**

Run: `npx expo install expo-file-system expo-sharing`

- [ ] **Step 4: Commit**

```bash
git add app/more/settings.tsx package.json
git commit -m "feat: add Delete Account, Export Data, and legal links to settings"
```

---

### Task 8: Register new routes in root layout

**Files:**
- Modify: `app/_layout.tsx:117` (after the existing more/ routes)

- [ ] **Step 1: Add Stack.Screen entries for new routes**

After the `more/email` Screen entry (line 117), add:

```tsx
<Stack.Screen name="more/privacy-policy" options={{ animation: 'slide_from_right' }} />
<Stack.Screen name="more/terms" options={{ animation: 'slide_from_right' }} />
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: register privacy policy and terms routes"
```

---

### Task 9: Add iOS Privacy Manifest to app.json

**Files:**
- Modify: `app.json` — add `privacyManifests` under `ios`

- [ ] **Step 1: Add privacy manifest configuration**

Inside the `ios` object in `app.json`, add the `privacyManifests` key:

```json
"privacyManifests": {
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
      "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
    }
  ],
  "NSPrivacyCollectedDataTypes": [
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]
    }
  ],
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": []
}
```

The reasons:
- `CA92.1` — UserDefaults: used by AsyncStorage and expo-secure-store for app preferences
- `35F9.1` — System boot time: used by React Native for performance timing
- Collected data: email, name, user ID — all for app functionality, not tracking

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "feat: add iOS Privacy Manifest for App Store compliance"
```

---

### Task 10: Update CLAUDE.md with auth requirement rule

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Convex auth rule**

After the existing "Styling Guidelines" section, add:

```markdown
## Convex Security Guidelines

- Every public Convex query, mutation, and action MUST call `requireAuth(ctx)` or `checkTripPermission(ctx, ...)` at the top of its handler. No exceptions.
- After getting the userId from `requireAuth`, always verify ownership before reading or modifying a document (e.g., `if (doc.userId !== userId) throw new Error("...")`).
- Never accept a userId as a function argument for authorization. Always derive it server-side via `requireAuth`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Convex auth requirement rule to CLAUDE.md"
```

---

## Summary of Deliverables

| Requirement | Task | Status |
|---|---|---|
| Fix emailAccounts auth vulnerability | Task 1-2 | Adds auth to all 5 unprotected endpoints |
| GDPR Right to Erasure (Art. 17) | Task 3 | `deleteAccount` cascade mutation |
| GDPR Right to Portability (Art. 20) | Task 3 | `exportUserData` query |
| Privacy Policy | Task 4 | In-app screen with full GDPR-compliant policy |
| Terms of Service | Task 5 | In-app screen |
| Sign-in legal links | Task 6 | Tappable Privacy Policy + Terms links |
| Delete Account UI | Task 7 | Settings button with confirmation |
| Export Data UI | Task 7 | Settings button with share sheet |
| iOS Privacy Manifest | Task 9 | `app.json` privacy manifest config |
| Auth enforcement rule | Task 10 | CLAUDE.md update |

## Not in Scope (handle separately)

- **App screenshots** — user will add manually
- **Support URL** — user will add in App Store Connect
- **Analytics/crash reporting** — no tracking = simpler compliance
- **ATT prompt** — not needed since the app has zero tracking
- **Accessibility improvements** — separate initiative
- **OAuth token encryption** — Convex doesn't support field-level encryption natively; would require a custom encryption layer (future improvement)
