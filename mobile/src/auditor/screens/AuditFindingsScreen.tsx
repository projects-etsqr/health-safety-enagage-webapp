/**
 * Step 10 CLOSE · findings tracked out.
 *
 * "Verifies effectiveness at 30, 60 and 90 days. Confirms findings were
 * genuinely closed, not just marked closed."
 *
 * The distinction between those two is the entire screen. A corrective action
 * being marked Completed is a claim made by whoever owned it; verification is
 * the auditor standing in the same place and checking the fix is holding. So the
 * only two answers here are "checked on site, holding" and "not holding" — and
 * the second one reopens both the finding and its corrective action.
 *
 * Opened with an `auditId` it tracks one audit out. Opened without one it is the
 * auditor's whole 30/60/90 queue across every audit they hold, because chasing
 * effectiveness one audit at a time is how the tail gets forgotten.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  RefreshControl, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, CLASSIFICATION_META, Classification, Finding,
} from '../services/auditService';
import { useGeoTag } from '../../worker/hooks/useGeoTag';
import {
  Banner, C, Card, ClassificationChip, Empty, PrimaryButton, GhostButton,
  ScreenHeader, SectionLabel,
} from '../components';
import { KeyboardAvoider, SafeAreaScreen } from '../../components/layout/KeyboardAvoider';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
}

/** Days since the finding was raised — the 30/60/90 checkpoint it has reached. */
function checkpoint(f: Finding): { label: string; overdue: boolean } | null {
  if (!f.corrective_action_due) return null;
  const due = new Date(f.corrective_action_due);
  const days = Math.round((Date.now() - due.getTime()) / 86400000);
  if (days > 0) return { label: `${days}d overdue`, overdue: true };
  return { label: `due in ${Math.abs(days)}d`, overdue: false };
}

export function AuditFindingsScreen({ route, navigation }: any) {
  const auditId: number | undefined = route.params?.auditId;
  const single = auditId != null;

  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const [verifying, setVerifying] = useState<Finding | null>(null);
  const [effective, setEffective] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');

  const { geo } = useGeoTag();

  const load = useCallback(async () => {
    try {
      if (single) {
        const [a, f] = await Promise.all([
          auditService.get(auditId!),
          auditService.findings(auditId!),
        ]);
        setAudit(a);
        setFindings(f);
      } else {
        setFindings(await auditService.openFindings());
      }
    } catch (e: any) {
      Alert.alert('Could not load findings', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auditId, single]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const ncs = useMemo(
    () => findings.filter((f) => CLASSIFICATION_META[f.classification].severity >= 2),
    [findings],
  );
  const open = useMemo(
    () => ncs.filter((f) => f.status !== 'verified' && f.status !== 'closed'),
    [ncs],
  );
  const shown = filter === 'open' ? open : findings;

  const submitVerification = async () => {
    if (!verifying || effective === null) return;
    if (!effective && !notes.trim()) {
      Alert.alert('What is not holding?', 'Record what you found, so the action can be reopened against something specific.');
      return;
    }
    setBusy(true);
    try {
      const res = await auditService.verifyFinding(verifying.audit_id, verifying.id, {
        effective,
        verification_notes: notes.trim() || undefined,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
      });
      if (res.queued) Alert.alert('Saved offline', 'The verification will sync when you have signal.');
      setVerifying(null);
      setEffective(null);
      setNotes('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not verify', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const closeAudit = async () => {
    if (!single) return;
    setBusy(true);
    try {
      setAudit(await auditService.close(auditId!));
      Alert.alert('Audit closed', 'Every corrective action it raised has been verified effective.');
      await load();
    } catch (e: any) {
      Alert.alert('Cannot close yet', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaScreen style={styles.root} edges={['top']}>
      <ScreenHeader
        title={single ? 'Track findings out' : 'Effectiveness queue'}
        subtitle={single ? `Step 10 · ${audit?.audit_ref ?? ''}` : '30 / 60 / 90-day checks'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          keyboardShouldPersistTaps="handled"
        >
          <Banner
            tone={open.length ? 'warn' : 'ok'}
            icon={open.length ? 'time' : 'checkmark-done'}
            title={
              open.length
                ? `${open.length} finding${open.length === 1 ? '' : 's'} still to verify`
                : 'Everything verified'
            }
            text={
              open.length
                ? 'An audit is not closed when the report is issued. It stays open until each corrective action has been checked on site and found to be holding.'
                : 'Each corrective action was checked on site and found effective.'
            }
          />

          {single && (
            <View style={styles.filterRow}>
              {(['open', 'all'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, filter === f && styles.filterBtnOn]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
                    {f === 'open' ? `Open (${open.length})` : `All (${findings.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {shown.length ? shown.map((f) => {
            const cp = checkpoint(f);
            const done = f.status === 'verified' || f.status === 'closed';
            const isNc = CLASSIFICATION_META[f.classification].severity >= 2;
            return (
              <View key={f.id} style={[styles.card, done && styles.cardDone]}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ref}>{f.finding_ref ?? `Finding ${f.id}`}</Text>
                    <Text style={styles.title}>{f.title}</Text>
                  </View>
                  <ClassificationChip value={f.classification} small repeat={f.is_repeat} />
                </View>

                {!!f.description && <Text style={styles.desc} numberOfLines={3}>{f.description}</Text>}

                <View style={styles.metaRow}>
                  {!!f.section && (
                    <View style={styles.tag}><Text style={styles.tagText}>{f.section}</Text></View>
                  )}
                  {!!f.capa_id && (
                    <View style={styles.tag}>
                      <Ionicons name="construct" size={9} color={C.mid} />
                      <Text style={styles.tagText}>CAPA raised</Text>
                    </View>
                  )}
                  {cp && !done && (
                    <View style={[styles.tag, cp.overdue && styles.tagOverdue]}>
                      <Ionicons name="time" size={9} color={cp.overdue ? '#B91C1C' : C.mid} />
                      <Text style={[styles.tagText, cp.overdue && { color: '#B91C1C' }]}>{cp.label}</Text>
                    </View>
                  )}
                  <View style={[styles.tag, done && styles.tagDone]}>
                    <Text style={[styles.tagText, done && { color: '#047857' }]}>
                      {f.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                {!!f.verification_notes && (
                  <Text style={styles.verifyNote}>
                    <Text style={{ fontWeight: '900' }}>Verification: </Text>{f.verification_notes}
                  </Text>
                )}

                {isNc && !done && (
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() => { setVerifying(f); setEffective(null); setNotes(''); }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="shield-checkmark" size={15} color={C.brand} />
                    <Text style={styles.verifyBtnText}>Check on site</Text>
                  </TouchableOpacity>
                )}

                {done && (
                  <View style={styles.doneRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#047857" />
                    <Text style={styles.doneText}>
                      Verified effective {fmt(f.verified_at)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }) : (
            <Empty
              icon="checkmark-done-outline"
              text={single ? 'No findings match this filter.' : 'Nothing awaiting verification across your audits.'}
            />
          )}

          {single && open.length === 0 && audit && !audit.closed_at && audit.report_issued_at && (
            <>
              <View style={{ height: 8 }} />
              <PrimaryButton
                label="Close the audit"
                icon="lock-closed"
                tone="ok"
                onPress={closeAudit}
                loading={busy}
              />
            </>
          )}

          {single && audit?.closed_at && (
            <Banner
              tone="ok" icon="lock-closed"
              title="Audit closed"
              text={`Closed ${fmt(audit.closed_at)}.`}
            />
          )}

          <View style={{ height: 36 }} />
        </ScrollView>
      )}

      {/* Effectiveness check */}
      <Modal visible={!!verifying} transparent animationType="slide" onRequestClose={() => setVerifying(null)}>
        <KeyboardAvoider style={styles.sheetBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Is the fix holding?</Text>
            <Text style={styles.sheetSub}>{verifying?.title}</Text>

            <Text style={styles.sheetNote}>
              Marking a corrective action complete is a claim. This is you standing in the same place
              and checking.
            </Text>

            <TouchableOpacity
              style={[styles.choice, effective === true && styles.choiceOk]}
              onPress={() => setEffective(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color={effective === true ? '#047857' : C.light} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, effective === true && { color: '#047857' }]}>
                  Checked on site — holding
                </Text>
                <Text style={styles.choiceSub}>The finding is verified closed.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choice, effective === false && styles.choiceBad]}
              onPress={() => setEffective(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle" size={20} color={effective === false ? '#B91C1C' : C.light} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, effective === false && { color: '#B91C1C' }]}>
                  Not holding
                </Text>
                <Text style={styles.choiceSub}>
                  Reopens the finding and its corrective action, and reopens the audit if it was closed.
                </Text>
              </View>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={notes} onChangeText={setNotes}
              multiline
              placeholder={effective === false ? 'What did you find?' : 'What you checked (optional)'}
              placeholderTextColor={C.light}
            />

            {geo.gps_latitude != null && (
              <View style={styles.gpsRow}>
                <Ionicons name="location" size={12} color="#047857" />
                <Text style={styles.gpsText}>
                  Stamped at {geo.gps_latitude.toFixed(4)}, {geo.gps_longitude?.toFixed(4)}
                </Text>
              </View>
            )}

            <PrimaryButton
              label="Record verification"
              icon="save"
              onPress={submitVerification}
              loading={busy}
              disabled={effective === null}
              tone={effective === false ? 'danger' : 'brand'}
            />
            <TouchableOpacity style={styles.cancel} onPress={() => setVerifying(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoider>
      </Modal>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border,
  },
  filterBtnOn: { backgroundColor: C.brand, borderColor: C.brand },
  filterText: { fontSize: 11.5, fontWeight: '800', color: C.mid },
  filterTextOn: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 10,
  },
  cardDone: { backgroundColor: '#FAFFFD', borderColor: '#A7F3D0' },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ref: { fontSize: 9, fontWeight: '900', color: C.light, letterSpacing: 0.6 },
  title: { fontSize: 13.5, fontWeight: '800', color: C.ink, marginTop: 3, lineHeight: 18 },
  desc: { fontSize: 11.5, color: C.mid, fontWeight: '600', lineHeight: 16.5, marginTop: 7 },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 9, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F1F5F9',
    borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4,
  },
  tagOverdue: { backgroundColor: '#FEE2E2' },
  tagDone: { backgroundColor: '#D1FAE5' },
  tagText: { fontSize: 9.5, fontWeight: '800', color: C.mid, textTransform: 'capitalize' },

  verifyNote: { fontSize: 11, color: C.muted, fontWeight: '600', lineHeight: 15.5, marginTop: 9 },

  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 10, paddingVertical: 10,
    marginTop: 11, backgroundColor: '#FFFFFF',
  },
  verifyBtnText: { fontSize: 12, fontWeight: '800', color: C.brand },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  doneText: { fontSize: 11, fontWeight: '700', color: '#047857' },

  sheetBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  sheetGrip: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  sheetSub: { fontSize: 12.5, fontWeight: '700', color: C.mid, marginTop: 3 },
  sheetNote: { fontSize: 11, fontWeight: '600', color: C.muted, lineHeight: 15.5, marginTop: 8, marginBottom: 14 },

  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5,
    borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: '#FFFFFF',
  },
  choiceOk: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF9' },
  choiceBad: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
  choiceTitle: { fontSize: 13, fontWeight: '800', color: C.mid },
  choiceSub: { fontSize: 10.5, fontWeight: '600', color: C.muted, marginTop: 2, lineHeight: 14.5 },

  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink,
    fontWeight: '600', minHeight: 70, textAlignVertical: 'top', marginTop: 6, marginBottom: 12,
  },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  gpsText: { fontSize: 10.5, fontWeight: '600', color: C.muted },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 13, fontWeight: '800', color: C.muted },
});

export default AuditFindingsScreen;
