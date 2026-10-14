import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { complianceService } from '../services/complianceService';
import type { DashboardAlert } from '../types/compliance.types';

export function AISafetyInsightsScreen({ navigation }: any) {
  const [li, setLi] = useState<any>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/dashboard/leading-indicators').then((r: any) => r.data).catch(() => null),
      complianceService.getAlerts().catch(() => []),
    ])
      .then(([l, a]) => { setLi(l); setAlerts(a); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const risk = li?.predictive_injury_risk_score;
  const riskLevel = risk == null ? '—' : risk >= 50 ? 'High' : risk >= 20 ? 'Moderate' : 'Low';
  const riskColor = risk == null ? '#64748B' : risk >= 50 ? '#EF4444' : risk >= 20 ? '#F97316' : '#16A34A';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Safety Insights</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && !li ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : (
          <>
            {/* Predictive risk */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="sparkles" size={20} color="#004AC6" />
                <Text style={styles.cardTitle}>Predictive Injury Risk</Text>
              </View>
              <View style={styles.riskRow}>
                <Text style={[styles.riskVal, { color: riskColor }]}>
                  {risk != null ? `${risk}` : '—'}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: riskColor + '22' }]}>
                  <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLevel} Risk</Text>
                </View>
              </View>
              <Text style={styles.desc}>
                Model-derived risk score from recent incident, near-miss and CAPA trends.
                {li?.predictive_injury_risk_trend != null
                  ? `  Trend: ${li.predictive_injury_risk_trend > 0 ? '↑' : '↓'} ${Math.abs(li.predictive_injury_risk_trend)}.`
                  : ''}
              </Text>
            </View>

            {/* Leading indicators */}
            {li && (
              <>
                <Text style={styles.section}>Leading Indicators</Text>
                <View style={styles.metricGrid}>
                  {[
                    { l: 'TRIR', v: li.trir },
                    { l: 'LTIFR', v: li.ltifr },
                    { l: 'DART', v: li.dart_rate },
                    { l: 'Near-miss ratio', v: li.near_miss_ratio },
                  ].map((m) => (
                    <View key={m.l} style={styles.metricCard}>
                      <Text style={styles.metricVal}>{m.v != null ? m.v : '—'}</Text>
                      <Text style={styles.metricLbl}>{m.l}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Flagged alerts */}
            {alerts.length > 0 && (
              <>
                <Text style={styles.section}>Flagged by the System</Text>
                {alerts.slice(0, 5).map((a) => (
                  <View key={a.id} style={styles.alertRow}>
                    <Ionicons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.alertText} numberOfLines={2}>{a.message}</Text>
                  </View>
                ))}
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
  section: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  riskVal: { fontSize: 34, fontWeight: '800' },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  riskBadgeText: { fontSize: 12, fontWeight: '800' },
  desc: { fontSize: 13, color: '#434655', lineHeight: 18 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  metricVal: { fontSize: 20, fontWeight: '800', color: '#0B1C30' },
  metricLbl: { fontSize: 11, color: '#737686', marginTop: 2 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03 },
  alertText: { fontSize: 12, color: '#434655', flex: 1 },
});
