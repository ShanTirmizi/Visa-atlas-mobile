import React, { Component } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontFamily, LightColors, Shadows } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  /** Optional friendly label for the surface that crashed (e.g. "Trips home"). */
  surfaceLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Class-component error boundary. Renders a premium paper-bg fallback with an
 *  italic Fraunces title, mono kicker, and a "Try again" pill that resets
 *  the boundary. Used at the root layout (catches all routes) and can also be
 *  wrapped around individual screens for finer-grained recovery. */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // No crash-reporting backend is wired up — log the full error, its JS
    // stack, and the React component stack so the crash at least reaches
    // device logs / the Metro console. (Do not claim "the team has been
    // notified" anywhere in the UI: nothing reports remotely.)
    console.error(
      '[ErrorBoundary] Caught error:',
      error.message,
      '\nStack:',
      error.stack ?? '(no stack)',
      '\nComponent stack:',
      errorInfo.componentStack ?? '(no component stack)',
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message =
      this.state.error?.message?.trim() ||
      'Something went wrong. Try again.';

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {this.props.surfaceLabel
              ? `SOMETHING WENT WRONG · ${this.props.surfaceLabel.toUpperCase()}`
              : 'SOMETHING WENT WRONG'}
          </Text>

          <Text style={styles.title}>
            <Text style={styles.titleItalic}>Hmm.</Text>
            <Text style={styles.titlePeriod}>.</Text>
          </Text>

          <Text style={styles.message} numberOfLines={4}>
            {message}
          </Text>

          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [
              styles.retryBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.background,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: LightColors.surface,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LightColors.line,
    ...Shadows.subtle,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    color: LightColors.coralDeep,
    letterSpacing: 10 * 0.22,
    textAlign: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 36,
    fontWeight: '500',
    color: LightColors.ink,
    letterSpacing: -36 * 0.022,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  titlePeriod: {
    color: LightColors.coral,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: LightColors.inkSoft,
    textAlign: 'center',
    marginBottom: 22,
    maxWidth: 320,
  },
  retryBtn: {
    backgroundColor: LightColors.ink,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  retryText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: -14.5 * 0.01,
  },
});
