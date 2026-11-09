import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';

type Politeness = 'polite' | 'assertive';
type Listener = (message: string, politeness: Politeness) => void;

let listener: Listener | null = null;

/**
 * Says something to assistive tech: answer feedback, completion, errors, a new intake question.
 * One persistent polite region and one assertive region live in the root layout (`AnnouncerHost`),
 * so every screen shares them and they exist before their text changes, which is when screen
 * readers on web and Android listen. iOS has no live regions, so it gets a VoiceOver announcement.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  const text = message.trim();
  if (!text) return;
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: politeness === 'polite' });
    return;
  }
  listener?.(text, politeness);
}

/**
 * Announces `message` whenever it changes to a new non-empty value (not on every render), and only
 * while the calling screen is the visible one: a course screen polling under an open lesson must not
 * talk over it. Coming back to the screen says the current message again. Use inside a route screen.
 */
export function useAnnounce(message: string | null | undefined, politeness: Politeness = 'polite'): void {
  const visible = useIsFocused();
  useEffect(() => {
    if (visible && message) announce(message, politeness);
  }, [visible, message, politeness]);
}

/** The gap between clearing a region and filling it, so a repeated message is a change again. */
const SETTLE_MS = 60;

/** Mount once, in the root layout. Renders two visually hidden live regions. */
export function AnnouncerHost() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const pending = useRef<Record<Politeness, { text: string; timer: ReturnType<typeof setTimeout> | null }>>({
    polite: { text: '', timer: null },
    assertive: { text: '', timer: null },
  });

  useEffect(() => {
    const slots = pending.current;
    listener = (text, politeness) => {
      const slot = slots[politeness];
      const set = politeness === 'assertive' ? setAssertive : setPolite;
      // Messages that arrive together (feedback, then "lesson complete") are read together, in order.
      slot.text = slot.timer ? `${slot.text} ${text}` : text;
      if (slot.timer) clearTimeout(slot.timer);
      // Clear first: "Not quite." twice in a row must still be heard the second time.
      set('');
      slot.timer = setTimeout(() => {
        set(slot.text);
        slot.timer = null;
      }, SETTLE_MS);
    };
    return () => {
      listener = null;
      for (const slot of Object.values(slots)) if (slot.timer) clearTimeout(slot.timer);
    };
  }, []);

  if (Platform.OS === 'ios') return null;
  return (
    <View pointerEvents="none" style={styles.host}>
      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {polite}
      </Text>
      <Text accessibilityLiveRegion="assertive" style={styles.srOnly}>
        {assertive}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden' },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
