import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { teamService } from '../services/teamService';
import type { ShiftStatus } from '../types/team.types';

export function SessionManagementScreen({ navigation }: any) {
  const [shift, setShift] = useState<ShiftStatus | null>(null);

  useEffect(() => {
    teamService.getShiftStatus().then(setShift).catch(() => {});
  }, []);

  const handleAction = (act: string) => {
    Alert.alert('Shift Session', `Action "${act}" triggered successfully.`);
  };

  const handleEndShift = () => {
    const today = new Date().toISOString().slice(0, 10);
    teamService.logHours(today)
      .then(({ employees_logged }) => {
        Alert.alert('Shift Ended', `Logged 8h for ${employees_logged} team member${employees_logged === 1 ? '' : 's'}.`);
      })
      .catch(() => Alert.alert('Shift Ended', 'Could not log team hours — please try again.'));
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift Session Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.liveRow}>
            <Text style={styles.label}>Active Session Name</Text>
            {shift?.is_live && <Text style={styles.live}>● Live</Text>}
          </View>
          <Text style={styles.val}>Day Operations Shift</Text>

          <Text style={styles.label}>Workers On Site</Text>
          <Text style={styles.val}>
            {shift ? `${shift.logged_in} of ${shift.total} active` : '—'}
          </Text>

          <Text style={styles.label}>Pending Login</Text>
          <Text style={[styles.val, { marginBottom: 0 }]}>{shift?.pending ?? '—'}</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => handleAction('Take a break')}>
          <Text style={styles.btnText}>Pause Shift (Start Break)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.critBtn]} onPress={handleEndShift}>
          <Text style={[styles.btnText, styles.critBtnText]}>End Active Shift Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  label: { fontSize: 11, color: '#737686', textTransform: 'uppercase', marginBottom: 4 },
  val: { fontSize: 15, fontWeight: '700', color: '#0B1C30', marginBottom: 16 },
  btn: { backgroundColor: '#004AC6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  critBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  critBtnText: { color: '#EF4444' },
});
