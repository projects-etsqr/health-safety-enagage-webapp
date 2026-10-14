/**
 * Supervisor · RAMS Scoring (WF-08).
 *
 * "6-criterion rubric, 0–20 each. <60 reject · 60–79 conditional · ≥80 approve."
 *
 * The running total and its verdict update as you score, because a supervisor
 * standing in front of a contractor should be able to see the decision forming
 * rather than discovering it after submitting.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Alert, TouchableOpacity,
} from 'react-native';
import { Card, PrimaryButton, ScoreTile, EmptyState, HSE_COLORS } from '../components/hseiq';
import { contractorService, ContractorCompany, RamsScore } from '../services/hseiqService';
import { KeyboardAvoider } from '../components/layout/KeyboardAvoider';

const CRITERIA = [
  { key: 'hazard_identification', label: 'Hazard identification' },
  { key: 'control_adequacy', label: 'Control adequacy' },
  { key: 'competence_evidence', label: 'Competence evidence' },
  { key: 'equipment_suitability', label: 'Equipment suitability' },
  { key: 'emergency_arrangements', label: 'Emergency arrangements' },
  { key: 'supervision_arrangements', label: 'Supervision arrangements' },
] as const;

type Scores = Record<string, number>;

export default function RamsScoringScreen({ navigation }: any) {
  const [companies, setCompanies] = useState<ContractorCompany[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [task, setTask] = useState('');
  const [scores, setScores] = useState<Scores>(
    Object.fromEntries(CRITERIA.map(c => [c.key, 10])),
  );
  const [recent, setRecent] = useState<RamsScore[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    contractorService.list().then(setCompanies).catch(() => setCompanies([]));
    contractorService.ramsList().then(setRecent).catch(() => setRecent([]));
  }, []);

  useEffect(load, [load]);

  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);
  const verdict = total >= 80 ? 'approve' : total >= 60 ? 'conditional' : 'reject';
  const band = verdict === 'approve' ? 'low' : verdict === 'conditional' ? 'elevated' : 'critical';

  const submit = useCallback(() => {
    setBusy(true);
    contractorService
      .scoreRams({ contractor_company_id: companyId, task_description: task, ...scores })
      .then(r => {
        Alert.alert(
          `RAMS ${r.total_score}/120 — ${r.verdict}`,
          r.verdict === 'reject'
            ? 'Below 60. This method statement is rejected and the permit gate will block on it.'
            : r.verdict === 'conditional'
            ? 'Conditional. Enhanced monitoring applies while this work runs.'
            : 'Approved.',
        );
        setTask('');
        load();
      })
      .catch(err => Alert.alert('Could not score', err?.response?.data?.detail ?? 'Please try again.'))
      .finally(() => setBusy(false));
  }, [companyId, task, scores, load]);

  return (
    <KeyboardAvoider style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>RAMS Scoring</Text>
        <Text style={styles.subtitle}>
          Six criteria, 0–20 each. Under 60 rejects the method statement.
        </Text>

        <Card title="Contractor">
          {companies.length === 0 ? (
            <EmptyState text="No contractors in the registry yet." />
          ) : (
            <View style={styles.chips}>
              {companies.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCompanyId(c.id)}
                  style={[styles.chip, companyId === c.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, companyId === c.id && styles.chipTextActive]}>
                    {c.company_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={styles.label}>Task / method statement</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={task}
            onChangeText={setTask}
            multiline
            placeholder="What work does this cover?"
            placeholderTextColor="#94A3B8"
          />
        </Card>

        <Card title="Score the rubric">
          {CRITERIA.map(c => (
            <View key={c.key} style={styles.criterion}>
              <View style={styles.criterionHead}>
                <Text style={styles.criterionLabel}>{c.label}</Text>
                <Text style={styles.criterionValue}>{scores[c.key]}/20</Text>
              </View>
              <View style={styles.stepRow}>
                {[0, 5, 10, 15, 20].map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setScores(s => ({ ...s, [c.key]: v }))}
                    style={[styles.step, scores[c.key] === v && styles.stepActive]}
                  >
                    <Text style={[styles.stepText, scores[c.key] === v && styles.stepTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.totalBox}>
            <ScoreTile value={`${total}/120`} band={band} label="RAMS total" sub={verdict} />
          </View>

          <PrimaryButton
            label="Submit RAMS score"
            onPress={submit}
            busy={busy}
            tone={verdict === 'reject' ? 'danger' : 'primary'}
          />
        </Card>

        <Card title="Recent scores">
          {recent.length === 0 ? (
            <EmptyState text="No RAMS scored yet." />
          ) : (
            recent.slice(0, 10).map(r => (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.task_description || `RAMS #${r.id}`}
                  </Text>
                  <Text
                    style={[
                      styles.verdict,
                      {
                        color:
                          r.verdict === 'approve' ? HSE_COLORS.pass
                            : r.verdict === 'conditional' ? HSE_COLORS.amber
                            : HSE_COLORS.block,
                      },
                    ]}
                  >
                    {r.total_score}/120 {r.verdict}
                  </Text>
                </View>
                {r.auditor_total_score != null ? (
                  <Text style={styles.auditNote}>
                    Auditor re-scored {r.auditor_total_score}/120
                    {r.auditor_notes ? ` — ${r.auditor_notes}` : ''}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, color: HSE_COLORS.textMid },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },

  criterion: { marginBottom: 16 },
  criterionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  criterionLabel: { fontSize: 13, color: HSE_COLORS.textMid, flex: 1 },
  criterionValue: { fontSize: 12, fontWeight: '700', color: HSE_COLORS.textDark },
  stepRow: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  stepActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  stepText: { fontSize: 12, color: HSE_COLORS.textMid, fontWeight: '600' },
  stepTextActive: { color: '#fff' },

  totalBox: { backgroundColor: '#F8FAFC', borderRadius: 10, marginTop: 6 },

  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, color: HSE_COLORS.textDark, flex: 1 },
  verdict: { fontSize: 12, fontWeight: '800' },
  auditNote: { fontSize: 11, color: HSE_COLORS.amber, marginTop: 4, fontWeight: '600' },
});
