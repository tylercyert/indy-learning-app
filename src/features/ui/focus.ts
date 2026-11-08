import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Platform, TextInput, type Text } from 'react-native';
import { announce } from './announce';

type HostInstance = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];

/**
 * Native screens animate in; focusing before the push settles is overridden by the screen reader's
 * own "screen changed" focus. Not verified on a device yet (#9).
 */
const NATIVE_SETTLE_MS = 350;

/** A text field has focus: moving focus now would take the keyboard away from someone typing. */
export function isTyping(): boolean {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  return TextInput.State.currentlyFocusedInput() != null;
}

/**
 * Moves keyboard and screen-reader focus to a rendered element. On web the element is a DOM node:
 * headings and text get `tabindex=-1` so script can focus them without adding a tab stop, and no
 * ring, because they are not controls. On iOS and Android the screen reader's cursor moves there.
 */
export function moveFocusTo(target: unknown): void {
  if (!target) return;
  if (Platform.OS === 'web') {
    const el = target as HTMLElement;
    if (typeof el.focus !== 'function') return;
    if (typeof el.hasAttribute === 'function' && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
      el.style.outline = 'none';
    }
    el.focus();
    return;
  }
  AccessibilityInfo.sendAccessibilityEvent(target as HostInstance, 'focus');
}

const settleDelay = () => (Platform.OS === 'web' ? 0 : NATIVE_SETTLE_MS);

/**
 * A callback ref: focus moves to the element as soon as it appears. For things that mount when they
 * matter (the celebration title, the feedback sheet, the planning screen), with no key to keep in sync.
 */
export function focusWhenShown(el: unknown): void {
  if (el) setTimeout(() => moveFocusTo(el), settleDelay());
}

/**
 * Counts how often this screen has become the visible one: 1 on first open, and again on coming
 * back to it (browser Back to a screen the stack kept mounted). Use it in a focus key; 0 means "not yet".
 */
export function useScreenVisits(): number {
  const [visits, setVisits] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisits((v) => v + 1);
    }, []),
  );
  return visits;
}

/**
 * Focus follows the screen: returns a ref for the screen's heading (or the element that stands in
 * for it) and moves focus there when it mounts and whenever `key` changes: a new route, a new slide,
 * a new skill tree. `null`/`undefined` keys do nothing. With `unlessTyping`, a
 * learner typing in a field keeps their place and hears `announceInstead` (if given) instead.
 */
export function useFocusOnChange<T = ComponentRef<typeof Text>>(
  key: string | number | null | undefined,
  options: { unlessTyping?: boolean; announceInstead?: string } = {},
) {
  const ref = useRef<T>(null);
  const { unlessTyping = false, announceInstead } = options;
  useEffect(() => {
    if (key === null || key === undefined) return;
    if (unlessTyping && isTyping()) {
      if (announceInstead) announce(announceInstead);
      return;
    }
    const timer = setTimeout(() => moveFocusTo(ref.current), settleDelay());
    return () => clearTimeout(timer);
  }, [key, unlessTyping, announceInstead]);
  return ref;
}
