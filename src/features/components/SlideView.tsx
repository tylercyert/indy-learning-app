import { StyleSheet, Text, View } from 'react-native';
import type { ComponentResultV1, ComponentV1, CompanionThemeV1, SlideV1 } from '../../contracts';
import { Companion } from '../companion/Companion';
import { colors, fonts, palette } from '../theme';
import { Checklist } from './Checklist';
import { Diagram } from './Diagram';
import { MultipleChoice, type ChoiceFeedback } from './MultipleChoice';
import { RichText } from './RichText';

export interface SlideInteractions {
  results: ComponentResultV1[];
  feedback: Record<string, ChoiceFeedback | undefined>;
  busyComponentId: string | null;
  onAnswer: (componentId: string, optionId: string) => void;
  onChecklist: (componentId: string, checkedItemIds: string[], confirmed: boolean) => void;
}

/** Renders one slide: each component through its renderer, in order. Unknown types cannot occur: the contract is closed. */
export function SlideView({ slide, companion, interactions }: { slide: SlideV1; companion: CompanionThemeV1; interactions: SlideInteractions }) {
  return (
    <View style={styles.slide}>
      <Text accessibilityRole="header" style={styles.title}>
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
    case 'ratioBar': {
      const total = component.segments.reduce((sum, s) => sum + s.parts, 0);
      return (
        <View style={styles.card} accessible accessibilityLabel={component.altText}>
          <Text style={styles.cardTitle}>{component.title}</Text>
          <View style={styles.ratioRow}>
            {component.segments.map((seg) => {
              const p = palette[seg.color];
              return (
                <View key={seg.label} style={[styles.ratioSeg, { flex: seg.parts, backgroundColor: p.fill, borderBottomColor: p.shadow }]}>
                  <Text style={[styles.ratioText, { color: p.text }]} numberOfLines={2}>
                    {seg.parts} {seg.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.alt}>
            {component.segments.map((s) => `${s.parts}/${total} ${s.label}`).join(' · ')}
          </Text>
        </View>
      );
    }
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
          busy={interactions.busyComponentId === component.id}
          onSubmit={(optionId) => interactions.onAnswer(component.id, optionId)}
        />
      );
    }
  }
}

const styles = StyleSheet.create({
  slide: { gap: 18 },
  title: { fontFamily: fonts.black, fontSize: 26, lineHeight: 31, color: colors.ink },
  speech: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble: { flex: 1, padding: 14, borderRadius: 20, borderBottomLeftRadius: 6 },
  plainCallout: { padding: 14, borderRadius: 20 },
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.coralTint, gap: 12 },
  cardTitle: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.coralDeep },
  ratioRow: { flexDirection: 'row', gap: 6, minHeight: 56 },
  ratioSeg: { minHeight: 56, borderRadius: 16, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ratioText: { fontFamily: fonts.black, fontSize: 14, textAlign: 'center' },
  alt: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
