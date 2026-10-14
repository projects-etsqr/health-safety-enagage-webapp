import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.primary} />
          {message && <Text style={styles.msg}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.full}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    minWidth: 140,
  },
  msg: { fontSize: 14, color: Colors.textMid, textAlign: 'center' },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
