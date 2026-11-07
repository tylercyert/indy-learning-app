import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ComponentResultV1, ComponentV1, CompanionThemeV1, SlideV1 } from '../../contracts';
import { Companion } from '../companion/Companion';
import { colors, fonts, palette } from '../theme';
import { Checklist } from './Checklist';
import { CodeBlock } from './CodeBlock';
import { Diagram } from './Diagram';
import { FillBlank, type FillBlankFeedback } from './FillBlank';
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
  /** The screen renders explanations and retry/continue in its footer; components keep only their colouring. */
  feedbackInFooter?: boolean;
}

/** Renders one slide: each component through its renderer, in order. Unknown types cannot occur: the contract is closed. */
export function SlideView({ slide, companion, interactions }: { slide: SlideV1; companion: CompanionThemeV1; interactions: SlideInteractions }) {
  return (
    <View style={styles.slide}>
      <Text accessibilityRole="header" aria-level={1} style={styles.title}>
        {slide.title}
      </Text>
      {slide.components.map((component) => (
        <ComponentRenderer key={component.id} component={component} companion={companion} interactions={interactions} />
      ))}
    </View>
  );
}

function ComponentRenderer({ component, companion, interactions }: { component: ComponentV1; companion: CompanionThemeV1; interactions: SlideInteractions }) {
  switch (component.type) {
    case 'text':
      return <RichText doc={component.content} />;
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
  slide: { gap: 18 },
  title: { fontFamily: fonts.black, fontSize: 26, lineHeight: 31, color: colors.ink },
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
