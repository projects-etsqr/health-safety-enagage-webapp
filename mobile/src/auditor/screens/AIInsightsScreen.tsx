import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auditService, Audit } from '../services/auditService';

export function AIInsightsScreen({ navigation }: any) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setAudits(await auditService.listAssigned()); }
    catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const completed = audits.filter((a) => a.status === 'completed');
  const scores = completed.map((a) => a.compliance_score ?? 0);
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : 0;
  const overdue = audits.filter((a) => a.status === 'overdue');
  const lowest = [...completed].sort((a, b) => (a.compliance_score ?? 100) - (b.compliance_score ?? 100))[0];
  const failItems = completed.reduce((n, a) => n + (a.findings || []).filter((f) => (f.response || '').toLowerCase() === 'fail').length, 0);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}><Text style={styles.headerTitle}>AI Insights</Text></View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} /> : (
          <>
            {/* Hero AI card */}
            <View style={styles.hero}>
              <View style={styles.heroHead}>
                <View style={styles.heroIcon}><Ionicons name="hardware-chip-outline" size={22} color="#FFFFFF" /></View>
                <Text style={styles.heroTitle}>AI Smart Schedule</Text>
              </View>
              <Text style={styles.heroDesc}>
                {overdue.length > 0
                  ? `You have ${overdue.length} overdue audit(s). Prioritise "${overdue[0].title}" to reduce compliance risk.`
                  : lowest
                  ? `Your lowest-scoring audit was "${lowest.title}" (${lowest.compliance_score}%). Consider a re-inspection.`
                  : 'No urgent risks detected. Keep your inspection cadence steady.'}
              </Text>
              <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('Audits')}>
                <Text style={styles.heroBtnText}>View Audits</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>Key Signals</Text>
            <Insight icon="trending-up-outline" tone="#2563EB" bg="#EFF6FF"
              title={`Average compliance ${avg}%`}
              desc={avg >= 80 ? 'Healthy — above the 80% readiness threshold.' : 'Below 80% — audit readiness needs attention.'} />
            <Insight icon="close-circle-outline" tone="#EF4444" bg="#FEE2E2"
              title={`${failItems} open non-conformance item(s)`}
              desc="Failed checklist items across your completed audits. Review under Findings." />
            <Insight icon="time-outline" tone="#F97316" bg="#FFF7ED"
              title={`${overdue.length} overdue audit(s)`}
              desc={overdue.length ? 'Complete these first to stay compliant.' : 'Great — nothing overdue right now.'} />
            <Insight icon="checkmark-done-outline" tone="#16A34A" bg="#F0FDF4"
              title={`${completed.length} audit(s) completed`}
              desc="Submitted audits feed the org's compliance readiness score." />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Insight({ icon, tone, bg, title, desc }: any) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={20} color={tone} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#2563EB', borderRadius: 18, padding: 20 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  heroDesc: { color: '#EFF6FF', fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 16 },
  heroBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  heroBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '800' },
  section: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 24, marginBottom: 12 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  cardDesc: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
});
