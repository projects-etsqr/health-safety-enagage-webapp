import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { KeyboardAvoider, SafeAreaScreen } from '../components/layout/KeyboardAvoider';

interface Inspection {
  id: string;
  title: string;
  date: string;
  rating: number;
  followUp: boolean;
}

interface Station { id: number; station_name: string }

const INSPECTION_TYPES = ['Routine', 'Compliance', 'Follow-up'];

function ratingMeta(rating: number, followUp: boolean) {
  if (rating >= 4 && !followUp) return { label: 'Passed', color: '#16A34A', bg: '#F0FDF4' };
  if (rating >= 3) return { label: 'Needs Follow-up', color: '#F97316', bg: '#FFF7ED' };
  return { label: 'Failed', color: '#EF4444', bg: '#FEF2F2' };
}

export function InspectionManagementScreen({ navigation }: any) {
  const [list, setList] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  // ── New inspection form ──────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);
  const [inspectionType, setInspectionType] = useState('Routine');
  const [issuesFound, setIssuesFound] = useState('0');
  const [criticalIssues, setCriticalIssues] = useState('0');
  const [housekeeping, setHousekeeping] = useState(4);
  const [compliance, setCompliance] = useState(4);
  const [followUp, setFollowUp] = useState(false);

  const resetForm = () => {
    setInspectionType('Routine');
    setIssuesFound('0');
    setCriticalIssues('0');
    setHousekeeping(4);
    setCompliance(4);
    setFollowUp(false);
  };

  const submitWalk = async () => {
    if (!stationId) {
      Alert.alert('Required', 'Select the station you inspected.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/supervisor/reports/safety-walks', {
        inspection_date_time: new Date().toISOString(),
        location_station_id: stationId,
        inspection_type: inspectionType,
        issues_found: Number(issuesFound) || 0,
        critical_issues: Number(criticalIssues) || 0,
        housekeeping_rating: housekeeping,
        compliance_rating: compliance,
        follow_up_required: followUp ? 'Yes' : 'No',
      });
      setFormVisible(false);
      resetForm();
      load();
    } catch (err: any) {
      Alert.alert('Save Failed', err?.response?.data?.detail || 'Could not record the inspection.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    apiClient.get('/working-stations/')
      .then((res: any) => {
        const rows: Station[] = Array.isArray(res.data) ? res.data : [];
        setStations(rows);
        setStationId(prev => prev ?? rows[0]?.id ?? null);
      })
      .catch(() => setStations([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/supervisor/reports/safety-walks')
      .then((res: any) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
        const mapped: Inspection[] = rows.map((r: any) => ({
          id: String(r.id),
          title: `${r.inspection_type || 'Safety'} Inspection`,
          date: r.inspection_date_time ? new Date(r.inspection_date_time).toLocaleDateString() : '—',
          rating: Number(r.compliance_rating) || 0,
          followUp: String(r.follow_up_required).toLowerCase() === 'yes',
        }));
        mapped.sort((a, b) => (a.date < b.date ? 1 : -1));
        setList(mapped.slice(0, 40));
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspections</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setFormVisible(true)}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && list.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>No inspections recorded yet.</Text>
        ) : (
          list.map((i) => {
            const meta = ratingMeta(i.rating, i.followUp);
            return (
              <View key={i.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{i.title}</Text>
                  <Text style={styles.sub}>{i.date} · Compliance {i.rating}/5</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Safety Walk</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Ionicons name="close" size={22} color="#737686" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>STATION</Text>
              <View style={styles.pillWrap}>
                {stations.map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.pill, stationId === st.id && styles.pillActive]}
                    onPress={() => setStationId(st.id)}
                  >
                    <Text style={[styles.pillText, stationId === st.id && styles.pillTextActive]}>
                      {st.station_name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {stations.length === 0 && <Text style={styles.empty}>No stations configured.</Text>}
              </View>

              <Text style={styles.fieldLabel}>INSPECTION TYPE</Text>
              <View style={styles.pillWrap}>
                {INSPECTION_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, inspectionType === t && styles.pillActive]}
                    onPress={() => setInspectionType(t)}
                  >
                    <Text style={[styles.pillText, inspectionType === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>ISSUES FOUND</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={issuesFound}
                    onChangeText={(t: string) => setIssuesFound(t.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>CRITICAL ISSUES</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={criticalIssues}
                    onChangeText={(t: string) => setCriticalIssues(t.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>

              <RatingRow label="HOUSEKEEPING RATING" value={housekeeping} onChange={setHousekeeping} />
              <RatingRow label="COMPLIANCE RATING" value={compliance} onChange={setCompliance} />

              <TouchableOpacity style={styles.toggleRow} onPress={() => setFollowUp(v => !v)}>
                <Ionicons
                  name={followUp ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={followUp ? '#004AC6' : '#737686'}
                />
                <Text style={styles.toggleText}>Follow-up required</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={submitWalk} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Record Inspection</Text>}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoider>
      </Modal>
    </SafeAreaScreen>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pillWrap}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.ratingBtn, value === n && styles.pillActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.pillText, value === n && styles.pillTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12, flex: 1 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#004AC6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  newBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0B1C30' },
  sheetScroll: { maxHeight: '100%' },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: '#737686',
    letterSpacing: 0.6, marginTop: 16, marginBottom: 8,
  },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  ratingBtn: {
    width: 48, height: 40, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  pillActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  pillText: { fontSize: 13, fontWeight: '700', color: '#0B1C30' },
  pillTextActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, height: 46, fontSize: 14, color: '#0B1C30',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#0B1C30' },
  saveBtn: {
    backgroundColor: '#004AC6', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  title: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  sub: { fontSize: 11, color: '#737686', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
