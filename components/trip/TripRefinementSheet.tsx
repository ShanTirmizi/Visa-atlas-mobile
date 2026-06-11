import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetScrollView,
  type BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily, Radius, type ThemeColors } from '@/constants/theme';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { Squiggle } from '@/components/ui/Squiggle';
import { RefinementChoiceCard } from './refinement/RefinementChoiceCard';
import { RefinementTextCard } from './refinement/RefinementTextCard';
import {
  mergeUserNotes,
  buildAnswerFragments,
  type AnsweredQuestion,
} from '@/utils/mergeUserNotes';
import { hapticImpact } from '@/utils/haptics';
import type { RefinementQuestion } from '@/convex/tripRefinement';

const STAGGER_MS = 150;
const AFFIRMATION_MS = 800;
// Client-side watchdog on the scheduled analysis. The server settles the
// session row even on LLM failure, so this only fires if the scheduled run
// itself was lost (e.g. a dev redeploy killed it mid-flight).
const ANALYSIS_TIMEOUT_MS = 45_000;

export interface RefinementInput {
  countryCode: string;
  countryName: string;
  duration: number;
  vibes: string[];
  /** Pre-trimmed, non-empty. Caller guarantees this. */
  userNotes: string;
}

export interface TripRefinementSheetHandle {
  present: (input: RefinementInput) => void;
  dismiss: () => void;
}

interface Props {
  /**
   * Called with the merged brief once the user submits the refinement (or
   * immediately, if there are 0 questions, with the original notes after
   * the affirmation animation completes). `answerFragments` are the
   * interpolated answer phrases (empty when no questions were answered) —
   * stored on the trip so the brief readout can render them as chips.
   */
  onSubmit: (mergedNotes: string, answerFragments: string[]) => void;
  /**
   * Called if the user dismisses the sheet via gesture / handle drag without
   * submitting. The planner sheet stays open with the user's notes intact.
   */
  onDismiss: () => void;
}

type Status =
  | 'idle'
  | 'analyzing'
  | 'questions'
  | 'affirmation'
  | 'error';

export const TripRefinementSheet = forwardRef<
  TripRefinementSheetHandle,
  Props
>(function TripRefinementSheet({ onSubmit, onDismiss }, ref) {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const startAnalysis = useMutation(api.tripRefinement.startAnalysis);

  const [input, setInput] = useState<RefinementInput | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [sessionId, setSessionId] = useState<Id<'refinementSessions'> | null>(
    null,
  );
  const [questions, setQuestions] = useState<RefinementQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  // Reactive result of the scheduled analysis. The mutation+subscription
  // shape survives websocket reconnects, token refreshes, and redeploys —
  // unlike the old direct `useAction` call, which died with "Connection
  // lost while action was in flight" whenever the socket blipped mid-call.
  const session = useQuery(
    api.tripRefinement.getSession,
    sessionId ? { sessionId } : 'skip',
  );
  // Tracks whether onSubmit has fired this presentation cycle, so the
  // sheet's onChange→dismiss callback knows not to call onDismiss after a
  // successful submit (we dismiss programmatically before invoking submit).
  const submittedRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      present: (next) => {
        submittedRef.current = false;
        setInput(next);
        setQuestions([]);
        setAnswers({});
        setSessionId(null);
        setStatus('analyzing');
        sheetRef.current?.present();
      },
      dismiss: () => {
        sheetRef.current?.dismiss();
      },
    }),
    [],
  );

  // ── Kick off the analysis when entering the analyzing state ──
  useEffect(() => {
    if (status !== 'analyzing' || !input || sessionId) return;
    let cancelled = false;
    startAnalysis({
      countryCode: input.countryCode,
      countryName: input.countryName,
      duration: input.duration,
      vibes: input.vibes,
      userNotes: input.userNotes,
    })
      .then((id) => {
        if (!cancelled) setSessionId(id);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [status, input, sessionId, startAnalysis]);

  // ── Watch the session row for the analysis result ─────────────
  useEffect(() => {
    if (status !== 'analyzing' || !session) return;
    if (session.status === 'ready') {
      const next = session.questions ?? [];
      if (next.length === 0) {
        setStatus('affirmation');
      } else {
        setQuestions(next);
        setStatus('questions');
      }
    } else if (session.status === 'error') {
      setStatus('error');
    }
  }, [status, session]);

  // ── Watchdog → fallback CTA if no result lands in time ────────
  useEffect(() => {
    if (status !== 'analyzing') return;
    const timer = setTimeout(() => setStatus('error'), ANALYSIS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // ── Affirmation timer → dismiss + submit with original notes ──
  useEffect(() => {
    if (status !== 'affirmation' || !input) return;
    const timer = setTimeout(() => {
      const merged = mergeUserNotes(input.userNotes, []);
      submittedRef.current = true;
      sheetRef.current?.dismiss();
      onSubmit(merged, []);
    }, AFFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [status, input, onSubmit]);

  // ── Questions → submit (build merged brief, dismiss, hand off) ─
  const handleSubmit = useCallback(() => {
    if (!input) return;
    hapticImpact();
    const answered: AnsweredQuestion[] = questions.map((q) => ({
      type: q.type,
      summarizePattern: q.summarizePattern,
      values: answers[q.id] ?? [],
    }));
    const merged = mergeUserNotes(input.userNotes, answered);
    submittedRef.current = true;
    sheetRef.current?.dismiss();
    onSubmit(merged, buildAnswerFragments(answered));
  }, [input, questions, answers, onSubmit]);

  // ── Skip / error fallback (no answers, generate from original) ──
  const handleSkipQuestionsFallback = useCallback(() => {
    if (!input) return;
    const merged = mergeUserNotes(input.userNotes, []);
    submittedRef.current = true;
    sheetRef.current?.dismiss();
    onSubmit(merged, []);
  }, [input, onSubmit]);

  const handleAnswerChange = useCallback(
    (id: string, values: string[]) => {
      setAnswers((prev) => ({ ...prev, [id]: values }));
    },
    [],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      // index === -1 means the sheet is fully closed. If we didn't programmatically
      // dismiss after submit, the user closed it via gesture — bubble that up so
      // the planner sheet can stay open with notes intact.
      if (index === -1 && !submittedRef.current) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  return (
    <AppBottomSheet
      ref={sheetRef}
      backgroundColor={colors.background}
      onChange={handleSheetChange}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Header colors={colors} />

        {status === 'analyzing' && <AnalyzingIndicator colors={colors} />}

        {status === 'questions' && (
          <>
            <QuestionsList
              questions={questions}
              answers={answers}
              onAnswerChange={handleAnswerChange}
            />
            <Footer colors={colors} onSubmit={handleSubmit} />
            {/* Quiet escape hatch — questions are optional, never a gate. */}
            <Pressable
              onPress={handleSkipQuestionsFallback}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 14, padding: 4 }}
            >
              <Text style={[Type.body13, { color: colors.inkMute }]}>
                Skip — plan from my brief as is
              </Text>
            </Pressable>
          </>
        )}

        {status === 'affirmation' && <Affirmation colors={colors} />}

        {status === 'error' && (
          <ErrorCard colors={colors} onFallback={handleSkipQuestionsFallback} />
        )}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});

// ── Subcomponents ────────────────────────────────────────────────

function Header({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.kickerRow}>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 11 * 0.22,
            textTransform: 'uppercase',
            color: colors.coralDeep,
          }}
        >
          A FEW QUESTIONS
        </Text>
        <Squiggle width={26} color={colors.coral} />
      </View>
      <Text style={[Type.title20, { color: colors.ink, marginTop: 4 }]}>
        A few quick things
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Text style={[Type.body14, { color: colors.inkMute, marginTop: 4 }]}>
        Just so we can plan it right.
      </Text>
    </View>
  );
}

function AnalyzingIndicator({ colors }: { colors: ThemeColors }) {
  // Pulsing italic readout — matches the planner sheet's "Starting your trip…" mood.
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.statePad}>
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <Sparkles size={20} color={colors.coral} fill={colors.coral} />
        <Text
          style={[
            Type.title17,
            { color: colors.inkSoft, marginTop: 10, textAlign: 'center' },
          ]}
        >
          Reading your brief
          <Text style={{ color: colors.coral }}>…</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

function Affirmation({ colors }: { colors: ThemeColors }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <View style={styles.statePad}>
      <Animated.View
        style={{ opacity, transform: [{ translateY }], alignItems: 'center' }}
      >
        <Text
          style={[
            Type.title20,
            { color: colors.ink, textAlign: 'center' },
          ]}
        >
          Looks like a clear brief
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
        <Text
          style={[
            Type.body14,
            { color: colors.inkMute, marginTop: 6, textAlign: 'center' },
          ]}
        >
          Planning your trip
          <Text style={{ color: colors.coral }}>…</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

function ErrorCard({
  colors,
  onFallback,
}: {
  colors: ThemeColors;
  onFallback: () => void;
}) {
  return (
    <View
      style={[
        styles.errorCard,
        {
          backgroundColor: colors.dangerBg,
          borderRadius: Radius.md,
        },
      ]}
    >
      <Text
        style={[
          Type.body14,
          { color: colors.danger, marginBottom: 12 },
        ]}
      >
        We couldn{"’"}t load clarifying questions — no problem, we can plan
        straight from your brief.
      </Text>
      <Pressable
        onPress={onFallback}
        style={({ pressed }) => [
          styles.errorCta,
          {
            backgroundColor: colors.ink,
            borderRadius: Radius.md,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontFamily: FontFamily.semibold,
            fontSize: 14,
          }}
        >
          Generate without questions
        </Text>
      </Pressable>
    </View>
  );
}

function QuestionsList({
  questions,
  answers,
  onAnswerChange,
}: {
  questions: RefinementQuestion[];
  answers: Record<string, string[]>;
  onAnswerChange: (id: string, values: string[]) => void;
}) {
  const total = questions.length;
  return (
    <View style={styles.questionsList}>
      {questions.map((q, index) => (
        <StaggeredFadeIn key={q.id} delayMs={index * STAGGER_MS}>
          {q.type === 'choice' ? (
            <RefinementChoiceCard
              prompt={q.prompt}
              options={q.options ?? []}
              multiSelect={q.multiSelect ?? false}
              selected={answers[q.id] ?? []}
              onChange={(values) => onAnswerChange(q.id, values)}
              stepIndex={index + 1}
              stepTotal={total}
            />
          ) : (
            <RefinementTextCard
              prompt={q.prompt}
              placeholder={q.placeholder}
              value={(answers[q.id] ?? [''])[0] ?? ''}
              onChangeText={(text) => onAnswerChange(q.id, [text])}
              stepIndex={index + 1}
              stepTotal={total}
            />
          )}
        </StaggeredFadeIn>
      ))}
    </View>
  );
}

function StaggeredFadeIn({
  children,
  delayMs,
}: {
  children: React.ReactNode;
  delayMs: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delayMs, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function Footer({
  colors,
  onSubmit,
}: {
  colors: ThemeColors;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.footerWrap}>
      <Pressable
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: colors.coral,
            borderColor: colors.coral,
            shadowColor: colors.coral,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: pressed ? 0.2 : 0.35,
            shadowRadius: 16,
            elevation: pressed ? 3 : 6,
            opacity: pressed ? 0.95 : 1,
          },
        ]}
      >
        <Sparkles size={16} color="#FFFFFF" fill="#FFFFFF" />
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: '500',
            letterSpacing: -17 * 0.014,
            // Italic Fraunces descenders need explicit room — the default
            // line box trims the "y" tail ("itinerary" read as "itinerarv").
            lineHeight: 24,
            color: '#FFFFFF',
          }}
        >
          Generate itinerary
          <Text style={{ color: '#FFFFFF', opacity: 0.7 }}>{'  →'}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerWrap: {
    marginBottom: 16,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionsList: {
    gap: 14,
  },
  statePad: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: 16,
    marginVertical: 8,
  },
  errorCta: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerWrap: {
    marginTop: 22,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
});
