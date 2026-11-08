import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { componentRole, type ComponentResultV1, type ComponentV1, type CompanionThemeV1, type SlideV1 } from '../../contracts';
import { Companion } from '../companion/Companion';
import { colors, fonts, palette } from '../theme';
import { Checklist } from './Checklist';
import { CodeBlock } from './CodeBlock';
import { Diagram } from './Diagram';
import { FillBlank, type FillBlankFeedback } from './FillBlank';
import { MatchPairs, type MatchPairsFeedback } from './MatchPairs';
import { MultipleChoice, type ChoiceFeedback } from './MultipleChoice';
import { RichText } from './RichText';

export interface SlideInteractions {
  results: ComponentResultV1[];
  feedback: Record<string, ChoiceFeedback | undefined>;
  busyComponentId: string | null;
  onAnswer: (componentId: string, optionId: string) => void;
  onChecklist: (componentId: string, checkedItemIds: string[], confirmed: boolean) => void;
  /** Optional until the server scores fillBlank; without a handler the component renders with Check disabled. */
  fillBlankFeedback?: Record<string, FillBlankFeedback | undefined>;
  onFillBlank?: (componentId: string, answers: { gapId: string; value: string }[]) => void;
  /** Optional until the server scores matchPairs; without a handler the component renders with Check disabled. */
  matchPairsFeedback?: Record<string, MatchPairsFeedback | undefined>;
  onMatchPairs?: (componentId: string, matches: { pairId: string; chosenPairId: string }[]) => void;
  /** The screen renders explanations and retry/continue in its footer; components keep only their colouring. */
  feedbackInFooter?: boolean;
  /** Where each assessable component sits inside the slide, so the screen can keep a just-answered check in view. */
  onAssessableLayout?: (componentId: string, box: { y: number; height: number }) => void;
}

/** Body text size: 17 reads better than 16 at arm's length and fills a phone slide (UX audit #36 P1-11). */
const BODY_SIZE = 17;

/**
 * Renders one slide: each component through its renderer, in order. Unknown types cannot occur: the
 * contract is closed. Composition (UX audit #36 P1-11): when the slide opens with the companion
 * speaking, the bubble goes above the title so the page reads top-down like the mockup, and the
 * whole slide grows to fill and centers itself when the screen gives it more room than it needs.
 */
export function SlideView({ slide, companion, interactions }: { slide: SlideV1; companion: CompanionThemeV1; interactions: SlideInteractions }) {
  const [first, ...rest] = slide.components;
  const leadsWithCompanion = first?.type === 'callout' && first.speaker === 'companion';
  const body = leadsWithCompanion ? rest : slide.components;
  return (
    <View style={styles.slide}>
      {leadsWithCompanion && first ? <ComponentRenderer component={first} companion={companion} interactions={interactions} /> : null}
      <Text accessibilityRole="header" aria-level={1} style={styles.title}>
        {slide.title}
      </Text>
      {body.map((component) => {
        const rendered = <ComponentRenderer key={component.id} component={component} companion={companion} interactions={interactions} />;
        const report = interactions.onAssessableLayout;
        if (!report || componentRole(component.type) !== 'assessable') return rendered;
        return (
          <View key={component.id} onLayout={(e) => report(component.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })}>
            {rendered}
          </View>
        );
      })}
    </View>
  );
}

function ComponentRenderer({ component, companion, interactions }: { component: ComponentV1; companion: CompanionThemeV1; interactions: SlideInteractions }) {
  switch (component.type) {
    case 'text':
      return <RichText doc={component.content} size={BODY_SIZE} />;
    case 'callout': {
      const tone = { encourage: colors.coralTint, explain: colors.soft, warn: colors.coralTint, celebrate: colors.yellowTint }[component.tone];
      if (component.speaker === 'companion') {
        return (
          <View style={styles.speech}>
            <Companion theme={companion} mood={component.tone === 'celebrate' ? 'cheering' : component.tone === 'warn' ? 'thinking' : 'happy'} size={64} />
            <View style={[styles.bubble, { backgroundColor: tone }]}>
              <RichText doc={component.content} size={15} />
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.plainCallout, { backgroundColor: tone }]}>
          <RichText doc={component.content} size={15} />
        </View>
      );
    }
    case 'ratioBar':
      return <RatioBar component={component} />;
    case 'diagram':
      return <Diagram component={component} />;
    case 'checklist': {
      const result = interactions.results.find((r) => r.componentId === component.id && r.type === 'checklist');
      return (
        <Checklist
          component={component}
          result={result?.type === 'checklist' ? result : undefined}
          busy={interactions.busyComponentId === component.id}
          onSubmit={(ids, confirmed) => interactions.onChecklist(component.id, ids, confirmed)}
        />
      );
    }
    case 'multipleChoice': {
      const result = interactions.results.find((r) => r.componentId === component.id && r.type === 'multipleChoice');
      return (
        <MultipleChoice
          component={component}
          result={result?.type === 'multipleChoice' ? result : undefined}
          feedback={interactions.feedback[component.id]}
          feedbackInFooter={interactions.feedbackInFooter}
          busy={interactions.busyComponentId === component.id}
          onSubmit={(optionId) => interactions.onAnswer(component.id, optionId)}
        />
      );
    }
    case 'codeBlock':
      return <CodeBlock component={component} />;
    case 'matchPairs': {
      const result = interactions.results.find((r) => r.componentId === component.id && r.type === 'matchPairs');
      const onMatchPairs = interactions.onMatchPairs;
      return (
        <MatchPairs
          component={component}
          result={result?.type === 'matchPairs' ? result : undefined}
          feedback={interactions.matchPairsFeedback?.[component.id]}
          busy={interactions.busyComponentId === component.id}
          onSubmit={onMatchPairs ? (matches) => onMatchPairs(component.id, matches) : undefined}
          feedbackInFooter={interactions.feedbackInFooter}
        />
      );
    }
    case 'fillBlank': {
      const result = interactions.results.find((r) => r.componentId === component.id && r.type === 'fillBlank');
      const onFillBlank = interactions.onFillBlank;
      return (
        <FillBlank
          component={component}
          result={result?.type === 'fillBlank' ? result : undefined}
          feedback={interactions.fillBlankFeedback?.[component.id]}
          feedbackInFooter={interactions.feedbackInFooter}
          busy={interactions.busyComponentId === component.id}
          onSubmit={onFillBlank ? (answers) => onFillBlank(component.id, answers) : undefined}
        />
      );
    }
  }
}

const RATIO_GAP = 6;
const RATIO_FONT = 14;
/** Average advance of the segment font at RATIO_FONT; the segment has 4px padding each side. */
const RATIO_CHAR_W = 8.6;

/**
 * Proportional segments whose widths follow `parts` exactly (they may shrink below their text), so
 * the picture stays honest. What a segment says depends on its measured pixel width: the number and
 * label when both fit, the number alone when that fits, nothing when even that would overflow.
 * The legend underneath always carries every label and fraction.
 */
function RatioBar({ component }: { component: Extract<ComponentV1, { type: 'ratioBar' }> }) {
  const [rowWidth, setRowWidth] = useState(0);
  const total = component.segments.reduce((sum, s) => sum + s.parts, 0);
  const usable = Math.max(0, rowWidth - RATIO_GAP * (component.segments.length - 1));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{component.title}</Text>
      <View style={styles.ratioRow} role="img" aria-label={component.altText} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {component.segments.map((seg) => {
          const p = palette[seg.color];
          const px = (usable * seg.parts) / total;
          const full = `${seg.parts} ${seg.label}`;
          const text = rowWidth === 0 ? '' : fitsRatio(full, px) ? full : fitsRatio(String(seg.parts), px) ? String(seg.parts) : '';
          return (
            <View key={seg.label} style={[styles.ratioSeg, { flexGrow: seg.parts, backgroundColor: p.fill, borderBottomColor: p.shadow }]}>
              {text ? (
                <Text style={[styles.ratioText, { color: p.text }]} numberOfLines={1}>
                  {text}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {component.segments.map((seg) => (
          <View key={seg.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: palette[seg.color].fill }]} />
            <Text style={styles.legendText}>
              {seg.label} · {seg.parts}/{total}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function fitsRatio(text: string, px: number): boolean {
  return text.length * RATIO_CHAR_W + 8 <= px;
}

const styles = StyleSheet.create({
  // flexGrow + center: when the screen's content column has spare height, the slide sits composed in it
  // instead of hugging the top and leaving a void below (the column must itself flexGrow for this to apply).
  slide: { gap: 16, flexGrow: 1, justifyContent: 'center' },
  title: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32, color: colors.ink },
  speech: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // The tail points at the companion, which sits at the top of tall bubbles.
  bubble: { flex: 1, minWidth: 0, padding: 14, borderRadius: 20, borderTopLeftRadius: 6 },
  plainCallout: { padding: 14, borderRadius: 20 },
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.coralTint, gap: 12 },
  cardTitle: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.coralDeep },
  ratioRow: { flexDirection: 'row', gap: RATIO_GAP, minHeight: 56 },
  ratioSeg: { flexBasis: 0, minWidth: 0, overflow: 'hidden', minHeight: 56, borderRadius: 16, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ratioText: { fontFamily: fonts.black, fontSize: RATIO_FONT, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  // Shrinkable so long labels or large text wrap inside the card instead of running off it.
  legendText: { flexShrink: 1, minWidth: 0, fontFamily: fonts.extraBold, fontSize: 13, color: colors.ink },
});
