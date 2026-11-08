import { useState } from 'react';
import { PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { z } from 'zod';
import type { ChecklistResultSchema, ComponentV1 } from '../../contracts/components';
import { glyphBoxSize, isSpaceKey } from '../ui/a11y';
import { ChunkyButton } from '../ui/ChunkyButton';
import { CheckIcon } from '../ui/icons';
import { isRepeat } from '../ui/useRadioKeys';
import { colors, fonts } from '../theme';

type ChecklistComponent = Extract<ComponentV1, { type: 'checklist' }>;
type Result = z.infer<typeof ChecklistResultSchema>;

/** Real-world steps the learner does away from the screen. Self-reported, never scored. */
export function Checklist({
  component,
  result,
  busy,
  onSubmit,
}: {
  component: ChecklistComponent;
  result?: Result;
  busy: boolean;
  onSubmit: (checkedItemIds: string[], confirmed: boolean) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(result?.checkedItemIds ?? []));
  const confirmed = result?.confirmed ?? false;

  const toggle = (id: string) => {
    if (confirmed) return;
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };
  // The box and its tick follow the OS text size, so the tick keeps its margin at 200%.
  const fontScale = PixelRatio.getFontScale();
  const box = glyphBoxSize(26, fontScale);
  const tick = glyphBoxSize(16, fontScale);

  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>Try it for real</Text>
      <Text style={styles.title}>{component.title}</Text>
      <View style={styles.items}>
        {component.items.map((item) => {
          const on = checked.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              aria-checked={on}
              aria-disabled={confirmed}
              accessibilityLabel={item.text}
              onPress={() => toggle(item.id)}
              // Space toggles a checkbox (Enter already does, through Pressable). Web only: native
              // screen readers and switch access toggle with their own gestures.
              onKeyDown={
                Platform.OS === 'web'
                  ? (e) => {
                      if (!isSpaceKey(e.nativeEvent.key)) return;
                      e.preventDefault(); // no page scroll
                      if (!isRepeat(e)) toggle(item.id);
                    }
                  : undefined
              }
              style={[styles.item, on && styles.itemOn]}
            >
              <View style={[styles.box, { width: box, height: box, borderRadius: Math.round(box * 0.3) }, on && styles.boxOn]}>
                {on ? <CheckIcon color="#FFFFFF" size={tick} /> : null}
              </View>
              <Text style={styles.itemText}>{item.text}</Text>
            </Pressable>
          );
        })}
      </View>
      {confirmed ? (
        <Text style={styles.done}>Logged. Nice work doing it for real.</Text>
      ) : (
        <ChunkyButton label={component.confirmLabel} variant="secondary" onPress={() => onSubmit([...checked], true)} loading={busy} />
      )}
      <Text style={styles.note}>This is for you, not a test. Skip it if you can’t do it right now.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.mintTint, color: colors.mintDeep, fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontFamily: fonts.black, fontSize: 20, color: colors.ink },
  items: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 12, borderRadius: 16, borderWidth: 3, borderColor: colors.control, backgroundColor: colors.bg },
  itemOn: { borderColor: colors.mint, backgroundColor: colors.mintTint },
  // Width and height come from the OS text scale at render (glyphBoxSize); the tick is drawn, not a font glyph.
  box: { borderWidth: 3, borderColor: colors.control, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  boxOn: { borderColor: colors.mintDeep, backgroundColor: colors.mintDeep },
  itemText: { flex: 1, minWidth: 0, flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 15, color: colors.ink },
  done: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.mintDeep },
  note: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
});
