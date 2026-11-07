import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ComponentV1 } from '../../contracts/components';
import { colors, fonts } from '../theme';

type CodeBlockComponent = Extract<ComponentV1, { type: 'codeBlock' }>;

const LANGUAGE_LABEL: Record<CodeBlockComponent['language'], string> = {
  plain: 'Code',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Shell',
  sql: 'SQL',
};

/**
 * Code as the learner would type it. Monospace, line numbers, no wrapping: long lines scroll
 * sideways inside the card so indentation stays truthful. The content is text only; it is never
 * executed and never parsed as markup. Screen readers get the whole block as one labelled region.
 */
export function CodeBlock({ component }: { component: CodeBlockComponent }) {
  const gutter = String(component.lines.length).length;
  const plain = component.lines.join('\n');
  return (
    <View style={styles.card} accessible accessibilityLabel={`${LANGUAGE_LABEL[component.language]} code, ${component.lines.length} lines. ${plain}`}>
      <View style={styles.header}>
        <Text style={styles.language}>{LANGUAGE_LABEL[component.language]}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View>
          {component.lines.map((line, i) => (
            <View key={i} style={styles.line}>
              <Text style={[styles.lineNumber, { minWidth: gutter * 9 + 8 }]}>{i + 1}</Text>
              {/* A blank line still needs height: render a space so the row keeps its lineHeight. */}
              <Text style={styles.code}>{line.length === 0 ? ' ' : line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {component.caption ? <Text style={styles.caption}>{component.caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, backgroundColor: '#1F1535', overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  language: { fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: '#C4B5FD' },
  scroll: { paddingHorizontal: 12, paddingVertical: 12 },
  line: { flexDirection: 'row' },
  lineNumber: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#8B80A8', textAlign: 'right', paddingRight: 8 },
  // No wrapping: the ScrollView carries overflow, so a long line never breaks the indentation picture.
  code: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#F3F0FA', paddingRight: 12 },
  caption: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: colors.purpleTint, paddingHorizontal: 16, paddingBottom: 12 },
});
