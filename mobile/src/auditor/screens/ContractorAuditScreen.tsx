/**
 * Auditor · Contractor Audit (WF-08).
 *
 * "Independently re-score RAMS against the same rubric. On-site compliance
 *  findings."
 *
 * The auditor's score never replaces the supervisor's — both are kept. The gap
 * between them *is* the finding, so this screen shows them side by side once a
 * re-score exists.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Card, PrimaryButton, EmptyState, Loading, HSE_COLORS } from '../../components/hseiq';
import { contractorService, RamsScore, ContractorCompany } from '../../services/hseiqService';
import { KeyboardAvoider } from '../../components/layout/KeyboardAvoider';

const CRITERIA = [
  { key: 'hazard_identification', label: 'Hazard identification' },
  { key: 'control_adequacy', label: 'Control adequacy' },
  { key: 'competence_evidence', label: 'Competence evidence' },
  { key: 'equipment_suitability', label: 'Equipment suitability' },
  { key: 'emergency_arrangements', label: 'Emergency arrangements' },
  { key: 'supervision_arrangements', label: 'Supervision arrangements' },
] as const;

export default function ContractorAuditScreen({ navigation }: any) {
  const [scores, setScores] = useState<RamsScore[]>([]);
  const [companies, setCompanies] = useState<ContractorCompany[]>([]);
  const [target, setTarget] = useState<RamsScore | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      contractorService.ramsList().catch(() => []),
      contractorService.list().catch(() => []),
    ])
      .then(([r, c]) => { setScores(r as RamsScore[]); setCompanies(c as ContractorCompany[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const startRescore = (s: RamsScore) => {
    setTarget(s);
    // Seed with the supervisor's own numbers so the auditor adjusts what they
    // disagree with rather than re-entering the whole rubric from zero.
    setValues(Object.fromEntries(CRITERIA.map(c => [c.key, (s as any)[c.key] ?? 0])));
    setNotes('');
  };

  const submit = useCallback(() => {
    if (!target) return;
    setBusy(true);
    contractorService
      .rescoreRams(target.id, { ...values, notes })
      .then(r => {
        const delta = (r.auditor_total_score ?? 0) - target.total_score;
        Alert.alert(
          'Re-score recorded',
          `Auditor ${r.auditor_total_score}/120 vs supervisor ${target.total_score}/120 (${delta >= 0 ? '+' : ''}${delta}).`,
        );
        setTarget(null);
        load();
      })
      .catch(err => Alert.alert('Could not re-score', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [target, values, notes, load]);

  const companyName = (id?: number | null) =>
    companies.find(c => c.id === id)?.company_name ?? 'Unassigned contractor';

  return (
    <KeyboardAvoider style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Contractor Audit</Text>
        <Text style={styles.subtitle}>Independently re-score RAMS against the same rubric.</Text>

        {loading ? (
          <Loading />
        ) : (
          <>
            {target ? (
              <Card title={`Re-score — ${companyName(target.contractor_company_id)}`}>
                <Text style={styles.original}>
                  Supervisor scored {target.total_score}/120 ({target.verdict})
                </Text>
                {CRITERIA.map(c => (
                  <View key={c.key} style={styles.criterion}>
                    <View style={styles.criterionHead}>
                      <Text style={styles.criterionLabel}>{c.label}</Text>
                      <Text style={styles.criterionValue}>
                        {values[c.key]}/20
                        <Text style={styles.wasValue}>  was {(target as any)[c.key]}</Text>
                      </Text>
                    </View>
                    <View style={styles.stepRow}>
                      {[0, 5, 10, 15, 20].map(v => (
                        <TouchableOpacity
                          key={v}
                          onPress={() => setValues(s => ({ ...s, [c.key]: v }))}
                          style={[styles.step, values[c.key] === v && styles.stepActive]}
                        >
                          <Text style={[styles.stepText, values[c.key] === v && styles.stepTextActive]}>
                            {v}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
                <Text style={styles.label}>Audit note</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="What did you find on site that differs?"
                  placeholderTextColor="#94A3B8"
                />
                <PrimaryButton label="Record independent score" onPress={submit} busy={busy} />
                <TouchableOpacity onPress={() => setTarget(null)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            <Card title={`RAMS on file (${scores.length})`}>
              {scores.length === 0 ? (
                <EmptyState text="No RAMS scored yet." />
              ) : (
                scores.map(s => {
                  const delta = s.auditor_total_score != null ? s.auditor_total_score - s.total_score : null;
                  return (
                    <View key={s.id} style={styles.row}>
                      <View style={styles.rowHead}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {companyName(s.contractor_company_id)}
                        </Text>
                        <Text style={styles.score}>{s.total_score}/120</Text>
                      </View>
                      <Text style={styles.meta} numberOfLines={2}>
                        {s.task_description || 'No task description recorded'}
                      </Text>
                      {delta != null ? (
                        <Text
                          style={[
                            styles.delta,
                            { color: Math.abs(delta) >= 15 ? HSE_COLORS.block : HSE_COLORS.amber },
                          ]}
                        >
                          Auditor {s.auditor_total_score}/120 ({delta >= 0 ? '+' : ''}{delta})
                          {Math.abs(delta) >= 15 ? ' — material disagreement, raise a finding' : ''}
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={() => startRescore(s)}>
                          <Text style={styles.action}>Re-score independently</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  original: { fontSize: 12, color: HSE_COLORS.textMuted, marginBottom: 12, fontStyle: 'italic' },
  criterion: { marginBottom: 14 },
  criterionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  criterionLabel: { fontSize: 12, color: HSE_COLORS.textMid, flex: 1 },
  criterionValue: { fontSize: 12, fontWeight: '700', color: HSE_COLORS.textDark },
  wasValue: { fontSize: 10, color: HSE_COLORS.textLight, fontWeight: '400' },
  stepRow: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  stepActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  stepText: { fontSize: 11, color: HSE_COLORS.textMid, fontWeight: '600' },
  stepTextActive: { color: '#fff' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 8, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  cancel: { fontSize: 13, color: HSE_COLORS.textMuted, textAlign: 'center', marginTop: 12 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  score: { fontSize: 12, fontWeight: '800', color: HSE_COLORS.textDark },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  delta: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  action: { fontSize: 13, color: '#2563EB', fontWeight: '700', marginTop: 8 },
});
