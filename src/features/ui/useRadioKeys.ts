import { useRef, type ComponentRef } from 'react';
import { Platform, type KeyDownEvent, type View } from 'react-native';
import { isSpaceKey, radioKeyTarget, radioTabStop } from './a11y';
import { moveFocusTo } from './focus';

type RadioElement = ComponentRef<typeof View>;

/** Space and Enter held down repeat; one press is one selection. */
export function isRepeat(e: KeyDownEvent): boolean {
  return (e.nativeEvent as { repeat?: boolean }).repeat === true;
}

/**
 * Keyboard for a WAI-ARIA radio group on web (#20): the group is one tab stop (the checked radio,
 * else the first); Up/Down/Left/Right move focus and select, wrapping; Space selects. Enter keeps
 * working through Pressable. Spread `radioProps(i)` on each radio Pressable. On iOS and Android the
 * props are empty: screen readers and switch access move between radios themselves, and Android's
 * hardware-keyboard tab order must keep every radio reachable because there are no arrow handlers.
 */
export function useRadioKeys({
  count,
  checkedIndex,
  select,
  disabled = false,
}: {
  count: number;
  checkedIndex: number;
  select: (index: number) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(RadioElement | null)[]>([]);
  const web = Platform.OS === 'web';
  const stop = radioTabStop(checkedIndex, count);

  const radioProps = (index: number) => {
    if (!web) return {};
    return {
      ref: (el: RadioElement | null) => {
        refs.current[index] = el;
      },
      tabIndex: (disabled || index !== stop ? -1 : 0) as 0 | -1,
      onKeyDown: (e: KeyDownEvent) => {
        if (disabled) return;
        const key = e.nativeEvent.key;
        if (isSpaceKey(key)) {
          e.preventDefault(); // no page scroll
          if (!isRepeat(e)) select(index);
          return;
        }
        const next = radioKeyTarget(key, index, count);
        if (next === null) return;
        e.preventDefault();
        select(next);
        moveFocusTo(refs.current[next]);
      },
    };
  };

  /** Moves focus to one radio (after a match is placed, say). Web only; a no-op elsewhere. */
  const focusRadio = (index: number) => {
    if (web) moveFocusTo(refs.current[index]);
  };

  return { radioProps, focusRadio };
}
