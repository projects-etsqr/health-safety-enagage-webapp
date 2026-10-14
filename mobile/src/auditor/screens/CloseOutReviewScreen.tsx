import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verificationService, CloseOutIncident } from '../services/verificationService';
import { KeyboardAvoider, SafeAreaScreen } from '../../components/layout/KeyboardAvoider';

/** One completeness check the auditor validates before signing off. */
function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string | null }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color={ok ? '#16A34A' : '#EF4444'}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {detail ? <Text style={styles.checkDetail} numberOfLines={3}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export function CloseOutReviewScreen({ navigation }: any) {
  const [rows, setRows] = useState<CloseOutIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState<CloseOutIncident | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    verificationService.closeOutList()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await verificationService.verifyCloseOut(target.id, notes.trim() || undefined);
      setTarget(null);
      setNotes('');
      load();
    } catch (e: any) {
      Alert.alert('Sign-Off Failed', e?.response?.data?.detail || 'Could not record the review.');
    } finally {
      setSaving(false);
    }
  };

  const pending = rows.filter(r => !r.auditor_verified_at).length;

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Close-Out Review</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryVal}>{pending}</Text>
        <Text style={styles.summaryLbl}>closed incidents awaiting audit sign-off</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No incidents are ready for close-out review.</Text>
        ) : (
          rows.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{r.reference}</Text>
                {r.auditor_verified_at ? (
                  <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.badgeText, { color: '#16A34A' }]}>SIGNED OFF</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: '#FFF7ED' }]}>
                    <Text style={[styles.badgeText, { color: '#F97316' }]}>PENDING</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardSub}>
                {r.incident_type || '—'}{r.severity ? ` · ${r.severity}` : ''}
              </Text>

              <View style={styles.checks}>
                <Check
                  label="Investigation completed"
                  ok={String(r.investigation_status || '').toLowerCase() === 'completed'}
                  detail={r.investigation_status}
                />
                <Check label="5-Why analysis recorded" ok={r.has_five_why} />
                <Check label="Closure notes present" ok={!!r.closure_notes} detail={r.closure_notes} />
                <Check
                  label="Lessons communicated to teams"
                  ok={String(r.communicated_to_teams || '').toLowerCase() === 'yes'}
                />
                <Check label="Manager signature" ok={!!r.manager_signature} detail={r.manager_signature} />
              </View>

              {r.verification_notes ? (
                <Text style={styles.priorNote}>Audit note: {r.verification_notes}</Text>
              ) : null}

              {!r.auditor_verified_at && (
                <TouchableOpacity
                  style={styles.signBtn}
                  onPress={() => { setTarget(r); setNotes(''); }}
                >
                  <Text style={styles.signBtnText}>Add Audit Sign-Off</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={target != null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sign Off {target?.reference}</Text>
            <Text style={styles.sheetSub}>
              Record what you validated about this close-out. Read-only review — this does not
              reopen or alter the incident.
            </Text>

            <Text style={styles.fieldLabel}>AUDIT SIGN-OFF NOTE</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Investigation complete, lessons not yet communicated — flagged"
              placeholderTextColor="#94A3B8"
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submit} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.confirmBtnText}>Record Sign-Off</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoider>
      </Modal>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  summary: { paddingHorizontal: 20, paddingBottom: 12 },
  summaryVal: { fontSize: 28, fontWeight: '800', color: '#004AC6' },
  summaryLbl: { fontSize: 12, fontWeight: '600', color: '#737686', marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  cardSub: { fontSize: 12, color: '#737686', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  checks: { marginTop: 12, gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkLabel: { fontSize: 12, fontWeight: '600', color: '#0B1C30' },
  checkDetail: { fontSize: 11, color: '#737686', marginTop: 1 },
  priorNote: {
    fontSize: 11, color: '#4A5568', marginTop: 12,
    backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8,
  },
  signBtn: {
    marginTop: 14, height: 40, borderRadius: 10, backgroundColor: '#004AC6',
    alignItems: 'center', justifyContent: 'center',
  },
  signBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0B1C30' },
  sheetSub: { fontSize: 12, color: '#737686', marginTop: 6, lineHeight: 17 },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: '#737686',
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, minHeight: 90, fontSize: 14, color: '#0B1C30', textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#737686' },
  confirmBtn: {
    flex: 1.5, height: 48, borderRadius: 12, backgroundColor: '#004AC6',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
