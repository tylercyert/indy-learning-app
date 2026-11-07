import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { z } from 'zod';
import type { ChecklistResultSchema, ComponentV1 } from '../../contracts/components';
import { ChunkyButton } from '../ui/ChunkyButton';
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
              style={[styles.item, on && styles.itemOn]}
            >
              <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 12, borderRadius: 16, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.bg },
  itemOn: { borderColor: colors.mint, backgroundColor: colors.mintTint },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 3, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  boxOn: { borderColor: colors.mintDeep, backgroundColor: colors.mintDeep },
  tick: { color: '#FFFFFF', fontFamily: fonts.black, fontSize: 15 },
  itemText: { flex: 1, fontFamily: fonts.extraBold, fontSize: 15, color: colors.ink },
  done: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.mintDeep },
  note: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
});
