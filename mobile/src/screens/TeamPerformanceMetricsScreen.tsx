import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

export function TeamPerformanceMetricsScreen({ navigation }: any) {
  const [stats, setStats] = useState<any>(null);
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/dashboard/stats').then((r: any) => r.data).catch(() => null),
      apiClient.get('/supervisor/team/shift-status').then((r: any) => r.data).catch(() => null),
    ])
      .then(([s, sh]) => { setStats(s); setShift(sh); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const safetyIndex = stats?.avg_compliance_rating != null ? Math.round(stats.avg_compliance_rating / 5 * 100) : null;

  const cards = [
    { title: 'Safety Compliance Index', value: safetyIndex != null ? `${safetyIndex}%` : '—', desc: 'Average safety-walk compliance rating across the site.' },
    { title: 'CAPA Closure Rate', value: stats?.capa_completion_rate != null ? `${stats.capa_completion_rate}%` : '—', desc: 'Corrective actions completed on time.' },
    { title: 'Active Workforce', value: shift ? `${shift.logged_in}/${shift.total}` : '—', desc: 'Team members currently active on site.' },
    { title: 'Near-miss Reports', value: stats?.near_misses_count != null ? String(stats.near_misses_count) : '—', desc: 'Leading indicator — higher reporting = better culture.' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Metrics</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && !stats ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : (
          cards.map((c) => (
            <View key={c.title} style={styles.card}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.val}>{c.value}</Text>
              <Text style={styles.desc}>{c.desc}</Text>
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#737686' },
  val: { fontSize: 28, fontWeight: '800', color: '#004AC6', marginVertical: 6 },
  desc: { fontSize: 12, color: '#434655', lineHeight: 18 },
});
