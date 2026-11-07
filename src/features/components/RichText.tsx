import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { InlineV1, RichTextV1 } from '../../contracts';
import { colors, fonts } from '../theme';

/** Renders the structured rich-text document. No markup is ever interpreted. */
export function RichText({ doc, color = colors.ink, size = 16 }: { doc: RichTextV1; color?: string; size?: number }) {
  return (
    <View style={styles.doc}>
      {doc.blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const fontSize = block.level === 1 ? size + 10 : block.level === 2 ? size + 6 : size + 2;
            return (
              // Slide titles are level 1, so rich-text headings start at level 2.
              <Text key={i} accessibilityRole="header" aria-level={block.level + 1} style={[styles.heading, { color, fontSize }]}>
                <Inlines inlines={block.inlines} color={color} />
              </Text>
            );
          }
          case 'paragraph':
            return (
              <Text key={i} style={[styles.paragraph, { color, fontSize: size, lineHeight: size * 1.5 }]}>
                <Inlines inlines={block.inlines} color={color} />
              </Text>
            );
          case 'bulletList':
          case 'numberedList':
            return (
              <View key={i} style={styles.list} accessibilityRole="list">
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listItem} role="listitem">
                    <Text style={[styles.bullet, { color, fontSize: size }]}>{block.type === 'bulletList' ? '•' : `${j + 1}.`}</Text>
                    <Text style={[styles.paragraph, styles.listText, { color, fontSize: size, lineHeight: size * 1.5 }]}>
                      <Inlines inlines={item} color={color} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'callout': {
            const tone = { tip: colors.mintTint, note: colors.soft, warning: colors.coralTint }[block.tone];
            return (
              <View key={i} style={[styles.callout, { backgroundColor: tone }]}>
                <Text style={[styles.paragraph, { color: colors.ink, fontSize: size - 1, lineHeight: (size - 1) * 1.5 }]}>
                  <Inlines inlines={block.inlines} color={colors.ink} />
                </Text>
              </View>
            );
          }
          case 'link':
            return (
              <Pressable
                key={i}
                accessibilityRole="link"
                accessibilityHint="Opens in your browser"
                onPress={() => void Linking.openURL(block.href)}
                style={styles.link}
              >
                <Text style={[styles.linkText, { fontSize: size - 1 }]}>{block.label} ↗</Text>
              </Pressable>
            );
        }
      })}
    </View>
  );
}

function Inlines({ inlines, color }: { inlines: InlineV1[]; color: string }) {
  return (
    <>
      {inlines.map((inline, i) => {
        const marks = inline.marks ?? [];
        return (
          <Text
            key={i}
            style={[
              { color },
              marks.includes('bold') && { fontFamily: fonts.black },
              marks.includes('italic') && { fontStyle: 'italic' as const },
              marks.includes('code') && styles.code,
            ]}
          >
            {inline.text}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  doc: { gap: 12 },
  heading: { fontFamily: fonts.black },
  paragraph: { fontFamily: fonts.bold },
  list: { gap: 8 },
  listItem: { flexDirection: 'row', gap: 10 },
  bullet: { fontFamily: fonts.black, width: 22 },
  listText: { flex: 1 },
  code: { fontFamily: 'monospace', backgroundColor: colors.soft, borderRadius: 4 },
  callout: { padding: 14, borderRadius: 16 },
  link: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.soft, minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.black, color: colors.purple },
});
