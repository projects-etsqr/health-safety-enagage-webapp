import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

interface Kpi { label: string; value: string; color: string; icon: any; }

export function ReportsAnalyticsScreen({ navigation }: any) {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [categories, setCategories] = useState<{ name: string; data: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/dashboard/stats').then((r: any) => r.data).catch(() => null),
      apiClient.get('/dashboard/incidents-by-category').then((r: any) => r.data).catch(() => []),
    ])
      .then(([s, cats]) => {
        if (s) {
          setKpis([
            { label: 'Total Incidents', value: String(s.total_incidents ?? 0), color: '#EF4444', icon: 'alert-circle' },
            { label: 'Near Misses', value: String(s.near_misses_count ?? 0), color: '#F97316', icon: 'warning' },
            { label: 'Open CAPA', value: String(s.open_capa_actions ?? 0), color: '#8B5CF6', icon: 'construct' },
            { label: 'Active Permits', value: String(s.active_permits ?? 0), color: '#16A34A', icon: 'document-text' },
            { label: 'Compliance', value: s.avg_compliance_rating != null ? `${s.avg_compliance_rating}/5` : '—', color: '#004AC6', icon: 'shield-checkmark' },
            { label: 'CAPA Closure', value: s.capa_completion_rate != null ? `${s.capa_completion_rate}%` : '—', color: '#0EA5E9', icon: 'checkmark-done' },
          ]);
        }
        setCategories(Array.isArray(cats) ? cats.slice(0, 6) : []);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxCat = Math.max(1, ...categories.map((c) => c.data));

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && kpis.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : (
          <>
            <Text style={styles.section}>Organisation KPIs</Text>
            <View style={styles.grid}>
              {kpis.map((k) => (
                <View key={k.label} style={styles.kpiCard}>
                  <Ionicons name={k.icon} size={20} color={k.color} />
                  <Text style={styles.kpiVal}>{k.value}</Text>
                  <Text style={styles.kpiLbl}>{k.label}</Text>
                </View>
              ))}
            </View>

            {categories.length > 0 && (
              <>
                <Text style={styles.section}>Incidents by Category</Text>
                <View style={styles.card}>
                  {categories.map((c) => (
                    <View key={c.name} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>{c.name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(c.data / maxCat) * 100}%` }]} />
                      </View>
                      <Text style={styles.barVal}>{c.data}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  kpiCard: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  kpiVal: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginTop: 6 },
  kpiLbl: { fontSize: 10, color: '#737686', marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barLabel: { width: 90, fontSize: 11, color: '#434655' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#EEF2FF', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#004AC6', borderRadius: 4 },
  barVal: { fontSize: 11, fontWeight: '700', color: '#0B1C30', width: 24, textAlign: 'right' },
});
