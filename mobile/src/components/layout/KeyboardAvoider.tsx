import React from 'react';
import {
  KeyboardAvoidingView, Platform, StyleSheet,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/**
 * Keeps the focused input above the on-screen keyboard.
 *
 * ── Why this exists, and why the manifest is not enough ──────────────────────
 *
 * `AndroidManifest.xml` sets `android:windowSoftInputMode="adjustResize"`, and
 * for years that was the whole Android story: the system shrank the window when
 * the keyboard opened, and any ScrollView simply had less room and scrolled.
 * Only iOS, which has no such mode, needed a KeyboardAvoidingView — which is
 * why the twenty screens that have one all read
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.
 *
 * That stopped being true. This app targets SDK 36, and from Android 15
 * (API 35) edge-to-edge is enforced for anything targeting SDK 35 or above.
 * An edge-to-edge window does not resize for the IME — the app is handed the
 * keyboard's insets and is expected to deal with them itself, and
 * `adjustResize` is inert. The opt-out flag that used to buy a reprieve
 * (`windowOptOutEdgeToEdgeEnforcement`) is itself ignored at SDK 36, so there
 * is no version of this app where the manifest alone still works.
 *
 * The result is the reported symptom: on a modern phone the keyboard covers
 * whatever is under it on essentially every screen, including the ones that
 * "have" a KeyboardAvoidingView — theirs is switched off on Android by that
 * `: undefined`.
 *
 * ── Why the behaviour is version-dependent ───────────────────────────────────
 *
 * `padding` cannot simply be turned on for all of Android. On Android 14 and
 * below the window is not forced edge-to-edge, `adjustResize` still resizes it,
 * and adding padding on top of a window that has already shrunk lifts the
 * content twice — the opposite bug, and a more confusing one to report. So the
 * behaviour is chosen from the API level actually running: pad where the system
 * has stopped resizing, stay out of the way where it still does.
 */

// Android 15. Below this the window still resizes for the keyboard; from here
// up it does not, and the padding has to come from here instead.
const EDGE_TO_EDGE_ENFORCED_FROM = 35;

const androidHandlesResizeItself =
  Platform.OS === 'android' && Number(Platform.Version) < EDGE_TO_EDGE_ENFORCED_FROM;

/**
 * `undefined` is a real option, not a fallback: it tells KeyboardAvoidingView to
 * measure but apply nothing, which is exactly right when the window is already
 * being resized underneath it.
 */
export const KEYBOARD_BEHAVIOR: 'padding' | undefined =
  androidHandlesResizeItself ? undefined : 'padding';

interface KeyboardAvoiderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Extra gap between the keyboard and the focused input. Screens with a header
   * above the scroll area need this to account for its height; most do not.
   */
  offset?: number;
}

export function KeyboardAvoider({ children, style, offset = 0 }: KeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});


/**
 * A screen root that is both inset-safe and keyboard-safe.
 *
 * Most screens outside the worker app open with
 * `<SafeAreaView style={styles.root}>`, and the worker app's own ScreenLayout
 * already folds the avoider in. This is the same idea for everyone else, and it
 * exists as one component rather than a KeyboardAvoider nested by hand inside
 * each SafeAreaView so that adopting it is a tag rename — no extra level of
 * indentation across a screen's entire body, and a diff that shows what
 * actually changed.
 *
 * `edges` is forwarded because several screens deliberately inset only the top
 * ('top' alone lets the background run under the gesture bar), and losing that
 * would move their headers.
 */
export function SafeAreaScreen({
  children,
  style,
  edges,
  offset,
}: KeyboardAvoiderProps & { edges?: readonly Edge[] }) {
  return (
    <SafeAreaView style={[styles.fill, style]} edges={edges}>
      <KeyboardAvoider offset={offset}>{children}</KeyboardAvoider>
    </SafeAreaView>
  );
}
