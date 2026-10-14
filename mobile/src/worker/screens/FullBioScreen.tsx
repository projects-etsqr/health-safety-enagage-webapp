import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, Alert, Image,
} from 'react-native';
import { Icon } from '../components/display/Icon';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Toast, ToastKind } from '../components/feedback/Toast';
import { DatePickerModal } from '../components/inputs/DatePickerModal';
import { Colors } from '../theme/colors';
import { authService, EmployeeProfile } from '../services/authService';

/** Renders a date as e.g. "12 Mar 2021"; falls back to the raw value if unparseable. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={15} color="#64748B" style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !value && styles.rowValueEmpty]} numberOfLines={2}>
        {value || 'Not recorded'}
      </Text>
    </View>
  );
}

/** Accepts YYYY-MM-DD and rejects impossible dates (e.g. 2024-02-31). */
function isValidDob(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  return dt <= new Date();
}

export default function FullBioScreen({ navigation }: any) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dobDraft, setDobDraft] = useState('');
  const [genderDraft, setGenderDraft] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await authService.getMyEmployeeProfile());
    } catch (err: any) {
      setError(
        err?.response?.status === 404
          ? 'No employee record is linked to your account.'
          : 'Could not load your profile. Pull down to retry.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEditing = () => {
    setDobDraft(profile?.date_of_birth?.slice(0, 10) ?? '');
    setGenderDraft(profile?.gender ?? null);
    setEditing(true);
  };

  const save = async () => {
    const dob = dobDraft.trim();
    if (dob && !isValidDob(dob)) {
      Alert.alert('Invalid date', 'Enter your date of birth as YYYY-MM-DD, e.g. 1991-04-17.');
      return;
    }
    setSaving(true);
    try {
      const updated = await authService.updateMyEmployeeProfile({
        date_of_birth: dob || null,
        gender: genderDraft,
      });
      setProfile(updated);
      setEditing(false);
      setToast({ msg: 'Profile updated', kind: 'success' });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail?.[0]?.msg ||
        err?.response?.data?.detail ||
        'Please check your connection and try again.';
      setToast({ msg: detail, kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.full_name || '?')
    .split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ScreenLayout bg="#F8FAFC">
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Bio</Text>
        {profile && !editing ? (
          <TouchableOpacity style={styles.headerBtn} onPress={startEditing}>
            <Icon name="edit-2" size={19} color="#2563EB" />
          </TouchableOpacity>
        ) : profile && editing ? (
          <TouchableOpacity style={styles.headerBtnWide} onPress={() => setEditing(false)} disabled={saving}>
            <Text style={[styles.cancelText, saving && styles.disabledText]} numberOfLines={1}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {isLoading && !profile ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 48 }} />
      ) : error && !profile ? (
        <ScrollView
          contentContainerStyle={styles.errorWrap}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
        >
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={load} tintColor={Colors.primary} />
          }
        >
          <View style={styles.card}>
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.name}>{profile?.full_name || 'Unknown'}</Text>
            <Text style={styles.subtitle}>
              {[profile?.role_name, profile?.department_name].filter(Boolean).join(' • ') || '—'}
            </Text>
            {!!profile?.active_status && (
              <View
                style={[
                  styles.statusPill,
                  profile.active_status.toLowerCase() === 'active'
                    ? styles.statusActive
                    : styles.statusInactive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    profile.active_status.toLowerCase() === 'active'
                      ? styles.statusTextActive
                      : styles.statusTextInactive,
                  ]}
                >
                  {profile.active_status}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.card}>
            <Row icon="briefcase" label="Role" value={profile?.role_name ?? null} />
            <Row icon="grid" label="Department" value={profile?.department_name ?? null} />
            <Row icon="user-check" label="Manager" value={profile?.manager_name ?? null} />
            <Row icon="file-text" label="Type" value={profile?.employment_type ?? null} />
            <Row icon="clock" label="Shift Pattern" value={profile?.shift_pattern ?? null} />
            <Row
              icon="calendar"
              label="Started"
              value={formatDate(profile?.employment_start_date ?? null)}
            />
            <Row
              icon="shield"
              label="Inducted"
              value={formatDate(profile?.induction_date ?? null)}
            />
          </View>

          <Text style={styles.sectionTitle}>Personal</Text>
          <View style={styles.card}>
            <Row icon="hash" label="Employee ID" value={profile ? `#${profile.employee_id}` : null} />
            <Row icon="user" label="Username" value={profile?.username ?? null} />
            <Row icon="mail" label="Email" value={profile?.email ?? null} />

            {editing ? (
              <>
                <View style={styles.editRow}>
                  <Icon name="calendar" size={15} color="#64748B" style={styles.rowIcon} />
                  <Text style={styles.rowLabel}>Date of Birth</Text>
                  <TouchableOpacity
                    style={styles.dateField}
                    onPress={() => setPickerOpen(true)}
                    disabled={saving}
                  >
                    <Text style={[styles.dateFieldText, !dobDraft && styles.dateFieldPlaceholder]}>
                      {dobDraft ? formatDate(dobDraft) : 'Select date'}
                    </Text>
                    <Icon name="chevron-down" size={15} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <View style={styles.editRow}>
                  <Icon name="users" size={15} color="#64748B" style={styles.rowIcon} />
                  <Text style={styles.rowLabel}>Gender</Text>
                  <View style={styles.chipRow}>
                    {['M', 'F'].map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.chip, genderDraft === g && styles.chipActive]}
                        onPress={() => setGenderDraft(genderDraft === g ? null : g)}
                        disabled={saving}
                      >
                        <Text style={[styles.chipText, genderDraft === g && styles.chipTextActive]}>
                          {g === 'M' ? 'Male' : 'Female'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Row icon="calendar" label="Date of Birth" value={formatDate(profile?.date_of_birth ?? null)} />
                <Row
                  icon="users"
                  label="Gender"
                  value={profile?.gender === 'M' ? 'Male' : profile?.gender === 'F' ? 'Female' : null}
                />
              </>
            )}
          </View>

          {editing && (
            <Text style={styles.editHint}>
              Role, department and manager are managed by your organisation and can't be changed here.
            </Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <DatePickerModal
        visible={pickerOpen}
        value={dobDraft || null}
        title="Date of birth"
        onCancel={() => setPickerOpen(false)}
        onConfirm={(iso) => { setDobDraft(iso); setPickerOpen(false); }}
      />

      <Toast
        message={toast?.msg ?? null}
        kind={toast?.kind}
        onHide={() => setToast(null)}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    alignItems: 'stretch',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#EFF6FF',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  statusActive: { backgroundColor: '#E8F5E9' },
  statusInactive: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextActive: { color: '#2E7D32' },
  statusTextInactive: { color: '#C62828' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  rowIcon: {
    marginRight: 10,
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    width: 110,
  },
  rowValue: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
  },
  rowValueEmpty: {
    color: '#94A3B8',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  // Wider than headerBtn so "Cancel" fits on one line.
  headerBtnWide: {
    minWidth: 56,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
  disabledText: {
    color: '#94A3B8',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dateFieldText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateFieldPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  chipRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#93B4F5',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  editHint: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: -8,
    marginBottom: 20,
    paddingHorizontal: 4,
    lineHeight: 17,
  },
  errorWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  retryText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 10,
  },
});
