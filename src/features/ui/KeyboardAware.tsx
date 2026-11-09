import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

/**
 * Keeps the bottom of a screen (the intake composer, the lesson footer, a fill-the-gap field)
 * above the on-screen keyboard on iOS (#76 follow-up, native readiness #72). Android already
 * resizes the window for the keyboard (Expo's default), and the web has no keyboard frame to
 * avoid, so both render the children unchanged. Wrap the scroll area and the footer, below any
 * header: the view then starts below the app bar and pads by exactly the keyboard's overlap.
 */
export function KeyboardAware({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return (
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

/** Dragging the content puts the keyboard away: interactively on iOS, on drag elsewhere. */
export const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

const styles = StyleSheet.create({ fill: { flex: 1 } });
