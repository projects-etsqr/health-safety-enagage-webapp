import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { complianceService } from '../services/complianceService';
import type { DashboardAlert } from '../types/compliance.types';

const TYPE_ICON: Record<string, { icon: any; color: string }> = {
  critical: { icon: 'alert-circle', color: '#EF4444' },
  danger:   { icon: 'alert-circle', color: '#EF4444' },
  warning:  { icon: 'warning', color: '#F97316' },
  info:     { icon: 'information-circle', color: '#004AC6' },
  success:  { icon: 'checkmark-circle', color: '#16A34A' },
};

export function NotificationCenterScreen({ navigation }: any) {
  const [list, setList] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    complianceService.getAlerts()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && list.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>No notifications right now — all clear.</Text>
        ) : (
          list.map((item) => {
            const meta = TYPE_ICON[(item.type || '').toLowerCase()] || TYPE_ICON.info;
            const body = [item.worker_name, item.zone].filter(Boolean).join(' · ');
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.message}</Text>
                  </View>
                  <Text style={styles.time}>{item.time_ago}</Text>
                </View>
                {!!body && <Text style={styles.body}>{body}</Text>}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30', flex: 1 },
  time: { fontSize: 11, color: '#A8AFBF' },
  body: { fontSize: 13, color: '#434655', lineHeight: 18, marginLeft: 24 },
});
