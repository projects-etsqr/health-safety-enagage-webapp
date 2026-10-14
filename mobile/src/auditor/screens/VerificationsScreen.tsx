import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  verificationService, PermitToVerify, HazardToVerify, VERIFICATION_RESULTS,
} from '../services/verificationService';
import { KeyboardAvoider, SafeAreaScreen } from '../../components/layout/KeyboardAvoider';

type Tab = 'permits' | 'hazards';

export function VerificationsScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('permits');
  const [permits, setPermits] = useState<PermitToVerify[]>([]);
  const [hazards, setHazards] = useState<HazardToVerify[]>([]);
  const [loading, setLoading] = useState(true);

  // Verification sheet
  const [target, setTarget] = useState<{ kind: Tab; id: number; label: string } | null>(null);
  const [result, setResult] = useState<string>('valid');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, h] = await Promise.all([
      verificationService.permitsToVerify().catch(() => []),
      verificationService.hazardsToVerify().catch(() => []),
    ]);
    setPermits(p);
    setHazards(h);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openVerify = (kind: Tab, id: number, label: string) => {
    setTarget({ kind, id, label });
    setResult('valid');
    setNotes('');
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (target.kind === 'permits') {
        await verificationService.verifyPermit(target.id, result, notes.trim() || undefined);
      } else {
        await verificationService.verifyHazard(target.id, notes.trim() || undefined);
      }
      setTarget(null);
      load();
    } catch (e: any) {
      Alert.alert('Verification Failed', e?.response?.data?.detail || 'Could not record the verification.');
    } finally {
      setSaving(false);
    }
  };

  const pendingPermits = permits.filter(p => !p.auditor_verified_at).length;
  const pendingHazards = hazards.filter(h => !h.auditor_verified_at).length;

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifications</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'permits' && styles.tabActive]}
          onPress={() => setTab('permits')}
        >
          <Text style={[styles.tabText, tab === 'permits' && styles.tabTextActive]}>
            Permits ({pendingPermits})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'hazards' && styles.tabActive]}
          onPress={() => setTab('hazards')}
        >
          <Text style={[styles.tabText, tab === 'hazards' && styles.tabTextActive]}>
            Unsafe Acts ({pendingHazards})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#004AC6']} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && permits.length === 0 && hazards.length === 0 ? (
          <ActivityIndicator color="#004AC6" style={{ marginTop: 30 }} />
        ) : tab === 'permits' ? (
          permits.length === 0
            ? <Text style={styles.empty}>No permits awaiting verification.</Text>
            : permits.map(p => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{p.permit_ref || `PTW-${p.id}`}</Text>
                    {p.auditor_verified_at ? (
                      <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.badgeText, { color: '#16A34A' }]}>VERIFIED</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, { backgroundColor: '#FFF7ED' }]}>
                        <Text style={[styles.badgeText, { color: '#F97316' }]}>PENDING</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {p.work_description || 'Permit to Work'}
                  </Text>
                  {!p.auditor_verified_at && (
                    <TouchableOpacity
                      style={styles.verifyBtn}
                      onPress={() => openVerify('permits', p.id, p.permit_ref || `PTW-${p.id}`)}
                    >
                      <Text style={styles.verifyBtnText}>Verify Permit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
        ) : (
          hazards.length === 0
            ? <Text style={styles.empty}>No unsafe acts awaiting verification.</Text>
            : hazards.map(h => (
                <View key={h.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{h.hazard_name || `Hazard ${h.id}`}</Text>
                    {h.auditor_verified_at ? (
                      <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.badgeText, { color: '#16A34A' }]}>VERIFIED</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, { backgroundColor: '#FFF7ED' }]}>
                        <Text style={[styles.badgeText, { color: '#F97316' }]}>PENDING</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub}>
                    {h.severity || '—'}
                    {h.register_status ? ` · ${h.register_status}` : ''}
                  </Text>
                  {h.controls ? <Text style={styles.cardSub}>Controls: {h.controls}</Text> : null}
                  {!h.auditor_verified_at && (
                    <TouchableOpacity
                      style={styles.verifyBtn}
                      onPress={() => openVerify('hazards', h.id, h.hazard_name || `Hazard ${h.id}`)}
                    >
                      <Text style={styles.verifyBtnText}>Verify Unsafe Act</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
        )}
      </ScrollView>

      <Modal visible={target != null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Verify {target?.label}</Text>

            {target?.kind === 'permits' && (
              <>
                <Text style={styles.fieldLabel}>VERIFICATION RESULT</Text>
                <View style={styles.pillRow}>
                  {VERIFICATION_RESULTS.map(r => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.pill, result === r.value && styles.pillActive]}
                      onPress={() => setResult(r.value)}
                    >
                      <Text style={[styles.pillText, result === r.value && styles.pillTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>VERIFICATION NOTES</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="What did you check, and what did you find?"
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
                  : <Text style={styles.confirmBtnText}>Record Verification</Text>}
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
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  tab: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  tabActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#0B1C30' },
  tabTextActive: { color: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#737686', marginTop: 30 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  cardSub: { fontSize: 12, color: '#737686', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  verifyBtn: {
    marginTop: 12, height: 40, borderRadius: 10, backgroundColor: '#004AC6',
    alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0B1C30' },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: '#737686',
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  pillActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  pillText: { fontSize: 13, fontWeight: '700', color: '#0B1C30' },
  pillTextActive: { color: '#FFFFFF' },
  notesInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, minHeight: 80, fontSize: 14, color: '#0B1C30', textAlignVertical: 'top',
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
