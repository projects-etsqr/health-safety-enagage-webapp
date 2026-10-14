import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

interface UnconfirmedShift {
  id: number;
  shift_date: string | null;
  shift_type: string | null;
  actual_hours_worked: number | null;
  employee_name: string | null;
  station_name: string | null;
}

/**
 * Supervisor sign-off on worker-logged hours. Confirming stamps `supervisor_id` on the
 * shift row, which is both the audit control on man-hours and the trigger for the
 * worker's "Shift Confirmed" notification.
 */
export function ShiftConfirmationScreen({ navigation }: any) {
  const [rows, setRows] = useState<UnconfirmedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/supervisor/team/unconfirmed-shifts')
      .then((r: any) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirm = async (id: number) => {
    setBusy(id);
    try {
      await apiClient.post(`/supervisor/team/shifts/${id}/confirm`);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not confirm this shift.');
    } finally {
      setBusy(null);
    }
  };

  const totalHours = rows.reduce((sum, r) => sum + (r.actual_hours_worked ?? 0), 0);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Shift Hours</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryVal}>{rows.length}</Text>
        <Text style={styles.summaryLbl}>
          shifts awaiting sign-off · {totalHours.toFixed(1)} hrs
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>All logged shifts are confirmed.</Text>
        ) : (
          rows.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.employee_name || `Employee ${r.id}`}</Text>
                <Text style={styles.meta}>
                  {r.shift_date} · {r.shift_type || '—'}
                  {r.station_name ? ` · ${r.station_name}` : ''}
                </Text>
                <Text style={styles.hours}>
                  {r.actual_hours_worked != null ? `${r.actual_hours_worked} hrs logged` : 'No hours logged'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirm(r.id)}
                disabled={busy === r.id}
              >
                {busy === r.id
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.confirmText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  summary: { paddingHorizontal: 20, paddingBottom: 12 },
  summaryVal: { fontSize: 28, fontWeight: '800', color: '#004AC6' },
  summaryLbl: { fontSize: 12, fontWeight: '600', color: '#737686', marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  name: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  meta: { fontSize: 11, color: '#737686', marginTop: 2 },
  hours: { fontSize: 12, fontWeight: '700', color: '#004AC6', marginTop: 4 },
  confirmBtn: {
    backgroundColor: '#004AC6', paddingHorizontal: 16, height: 38,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 88,
  },
  confirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
