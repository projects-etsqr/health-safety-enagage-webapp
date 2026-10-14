import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={Colors.blue} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={Colors.blue} />
      {message && <Text style={styles.screenMsg}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 14, minWidth: 140,
  },
  message: { fontSize: 14, color: Colors.textMid, fontWeight: '500' },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, gap: 16 },
  screenMsg: { fontSize: 14, color: Colors.textMuted },
});
