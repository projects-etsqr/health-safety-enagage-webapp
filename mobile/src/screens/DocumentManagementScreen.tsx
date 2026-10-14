import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';

interface Policy { id: string; title: string; category: string; owner: string; status: string; }

export function DocumentManagementScreen({ navigation }: any) {
  const [docs, setDocs] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get('/policys/')
      .then((r: any) => {
        const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
        setDocs(items.map((p: any) => ({
          id: String(p.id),
          title: p.policy_name || 'Policy Document',
          category: p.category || '',
          owner: p.owner || '',
          status: p.status || '',
        })));
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Library</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && docs.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : docs.length === 0 ? (
          <Text style={styles.empty}>No documents available.</Text>
        ) : (
          docs.map((d) => (
            <View key={d.id} style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="document-text" size={20} color="#004AC6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{d.title}</Text>
                <Text style={styles.sub}>{[d.category, d.owner].filter(Boolean).join(' · ')}</Text>
              </View>
              {!!d.status && (
                <View style={[styles.badge, { backgroundColor: d.status === 'Active' ? '#F0FDF4' : '#F1F5F9' }]}>
                  <Text style={[styles.badgeText, { color: d.status === 'Active' ? '#16A34A' : '#64748B' }]}>{d.status}</Text>
                </View>
              )}
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  sub: { fontSize: 11, color: '#737686', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
