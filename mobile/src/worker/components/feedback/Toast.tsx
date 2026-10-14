import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../display/Icon';

export type ToastKind = 'success' | 'error';

interface ToastProps {
  message: string | null;
  kind?: ToastKind;
  /** Called once the exit animation finishes so the parent can clear its state. */
  onHide: () => void;
  durationMs?: number;
}

/**
 * Transient confirmation banner pinned to the bottom of the screen.
 * Mirrors the fade/translate pattern used by the manager app's toast.
 */
export function Toast({ message, kind = 'success', onHide, durationMs = 2200 }: ToastProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    const seq = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(durationMs),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => { if (finished) onHide(); });
    return () => seq.stop();
  }, [message, durationMs, anim, onHide]);

  if (!message) return null;

  const isError = kind === 'error';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, isError ? styles.toastError : styles.toastSuccess]}>
        <Icon name={isError ? 'alert-circle' : 'check-circle'} size={17} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  toastSuccess: { backgroundColor: '#16A34A' },
  toastError: { backgroundColor: '#DC2626' },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
