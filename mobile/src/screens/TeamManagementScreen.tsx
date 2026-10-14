import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components';
import { teamProvisioningService, TeamMember } from '../services/teamProvisioningService';

export function TeamManagementScreen({ navigation }: any) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    teamProvisioningService.members()
      .then((r) => setMembers(r.items))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Roster Management</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
      >
        {loading && members.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : members.length === 0 ? (
          <Text style={styles.empty}>No workers in your team yet.</Text>
        ) : (
          members.map((w) => (
            <View key={w.id} style={styles.card}>
              <View style={styles.left}>
                <Avatar name={w.name} size={42} />
                <View style={styles.meta}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={styles.role}>{w.email} · {w.username}</Text>
                </View>
              </View>
              <View style={styles.right}>
                <View style={[styles.badge, { backgroundColor: w.active ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Text style={[styles.badgeText, { color: w.active ? '#16A34A' : '#EF4444' }]}>
                    {w.active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EEF2FF', borderRadius: 12, paddingVertical: 12, marginBottom: 16,
  },
  addBtnText: { color: '#004AC6', fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30, paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  meta: { justifyContent: 'center', flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  role: { fontSize: 11, color: '#737686', marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
