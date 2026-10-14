import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { LEGAL_LINKS } from '../constants/config';

interface Props {
  navigation: any;
}

export function ProfileScreen({ navigation }: Props) {
  const { user, logout, deleteAccount } = useAuth();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const openLink = (url: string) => { Linking.openURL(url).catch(() => {}); };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from the portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <View style={styles.userCard}>
          <Avatar name={user?.name ?? 'Supervisor'} size={72} />
          <Text style={styles.userName}>{user?.name ?? 'Site Supervisor'}</Text>
          <Text style={styles.userRole}>HSE Site Supervisor</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Terminal 4</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.badgeText, { color: '#388E3C' }]}>Verified</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <Text style={styles.sectionTitle}>Account & Configuration</Text>

        <View style={styles.menu}>
          {/* Menu Item 1 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SiteMonitoringOverview')}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="stats-chart-outline" size={20} color="#004AC6" />
              </View>
              <Text style={styles.menuName}>Site Monitoring Overview</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Menu Item 2 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('AppSettings')}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="settings-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.menuName}>App Configuration</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Menu Item 3 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ReportsAnalytics')}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="bar-chart-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.menuName}>Reports & Analytics</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Menu Item 4 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('RiskManagement')}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="shield-alert-outline" size={20} color="#F97316" />
              </View>
              <Text style={styles.menuName}>Risk Observation</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Menu Item 5 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DocumentManagement')}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="folder-open-outline" size={20} color="#DB2777" />
              </View>
              <Text style={styles.menuName}>Document Library</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => openLink(LEGAL_LINKS.TERMS)}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="document-text-outline" size={20} color="#004AC6" />
              </View>
              <Text style={styles.menuName}>Terms of Service</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={Colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}
            onPress={() => openLink(LEGAL_LINKS.PRIVACY)}
            activeOpacity={0.8}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.menuName}>Privacy Policy</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out from Site Portal</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={() => setDeleteModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>Ehsera v2.4.1 (Build 1804)</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={deleteAccount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1C30',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B1C30',
    marginTop: 14,
  },
  userRole: {
    fontSize: 12,
    color: '#737686',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#004AC6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#737686',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1C30',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 32,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  deleteAccountBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 6,
  },
  deleteAccountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A8AFBF',
    textDecorationLine: 'underline',
  },
  versionText: {
    fontSize: 11,
    color: '#A8AFBF',
    textAlign: 'center',
  },
});
