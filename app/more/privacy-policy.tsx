import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { Guilloche } from '@/components/ui/Guilloche';

// ── Helper components ────────────────────────────────────────────────────────

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function P({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Text style={[styles.body, { color: colors.textSecondary }]}>
      {children}
    </Text>
  );
}

function Bullet({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: colors.textMuted }]}>{'•'}</Text>
      <Text style={[styles.body, styles.bulletText, { color: colors.textSecondary }]}>
        {children}
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        <Text style={[styles.title, { color: colors.foreground }]}>
          Privacy Policy
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
        <Text style={[styles.effectiveDate, { color: colors.textMuted }]}>
          Effective June 19, 2026
        </Text>

        {/* 1. Who We Are */}
        <Section title="1. Who We Are" colors={colors}>
          <P colors={colors}>
            Tirmazi Labs operates Visa Atlas, a travel planning application that
            helps you manage trips, visa requirements, and bookings. This policy
            explains how we collect, use, and protect your personal data.
          </P>
        </Section>

        {/* 2. Data We Collect */}
        <Section title="2. Data We Collect" colors={colors}>
          <P colors={colors}>We collect the following categories of data:</P>
          <Bullet colors={colors}>Account info — name, email address, and profile image</Bullet>
          <Bullet colors={colors}>Trip data — destinations, dates, and itineraries you create</Bullet>
          <Bullet colors={colors}>Booking data — flights, hotels, and reservations you add</Bullet>
          <Bullet colors={colors}>Visa info — passport details and visa requirements you track</Bullet>
          <Bullet colors={colors}>
            Collaborative content — messages and notes you post in shared trips
          </Bullet>
          <Bullet colors={colors}>Device data — local storage used for offline access and preferences</Bullet>
          <Bullet colors={colors}>
            Usage data: anonymized analytics about how you use the app, covered
            in detail in the Analytics section below
          </Bullet>
        </Section>

        {/* 3. How We Use Your Data */}
        <Section title="3. How We Use Your Data" colors={colors}>
          <P colors={colors}>Your data is used exclusively to provide app features:</P>
          <Bullet colors={colors}>Trip planning — displaying destinations, visa requirements, and logistics</Bullet>
          <Bullet colors={colors}>
            AI-assisted planning — we send the trip details you provide
            (destination, dates, interests) to our AI provider to generate and
            refine itineraries
          </Bullet>
          <Bullet colors={colors}>Collaborative trips — sharing trip access with invited members</Bullet>
          <Bullet colors={colors}>Account verification emails — confirming your account via email</Bullet>
          <P colors={colors}>
            We do not sell your data, use it for advertising, or share it with
            third parties for marketing purposes.
          </P>
        </Section>

        {/* 4. Legal Basis (GDPR) */}
        <Section title="4. Legal Basis (GDPR)" colors={colors}>
          <P colors={colors}>
            For users in the European Union, we process your data under the
            following legal bases:
          </P>
          <Bullet colors={colors}>
            Contract — processing necessary to deliver the app services you
            requested
          </Bullet>
          <Bullet colors={colors}>
            Consent — optional features you choose to enable, which you can
            withdraw at any time from settings
          </Bullet>
          <Bullet colors={colors}>
            Legitimate interest — security measures, fraud prevention, and abuse
            detection
          </Bullet>
        </Section>

        {/* 5. Third-Party Services */}
        <Section title="5. Third-Party Services" colors={colors}>
          <P colors={colors}>Visa Atlas uses the following third-party services:</P>
          <Bullet colors={colors}>
            Convex — our database and backend infrastructure, hosted in the EU
          </Bullet>
          <Bullet colors={colors}>
            Anthropic — our AI provider, which processes the trip details you
            submit to generate itineraries; your data is not used to train their
            models
          </Bullet>
          <Bullet colors={colors}>Apple OAuth — optional sign-in via your Apple ID</Bullet>
          <Bullet colors={colors}>Google OAuth — optional sign-in via your Google account</Bullet>
          <Bullet colors={colors}>
            Resend — transactional email delivery for verification messages
          </Bullet>
          <Bullet colors={colors}>
            PostHog: product analytics that help us understand how the app is
            used so we can improve it. See the Analytics section below for
            exactly what this involves and how to opt out
          </Bullet>
          <P colors={colors}>
            We do not use any advertising networks. We do not sell your data.
          </P>
        </Section>

        {/* 6. Analytics */}
        <Section title="6. Analytics" colors={colors}>
          <P colors={colors}>
            We use PostHog, a third-party product-analytics service, to
            understand how Visa Atlas is used so we can fix problems and improve
            the experience. PostHog collects:
          </P>
          <Bullet colors={colors}>
            Anonymized usage events, for example which screens you view, which
            features you use, and when a trip or day plan is generated
          </Bullet>
          <Bullet colors={colors}>
            Basic device information, such as device model, operating system,
            and app version
          </Bullet>
          <Bullet colors={colors}>
            For signed-in users, an account identifier, with your email and name
            attached as person properties so we can connect events to your
            account
          </Bullet>
          <P colors={colors}>To be clear about what we do not do:</P>
          <Bullet colors={colors}>We do not use advertising networks</Bullet>
          <Bullet colors={colors}>We do not sell your data</Bullet>
          <Bullet colors={colors}>
            We do not use session replay or screen recording
          </Bullet>
          <P colors={colors}>
            You can opt out of analytics at any time from Settings. When you opt
            out, no further usage events are sent from your device.
          </P>
        </Section>

        {/* 7. Collaborative Content & Moderation */}
        <Section title="7. Collaborative Content & Moderation" colors={colors}>
          <P colors={colors}>
            Trips can be shared with people you invite. Messages you post in a
            shared trip are visible to that trip's collaborators. We have zero
            tolerance for objectionable content. You can report any message or
            block any collaborator from within a trip's chat; reported content is
            reviewed within 24 hours and offending users may be removed.
          </P>
        </Section>

        {/* 8. Data Retention */}
        <Section title="8. Data Retention" colors={colors}>
          <P colors={colors}>
            Your data is retained for as long as your account is active. When you
            delete your account, all associated personal data is permanently
            removed from our systems within 30 days. Local data stored on your
            device is cleared when you uninstall the app.
          </P>
        </Section>

        {/* 9. Your Rights */}
        <Section title="9. Your Rights" colors={colors}>
          <P colors={colors}>
            Depending on your location, you may have the following rights:
          </P>
          <Bullet colors={colors}>Access — request an export of all data we hold about you</Bullet>
          <Bullet colors={colors}>Rectification — edit or correct your personal information</Bullet>
          <Bullet colors={colors}>Erasure — delete your account and all associated data</Bullet>
          <Bullet colors={colors}>Portability — receive your data in a machine-readable JSON format</Bullet>
          <Bullet colors={colors}>
            Withdraw consent — disable optional features at any time via settings
          </Bullet>
          <Bullet colors={colors}>
            Lodge a complaint — contact your local data protection authority if
            you believe your rights have been violated
          </Bullet>
        </Section>

        {/* 10. Data Security */}
        <Section title="10. Data Security" colors={colors}>
          <P colors={colors}>
            We protect your data using industry-standard security practices:
          </P>
          <Bullet colors={colors}>All data is transmitted over HTTPS with TLS encryption</Bullet>
          <Bullet colors={colors}>Sensitive data stored on your device uses encrypted local storage</Bullet>
          <Bullet colors={colors}>
            Role-based access control ensures collaborators can only see trips
            they have been invited to
          </Bullet>
        </Section>

        {/* 11. Children */}
        <Section title="11. Children" colors={colors}>
          <P colors={colors}>
            Visa Atlas is not intended for users under the age of 16. We do not
            knowingly collect personal data from children. If you believe a child
            has provided us with personal data, please contact us so we can delete
            it promptly.
          </P>
        </Section>

        {/* 12. Changes */}
        <Section title="12. Changes to This Policy" colors={colors}>
          <P colors={colors}>
            We may update this Privacy Policy from time to time. When we do, we
            will notify you within the app before the changes take effect. Your
            continued use of Visa Atlas after any update constitutes your
            acceptance of the revised policy.
          </P>
        </Section>

        {/* 13. Contact */}
        <Section title="13. Contact Us" colors={colors}>
          <P colors={colors}>
            If you have questions or requests regarding this Privacy Policy or
            your personal data, please contact us at:
          </P>
          <Pressable onPress={() => Linking.openURL('mailto:shan@tirmizilabs.com')}>
            <P colors={colors}>shan@tirmizilabs.com</P>
          </Pressable>
        </Section>
      </ScrollView>

      <TopSafeAreaBlur />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  effectiveDate: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionHeading: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.xs,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  bulletDot: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
  },
});
