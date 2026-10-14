import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Linking } from 'react-native';
import { Briefcase, Building2, IdCard, LogOut, ListChecks, ChevronRight, FileText, ShieldCheck } from 'lucide-react-native';
import type { ScreenProps } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import { Avatar } from '../../../components';
import { DeleteAccountModal } from '../../../components/DeleteAccountModal';
import { LEGAL_LINKS } from '../../../constants/config';

function roleLabel(role?: string): string {
  const r = (role || '').toLowerCase();
  if (r.includes('manager')) return 'HSE Manager';
  if (r === 'admin') return 'Administrator';
  return role || 'HSE Manager';
}

export function Tab_Profile({ setCurrentScreen, showToast }: ScreenProps) {
  const { user, logout, deleteAccount } = useAuth();
  const name = user?.name || 'HSE Manager';
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const signOut = () => {
    try { logout(); } catch { /* ignore */ }
    setCurrentScreen('login');
    showToast?.('Signed out successfully');
  };

  const openLink = (url: string) => { Linking.openURL(url).catch(() => {}); };

  const handleDeleteAccount = async (password: string) => {
    await deleteAccount(password);
    setCurrentScreen('login');
    showToast?.('Account deleted');
  };

  const info = [
    { icon: Briefcase, label: 'Role', value: roleLabel(user?.role) },
    ...(user?.department ? [{ icon: Building2, label: 'Department', value: user.department }] : []),
    ...(user?.site ? [{ icon: Building2, label: 'Site', value: user.site }] : []),
    ...(user?.employee_id ? [{ icon: IdCard, label: 'Employee ID', value: String(user.employee_id) }] : []),
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FC" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <View style={styles.userCard}>
          <Avatar name={name} size={72} />
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userRole}>{roleLabel(user?.role)}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{user?.site || user?.department || 'HSE Portal'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.badgeText, { color: '#388E3C' }]}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Management actions (manager-specific) */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.menu}>
          <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => setCurrentScreen('assigned_tasks')} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: '#E0F2F1' }]}><ListChecks size={20} color="#12B8A6" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Assigned Tasks</Text>
              <Text style={styles.actionDesc}>View supervisor tasks & worker responses</Text>
            </View>
            <ChevronRight size={18} color="#A0AEC0" />
          </TouchableOpacity>
        </View>

        {/* Account info */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.menu}>
          {info.map((m, i) => {
            const Icon = m.icon;
            return (
              <View key={m.label} style={[styles.infoItem, i === info.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconWrap}>
                    <Icon size={18} color="#63739B" />
                  </View>
                  <Text style={styles.infoLabel}>{m.label}</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={1}>{m.value}</Text>
              </View>
            );
          })}
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.menu}>
          <TouchableOpacity style={styles.actionRow} onPress={() => openLink(LEGAL_LINKS.TERMS)} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}><FileText size={20} color="#004AC6" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Terms of Service</Text>
            </View>
            <ChevronRight size={18} color="#A0AEC0" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => openLink(LEGAL_LINKS.PRIVACY)} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}><ShieldCheck size={20} color="#16A34A" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color="#A0AEC0" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut} activeOpacity={0.85}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out from HSE Portal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Ehsera v2.4.1 (Build 1804)</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FC' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0B1C30' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  userCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center',
    marginTop: 8, marginBottom: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
  },
  userName: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginTop: 14 },
  userRole: { fontSize: 12, color: '#737686', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#004AC6' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#737686', marginBottom: 12, paddingHorizontal: 4 },
  menu: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8, marginBottom: 24,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
  },
  infoItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FC' },
  infoLabel: { fontSize: 13, color: '#63739B', fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#0B1C30', maxWidth: '50%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  actionDesc: { fontSize: 11, color: '#63739B', marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 16, paddingVertical: 14, marginBottom: 32,
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  deleteAccountBtn: { alignItems: 'center', justifyContent: 'center', marginBottom: 16, paddingVertical: 6 },
  deleteAccountText: { fontSize: 12, fontWeight: '600', color: '#A8AFBF', textDecorationLine: 'underline' },
  versionText: { fontSize: 11, color: '#A8AFBF', textAlign: 'center' },
});
