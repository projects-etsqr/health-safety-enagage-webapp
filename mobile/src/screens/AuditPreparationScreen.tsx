import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

function bar(pct: number, color: string) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function AuditPreparationScreen({ navigation }: any) {
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/analytics/compliance-summary')
      .then((r: any) => setC(r.data))
      .catch(() => setC(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const readiness = c?.audit_readiness_pct ?? 0;
  const readyColor = readiness >= 80 ? '#16A34A' : readiness >= 60 ? '#F97316' : '#EF4444';

  const rows = [
    { label: 'Audit Readiness', pct: c?.audit_readiness_pct ?? 0, color: readyColor },
    { label: 'Overall Compliance', pct: c?.compliance_score ?? 0, color: '#004AC6' },
    { label: 'Legal Register Coverage', pct: c?.legal_register_coverage_pct ?? 0, color: '#8B5CF6' },
    { label: 'Permit Compliance', pct: c?.permit_compliance_pct ?? 0, color: '#0EA5E9' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Preparation</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && !c ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={styles.readyCard}>
              <Text style={styles.readyLabel}>Audit Readiness</Text>
              <Text style={[styles.readyVal, { color: readyColor }]}>{readiness}%</Text>
              <Text style={styles.readySub}>{c?.audit_readiness_label || 'Based on open critical findings vs total findings.'}</Text>
            </View>

            <View style={styles.card}>
              {rows.map((r) => (
                <View key={r.label} style={{ marginBottom: 16 }}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowLabel}>{r.label}</Text>
                    <Text style={styles.rowPct}>{r.pct}%</Text>
                  </View>
                  {bar(r.pct, r.color)}
                </View>
              ))}
            </View>
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
  readyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  readyLabel: { fontSize: 12, color: '#737686', textTransform: 'uppercase', fontWeight: '700' },
  readyVal: { fontSize: 40, fontWeight: '800', marginVertical: 4 },
  readySub: { fontSize: 12, color: '#434655', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 13, color: '#0B1C30', fontWeight: '600' },
  rowPct: { fontSize: 13, color: '#0B1C30', fontWeight: '800' },
  track: { height: 8, backgroundColor: '#EEF2FF', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
