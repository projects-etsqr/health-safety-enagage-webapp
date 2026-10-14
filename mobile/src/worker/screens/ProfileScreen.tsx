import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, TextInput, Linking,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { Toast, ToastKind } from '../components/feedback/Toast';
import { authService, EmployeeProfile } from '../services/authService';
import { sosService } from '../services/sosService';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { LEGAL_LINKS } from '../../constants/config';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, deleteAccount } = useAuth();
  const [sosLoading, setSosLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const { change: changePhoto, uploading } = useProfilePhoto();
  const [photo, setPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    let alive = true;
    // /employees/me is the authoritative record for the signed-in user. Use it for the
    // whole header (name/role/department), not just the photo — relying only on the login
    // `user` object showed a stale/placeholder identity ("Alex Safety") after re-login.
    authService
      .getMyEmployeeProfile()
      .then(p => { if (alive) { setPhoto(p.photo); setProfile(p); } })
      .catch(() => { /* falls back to the login user / placeholder avatar */ });
    return () => { alive = false; };
  }, []);

  const onEditPhoto = useCallback(() => {
    changePhoto(res => {
      if (res.ok) {
        setPhoto(res.photo);
        setToast({ msg: res.photo ? 'Photo updated' : 'Photo removed', kind: 'success' });
      } else {
        setToast({ msg: res.error, kind: 'error' });
      }
    }, !!photo);
  }, [changePhoto, photo]);

  const name       = profile?.full_name       || user?.name       || 'Worker';
  const empId      = profile?.username         || user?.employee_id || '—';
  const role       = profile?.role_name        || user?.role        || 'Worker';
  const site       = user?.site                || 'Site';
  const department = profile?.department_name  || user?.department  || '—';

  const handleSOS = () => {
    Alert.alert(
      '🚨 Emergency SOS',
      'This will immediately alert your supervisors and the safety team.\n\nOnly use in a genuine emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS NOW',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              const res = await sosService.triggerSOS({ message: 'Emergency assistance required' });
              Alert.alert(
                '✅ SOS Dispatched',
                `Your emergency alert has been sent.\nRef: ${res.sos_ref}\n\nStay calm — help is on the way.`,
              );
            } catch {
              Alert.alert('Failed to Send', 'Could not reach the server. Please call emergency services directly.');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleDeleteAccount = async (password: string) => {
    await deleteAccount(password);
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => setToast({ msg: 'Could not open link', kind: 'error' }));
  };

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>{name}'s Profile</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon emoji="🔔" style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar as any} />
            ) : (
              <View style={[styles.avatar as any, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editBtn} onPress={onEditPhoto} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Icon name="edit-2" size={15} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>Verified Professional</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.roleSub}>{role} • {department}</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Icon name="map-pin" size={12} color="#475569" style={styles.detailItemIcon} />
              <Text style={styles.detailText}>{site}</Text>
            </View>
            <View style={styles.detailItem}>
              <Icon name="hash" size={12} color="#475569" style={styles.detailItemIcon} />
              <Text style={styles.detailText}>Emp ID: #{empId}</Text>
            </View>
          </View>
          <View style={[styles.detailItem, { marginTop: 8 }]}>
            <Icon name="calendar" size={11} color="#64748B" style={styles.detailItemIcon} />
            <Text style={styles.joinedText}>Joined Sept 2021</Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('FullBio')}>
              <Text style={styles.btnPrimaryText}>View Full Bio</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety Performance */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Safety Performance</Text>
            <View style={styles.performanceBadge}>
              <Text style={styles.performanceBadgeText}>+4% Monthly</Text>
            </View>
          </View>
          <Text style={styles.scoreText}>98.2</Text>
          <Text style={styles.scoreLabel}>Compliance Score Rating</Text>

          {/* Simple Chart Representation */}
          <View style={styles.chartContainer}>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 60 }]} />
              <Text style={styles.chartLabel}>JAN</Text>
            </View>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 68 }]} />
              <Text style={styles.chartLabel}>FEB</Text>
            </View>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 75 }]} />
              <Text style={styles.chartLabel}>MAR</Text>
            </View>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 82 }]} />
              <Text style={styles.chartLabel}>APR</Text>
            </View>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 88 }]} />
              <Text style={styles.chartLabel}>MAY</Text>
            </View>
            <View style={styles.barGroup}>
              <View style={[styles.chartBar, { height: 95, backgroundColor: '#2563EB' }]} />
              <Text style={styles.chartLabel}>JUN</Text>
              <Text style={styles.chartValueLabel}>98</Text>
            </View>
          </View>
        </View>

        {/* My Achievements */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>My Achievements</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.achieveRow}>
            <View style={styles.achieveItem}>
              <View style={[styles.achieveIconBox, { backgroundColor: '#E8F5E9' }]}>
                <Icon emoji="🏆" style={styles.achieveIcon} />
              </View>
              <Text style={styles.achieveTitle}>Safety Lead</Text>
              <Text style={styles.achieveDesc}>500 Days Clean</Text>
            </View>

            <View style={styles.achieveItem}>
              <View style={[styles.achieveIconBox, { backgroundColor: '#F3E5F5' }]}>
                <Icon emoji="⚡" style={styles.achieveIcon} />
              </View>
              <Text style={styles.achieveTitle}>First Responder</Text>
              <Text style={styles.achieveDesc}>L3 Certified</Text>
            </View>

            <View style={styles.achieveItem}>
              <View style={[styles.achieveIconBox, { backgroundColor: '#E3F2FD' }]}>
                <Icon emoji="⚙️" style={styles.achieveIcon} />
              </View>
              <Text style={styles.achieveTitle}>Hazard Guru</Text>
              <Text style={styles.achieveDesc}>100 Inspections</Text>
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Icon emoji="📞" style={styles.emergencyIcon} />
            <Text style={styles.emergencyTitle}>Emergency Contact</Text>
          </View>
          <Text style={styles.emergencyName}>Sarah Safety (Spouse)</Text>
          <Text style={styles.emergencyPhone}>+1 (555) 012-3456</Text>

          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
            {sosLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.inlineBtnContent}>
                <Icon name="phone" size={15} color="#FFFFFF" style={styles.inlineBtnIcon} />
                <Text style={styles.sosBtnText}>SOS Call</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Completed Training & Certifications */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Completed Training & Certifications</Text>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search certifications..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { flex: 2 }]}>Course Name</Text>
              <Text style={styles.tableCol}>Completion Date</Text>
              <Text style={styles.tableCol}>Expiry Date</Text>
            </View>

            {/* Row 1 */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <View style={styles.tableIconBox}><Icon emoji="🧯" style={styles.tableIcon} /></View>
                <View>
                  <Text style={styles.courseName}>Advanced Fire Safety</Text>
                  <Text style={styles.courseCode}>HSE-7021</Text>
                </View>
              </View>
              <Text style={styles.tableCol}>May 12, 2023</Text>
              <Text style={styles.tableCol}>May 12, 2025</Text>
            </View>

            {/* Row 2 */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <View style={styles.tableIconBox}><Icon emoji="🩹" style={styles.tableIcon} /></View>
                <View>
                  <Text style={styles.courseName}>Emergency First Aid</Text>
                  <Text style={styles.courseCode}>HSE-1105</Text>
                </View>
              </View>
              <Text style={styles.tableCol}>Jan 05, 2024</Text>
              <Text style={styles.tableCol}>Jan 05, 2026</Text>
            </View>

            {/* Row 3 */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <View style={styles.tableIconBox}><Icon emoji="🔧" style={styles.tableIcon} /></View>
                <View>
                  <Text style={styles.courseName}>Work at Height</Text>
                  <Text style={styles.courseCode}>HSE-4482</Text>
                </View>
              </View>
              <Text style={styles.tableCol}>Nov 20, 2022</Text>
              <Text style={[styles.tableCol, { color: '#EF4444' }]}>Nov 20, 2024</Text>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.card}>
          <Text style={[styles.cardSectionTitle, { marginBottom: 12 }]}>Legal</Text>
          <TouchableOpacity style={styles.legalRow} onPress={() => openLink(LEGAL_LINKS.TERMS)} activeOpacity={0.7}>
            <View style={styles.inlineBtnContent}>
              <Icon name="file-text" size={16} color="#475569" style={styles.inlineBtnIcon} />
              <Text style={styles.legalRowText}>Terms of Service</Text>
            </View>
            <Icon name="external-link" size={15} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.legalRow, { borderBottomWidth: 0 }]} onPress={() => openLink(LEGAL_LINKS.PRIVACY)} activeOpacity={0.7}>
            <View style={styles.inlineBtnContent}>
              <Icon name="shield" size={16} color="#475569" style={styles.inlineBtnIcon} />
              <Text style={styles.legalRowText}>Privacy Policy</Text>
            </View>
            <Icon name="external-link" size={15} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Settings / Logs */}
        <TouchableOpacity style={styles.changePasswordBtn} onPress={() => navigation.navigate('ChangePassword')}>
          <View style={styles.inlineBtnContent}>
            <Icon name="key" size={15} color="#475569" style={styles.inlineBtnIcon} />
            <Text style={styles.changePasswordText}>Change Access PIN</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteModalVisible(true)}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      <Toast
        message={toast?.msg ?? null}
        kind={toast?.kind}
        onHide={() => setToast(null)}
      />

      <DeleteAccountModal
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerIcon: {
    fontSize: 22,
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#EFF6FF',
  },
  avatarFallback: {
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  editBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editIcon: {
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItemIcon: {
    marginRight: 4,
  },
  inlineBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnIcon: {
    marginRight: 6,
  },
  joinedText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    height: 40,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  performanceBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  performanceBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  barGroup: {
    alignItems: 'center',
    width: '14%',
  },
  chartBar: {
    width: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 6,
  },
  chartLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
  },
  chartValueLabel: {
    position: 'absolute',
    top: -20,
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  achieveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  achieveItem: {
    width: '30%',
    alignItems: 'center',
  },
  achieveIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achieveIcon: {
    fontSize: 22,
  },
  achieveTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  achieveDesc: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  emergencyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  emergencyIcon: {
    fontSize: 18,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  emergencyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  emergencyPhone: {
    fontSize: 24,
    fontWeight: '800',
    color: '#991B1B',
    marginVertical: 6,
  },
  sosBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 14,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  table: {
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableCol: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableIcon: {
    fontSize: 12,
  },
  courseName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  courseCode: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  changePasswordBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  changePasswordText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '700',
  },
  deleteAccountBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  deleteAccountText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  legalRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
