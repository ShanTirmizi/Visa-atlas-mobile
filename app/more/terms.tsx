import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

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

      <Text style={[styles.title, { color: colors.foreground }]}>
        Terms of Service
      </Text>
      <Text style={[styles.effectiveDate, { color: colors.textMuted }]}>
        Effective April 4, 2026
      </Text>

      {/* 1. Acceptance */}
      <Section title="1. Acceptance of Terms" colors={colors}>
        <P colors={colors}>
          By downloading, installing, or using Visa Atlas, you agree to be
          bound by these Terms of Service and our Privacy Policy. If you do not
          agree to these terms, please do not use the app.
        </P>
      </Section>

      {/* 2. Description of Service */}
      <Section title="2. Description of Service" colors={colors}>
        <P colors={colors}>
          Visa Atlas is a free travel planning application provided by Tirmazi
          Labs. The app offers:
        </P>
        <Bullet colors={colors}>Travel planning tools for managing trips and itineraries</Bullet>
        <Bullet colors={colors}>
          Visa requirement information for destinations around the world
        </Bullet>
        <Bullet colors={colors}>Booking management for flights, hotels, and activities</Bullet>
        <Bullet colors={colors}>Collaborative trip sharing with invited members</Bullet>
        <P colors={colors}>
          The app is provided free of charge. We reserve the right to introduce
          premium features in the future with advance notice.
        </P>
      </Section>

      {/* 3. Your Account */}
      <Section title="3. Your Account" colors={colors}>
        <P colors={colors}>
          To use Visa Atlas, you must create an account. You agree to:
        </P>
        <Bullet colors={colors}>
          Keep your credentials secure and not share access with others
        </Bullet>
        <Bullet colors={colors}>
          Provide accurate and complete information when creating your account
        </Bullet>
        <Bullet colors={colors}>
          Notify us immediately if you suspect unauthorised access to your
          account
        </Bullet>
        <Bullet colors={colors}>
          Not use the app for any unlawful purpose or in violation of these
          terms
        </Bullet>
        <P colors={colors}>
          You are responsible for all activity that occurs under your account.
        </P>
      </Section>

      {/* 4. User Content */}
      <Section title="4. User Content" colors={colors}>
        <P colors={colors}>
          You retain ownership of all content you create in Visa Atlas,
          including trips, bookings, and notes. By using the app, you grant
          Tirmazi Labs a limited licence to store and process your content
          solely to provide the service.
        </P>
        <P colors={colors}>
          When you invite collaborators to a trip, those members will have
          access to view and edit that trip's content. You are responsible for
          managing access to your trips.
        </P>
      </Section>

      {/* 5. Email and Calendar Integration */}
      <Section title="5. Email and Calendar Integration" colors={colors}>
        <P colors={colors}>
          Visa Atlas offers optional integrations with your email and calendar:
        </P>
        <Bullet colors={colors}>
          Email integration scans only travel-related messages (booking
          confirmations, itineraries) to extract booking details
        </Bullet>
        <Bullet colors={colors}>
          Calendar integration reads your calendar events in read-only mode to
          identify travel dates; we never create, modify, or delete calendar
          events
        </Bullet>
        <Bullet colors={colors}>
          Both integrations are entirely optional and can be disconnected at
          any time from the settings screen
        </Bullet>
        <P colors={colors}>
          By enabling these integrations you consent to the described access.
          Withdrawing consent does not affect the lawfulness of processing
          before withdrawal.
        </P>
      </Section>

      {/* 6. Visa Information Disclaimer */}
      <Section title="6. Visa Information Disclaimer" colors={colors}>
        <P colors={colors}>
          The visa and entry requirement information provided in Visa Atlas is
          for general informational purposes only. It is not legal advice and
          may not reflect the most current regulations.
        </P>
        <P colors={colors}>
          You must verify all visa and entry requirements directly with the
          relevant embassies, consulates, or official government sources before
          travelling. Tirmazi Labs is not liable for travel disruptions,
          denied entry, or visa rejections arising from reliance on information
          displayed in the app.
        </P>
      </Section>

      {/* 7. Limitation of Liability */}
      <Section title="7. Limitation of Liability" colors={colors}>
        <P colors={colors}>
          Visa Atlas is provided on an "as is" and "as available" basis without
          any warranties of any kind, express or implied, including but not
          limited to fitness for a particular purpose or uninterrupted
          availability.
        </P>
        <P colors={colors}>
          To the maximum extent permitted by applicable law, Tirmazi Labs shall
          not be liable for any indirect, incidental, special, consequential, or
          punitive damages arising out of or related to your use of the app,
          including loss of data, loss of travel bookings, or costs of
          alternative arrangements.
        </P>
      </Section>

      {/* 8. Account Termination */}
      <Section title="8. Account Termination" colors={colors}>
        <P colors={colors}>
          You may delete your account at any time from the settings screen. Upon
          deletion, your personal data will be permanently removed within 30
          days in accordance with our Privacy Policy.
        </P>
        <P colors={colors}>
          Tirmazi Labs reserves the right to suspend or terminate accounts that
          violate these Terms of Service, engage in abusive behaviour, or pose
          a security risk to the platform or other users.
        </P>
      </Section>

      {/* 9. Changes to Terms */}
      <Section title="9. Changes to These Terms" colors={colors}>
        <P colors={colors}>
          We may update these Terms of Service from time to time. When we make
          material changes, we will notify you within the app before the changes
          take effect. Your continued use of Visa Atlas after the effective date
          of any update constitutes your acceptance of the revised terms.
        </P>
      </Section>

      {/* 10. Governing Law */}
      <Section title="10. Governing Law" colors={colors}>
        <P colors={colors}>
          For users located in the European Union, these terms are governed by
          the laws of the European Union and the member state in which you
          reside. For all other users, these terms are governed by the laws of
          your local jurisdiction.
        </P>
        <P colors={colors}>
          Any disputes arising under these terms shall be resolved through the
          competent courts of the applicable jurisdiction.
        </P>
      </Section>

      {/* 11. Contact */}
      <Section title="11. Contact Us" colors={colors}>
        <P colors={colors}>
          If you have questions about these Terms of Service or need support,
          please contact us at:
        </P>
        <P colors={colors}>shan@tirmizilabs.com</P>
      </Section>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
