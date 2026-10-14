import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

interface Zone { id: string; name: string; incidents: number; hazard: string; color: string; bg: string; }

export function SiteMonitoringOverviewScreen({ navigation }: any) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/analytics/risk-summary')
      .then((r: any) => {
        const zr = r.data?.zone_risk ?? [];
        setZones(zr.map((z: any, i: number) => {
          const v = z.value || 0;
          const hazard = v > 10 ? 'High' : v >= 5 ? 'Medium' : 'Low';
          const color = v > 10 ? '#EF4444' : v >= 5 ? '#F97316' : '#16A34A';
          const bg = v > 10 ? '#FEF2F2' : v >= 5 ? '#FFF7ED' : '#F0FDF4';
          return { id: String(i), name: z.zone || 'Zone', incidents: v, hazard, color, bg };
        }));
      })
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Site Monitoring</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && zones.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : zones.length === 0 ? (
          <Text style={styles.empty}>No zone risk data available.</Text>
        ) : (
          zones.map((z) => (
            <View key={z.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{z.name}</Text>
                <Text style={styles.sub}>{z.incidents} incident{z.incidents === 1 ? '' : 's'} recorded</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: z.bg }]}>
                <Text style={[styles.badgeText, { color: z.color }]}>{z.hazard}</Text>
              </View>
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
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  name: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  sub: { fontSize: 11, color: '#737686', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
