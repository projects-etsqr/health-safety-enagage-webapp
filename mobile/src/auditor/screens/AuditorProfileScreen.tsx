import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { authService, EmployeeProfile } from '../../worker/services/authService';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { LEGAL_LINKS } from '../../constants/config';

export function AuditorProfileScreen({ navigation }: any) {
  const { user, logout, deleteAccount } = useAuth();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    authService.getMyEmployeeProfile().then((p) => { if (alive) setProfile(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const name = profile?.full_name || user?.name || 'Auditor';
  const empId = profile?.username || user?.employee_id || '—';
  const role = profile?.role_name || user?.role || 'Auditor';
  const dept = profile?.department_name || user?.department || '—';
  const email = profile?.email || '—';
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const openLink = (url: string) => { Linking.openURL(url).catch(() => {}); };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Sign out of the audit portal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={styles.verified}><Ionicons name="shield-checkmark" size={12} color="#FFFFFF" /><Text style={styles.verifiedText}>Verified Auditor</Text></View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role} · {dept}</Text>

          <View style={styles.detailGrid}>
            <Detail icon="hash" label="Employee ID" value={`#${empId}`} />
            <Detail icon="mail-outline" label="Email" value={email} />
          </View>
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.menu}>
          <Row icon="key-outline" tint="#2563EB" bg="#EFF6FF" label="Change Access PIN" onPress={() => navigation.navigate('ChangePassword')} />
          <Row icon="notifications-outline" tint="#8B5CF6" bg="#F5F3FF" label="Notifications" onPress={() => {}} />
          <Row icon="document-text-outline" tint="#16A34A" bg="#F0FDF4" label="Audit History" onPress={() => navigation.navigate('Audits')} />
        </View>

        <Text style={styles.section}>Legal</Text>
        <View style={styles.menu}>
          <Row icon="document-text-outline" tint="#2563EB" bg="#EFF6FF" label="Terms of Service" onPress={() => openLink(LEGAL_LINKS.TERMS)} />
          <Row icon="shield-checkmark-outline" tint="#16A34A" bg="#F0FDF4" label="Privacy Policy" onPress={() => openLink(LEGAL_LINKS.PRIVACY)} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Ehsera v4.8.2 (Build 1804)</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={deleteAccount}
      />
    </SafeAreaView>
  );
}

function Detail({ icon, label, value }: any) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={13} color="#64748B" />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function Row({ icon, tint, bg, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={tint} /></View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 20, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#EFF6FF' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#1D4ED8' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  verifiedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 10 },
  role: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
  detailGrid: { flexDirection: 'row', gap: 20, marginTop: 16 },
  detailItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  detailLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: '700', color: '#334155' },
  section: { fontSize: 14, fontWeight: '800', color: '#64748B', marginTop: 24, marginBottom: 12, paddingHorizontal: 4 },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EF4444', borderRadius: 14, height: 50, marginTop: 24 },
  logoutText: { fontSize: 14, color: '#EF4444', fontWeight: '800' },
  deleteAccountBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 6 },
  deleteAccountText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textDecorationLine: 'underline' },
  version: { textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 18 },
});
