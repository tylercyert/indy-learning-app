import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_COMPANION, SlideV1Schema, type ComponentResultV1 } from '../../src/contracts';
import { scoreFillBlank, scoreMatchPairs } from '../../src/domain/scoring';
import type { FillBlankFeedback } from '../../src/features/components/FillBlank';
import type { MatchPairsFeedback } from '../../src/features/components/MatchPairs';
import type { ChoiceFeedback } from '../../src/features/components/MultipleChoice';
import { SlideView } from '../../src/features/components/SlideView';
import { colors, fonts } from '../../src/features/theme';
import { CONTENT_MAX_WIDTH } from '../../src/features/ui/Screen';

/**
 * QA harness: renders one slide from JSON in the URL, with no server and no model.
 *   /dev/slide?doc=<urlencoded SlideV1 JSON>
 * Used by qa/render-slide.ts to screenshot stress fixtures (long labels, dense diagrams, 5-segment
 * ratios) across viewports. Validation errors are shown instead of the slide. Interactions are local.
 */
export default function DevSlideScreen() {
  const params = useLocalSearchParams<{ doc?: string }>();
  // Large fixtures travel in the hash (never sent to the server, so no header-size limit).
  const hashDoc = typeof window !== 'undefined' && window.location?.hash.startsWith('#doc=') ? decodeURIComponent(window.location.hash.slice(5)) : undefined;
  const doc = params.doc ?? hashDoc;
  const [results, setResults] = useState<ComponentResultV1[]>([]);
  const [feedback, setFeedback] = useState<Record<string, ChoiceFeedback | undefined>>({});
  const [fillBlankFeedback, setFillBlankFeedback] = useState<Record<string, FillBlankFeedback | undefined>>({});
  const [matchPairsFeedback, setMatchPairsFeedback] = useState<Record<string, MatchPairsFeedback | undefined>>({});
  // The lesson screen gives a slide the viewport between header and footer; mirror that so short slides show their composition.
  const { height: windowHeight } = useWindowDimensions();

  const parsed = useMemo(() => {
    if (!doc) return { ok: false as const, error: 'Missing ?doc= parameter' };
    try {
      const result = SlideV1Schema.safeParse(JSON.parse(doc));
      if (!result.success) {
        return { ok: false as const, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') };
      }
      return { ok: true as const, slide: result.data };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [doc]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>QA HARNESS · local render, no server</Text>
      </View>
      {/* The document itself scrolls so full-page screenshots capture everything. */}
      <ScrollView contentContainerStyle={[styles.content, { minHeight: Math.max(0, windowHeight - BANNER_HEIGHT - FOOTER_ALLOWANCE) }]} style={{ flexGrow: 0 }} scrollEnabled={false}>
        {parsed.ok ? (
          <SlideView
            slide={parsed.slide}
            companion={BASE_COMPANION}
            interactions={{
              results,
              feedback,
              busyComponentId: null,
              onAnswer: (componentId, optionId) => {
                const component = parsed.slide.components.find((c) => c.id === componentId);
                if (!component || component.type !== 'multipleChoice') return;
                const option = component.options.find((o) => o.id === optionId);
                const correct = optionId === component.correctOptionId;
                const attempt = (results.filter((r) => r.componentId === componentId).length ?? 0) + 1;
                setResults((r) => [...r.filter((x) => x.componentId !== componentId), { type: 'multipleChoice', componentId, selectedOptionId: optionId, correct, attempt }]);
                setFeedback((f) => ({ ...f, [componentId]: { correct, explanation: option?.explanation ?? '', correctOptionId: component.correctOptionId, attempt } }));
              },
              onChecklist: (componentId, checkedItemIds, confirmed) =>
                setResults((r) => [...r.filter((x) => x.componentId !== componentId), { type: 'checklist', componentId, checkedItemIds, confirmed }]),
              fillBlankFeedback,
              // Local scoring through the same pure domain function the server will use.
              onFillBlank: (componentId, answers) => {
                const component = parsed.slide.components.find((c) => c.id === componentId);
                if (!component || component.type !== 'fillBlank') return;
                const attempt = (results.filter((r) => r.componentId === componentId).length ?? 0) + 1;
                const scored = scoreFillBlank(component, answers, attempt);
                setResults((r) => [...r.filter((x) => x.componentId !== componentId), scored.result]);
                setFillBlankFeedback((f) => ({
                  ...f,
                  [componentId]: {
                    correct: scored.result.correct,
                    attempt,
                    gaps: scored.result.answers.map((a) => ({ gapId: a.gapId, correct: a.correct, explanation: scored.explanations.find((e) => e.gapId === a.gapId)?.explanation ?? '' })),
                  },
                }));
              },
              matchPairsFeedback,
              onMatchPairs: (componentId, matches) => {
                const component = parsed.slide.components.find((c) => c.id === componentId);
                if (!component || component.type !== 'matchPairs') return;
                const attempt = (results.filter((r) => r.componentId === componentId).length ?? 0) + 1;
                const scored = scoreMatchPairs(component, matches, attempt);
                setResults((r) => [...r.filter((x) => x.componentId !== componentId), scored.result]);
                setMatchPairsFeedback((f) => ({
                  ...f,
                  [componentId]: {
                    correct: scored.result.correct,
                    attempt,
                    matches: scored.result.matches.map((m) => ({ pairId: m.pairId, correct: m.correct, explanation: scored.explanations.find((e) => e.pairId === m.pairId)?.explanation ?? '' })),
                  },
                }));
              },
            }}
          />
        ) : (
          <View style={styles.error}>
            <Text style={styles.errorTitle}>Slide did not validate</Text>
            <Text style={styles.errorText}>{parsed.error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Banner height and the lesson footer's height, so the column matches what a slide gets in the app. */
const BANNER_HEIGHT = 28;
const FOOTER_ALLOWANCE = 96;

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg },
  banner: { backgroundColor: colors.yellowTint, paddingVertical: 6, alignItems: 'center' },
  bannerText: { fontFamily: fonts.black, fontSize: 11, letterSpacing: 1, color: '#92400E' },
  // Same centered column as the lesson screen, so tablet and desktop renders are representative.
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  error: { padding: 16, borderRadius: 20, backgroundColor: colors.coralTint, gap: 8 },
  errorTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  errorText: { fontFamily: 'monospace', fontSize: 12, color: colors.ink },
});
