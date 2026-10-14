/**
 * WF-06 · Training & Assessment (worker).
 *
 * "Course completion, score. Below pass = flag stays. Toolbox acknowledge feeds
 *  the 80% attendance rule."
 *
 * The "flag stays" rule is the part worth being careful about: recording a
 * failed assessment must NOT clear the competence gap, and the screen has to
 * say so plainly — otherwise a worker logs a fail, sees a green tick, and walks
 * onto a job the gate should have stopped.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Alert, TouchableOpacity, RefreshControl,
} from 'react-native';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Card, EmptyState, Loading, PrimaryButton, HSE_COLORS } from '../../components/hseiq';
import { competenceService } from '../../services/hseiqService';

const TOOLBOX_TARGET = 0.8; // the spec's 80% attendance rule

export default function TrainingAssessmentScreen({ navigation }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<any[]>([]);
  const [certTypes, setCertTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [courseName, setCourseName] = useState('');
  const [certId, setCertId] = useState<number | null>(null);
  const [score, setScore] = useState('');
  const [passed, setPassed] = useState(true);
  const [certRef, setCertRef] = useState('');

  const load = useCallback(() => {
    Promise.all([
      competenceService.myTraining().catch(() => []),
      competenceService.matrix().catch(() => []),
      competenceService.certificationTypes().catch(() => []),
    ])
      .then(([r, m, c]) => { setRecords(r); setMatrix(m); setCertTypes(c); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const toolbox = useMemo(() => {
    const acknowledged = records.filter(r => r.toolbox_acknowledged_at).length;
    const total = records.length || 0;
    return { acknowledged, total, rate: total ? acknowledged / total : 0 };
  }, [records]);

  const submit = useCallback(() => {
    if (!courseName.trim()) { Alert.alert('Name the course'); return; }
    setBusy(true);

    const numericScore = score.trim() ? parseFloat(score) : undefined;
    competenceService
      .logTraining({
        course_name: courseName.trim(),
        certification_type_id: certId,
        score: numericScore,
        result: passed ? 'pass' : 'fail',
        certificate_ref: certRef.trim() || undefined,
        completed_at: new Date().toISOString().slice(0, 10),
      })
      .then(() => {
        Alert.alert(
          passed ? 'Training recorded' : 'Recorded as a fail',
          passed
            ? 'Your competence card will update once a supervisor verifies the certificate.'
            : 'A failed assessment does not clear the requirement — the competence flag stays until you pass.',
        );
        setCourseName(''); setScore(''); setCertRef(''); setCertId(null); setPassed(true);
        load();
      })
      .catch(err => Alert.alert('Could not record', err?.response?.data?.detail ?? 'Please try again.'))
      .finally(() => setBusy(false));
  }, [courseName, certId, score, passed, certRef, load]);

  const acknowledge = useCallback(
    (id: number) => {
      competenceService
        .toolboxAck(id)
        .then(() => { Alert.alert('Acknowledged', 'Counts toward your toolbox attendance.'); load(); })
        .catch(() => Alert.alert('Could not acknowledge'));
    },
    [load],
  );

  return (
    <ScreenLayout>
      <AppHeader title="Training & Assessment" onBack={() => navigation.goBack()} light />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <Loading text="Loading your training record…" />
        ) : (
          <>
            <Card title="Toolbox attendance">
              <View style={styles.attendanceHead}>
                <Text
                  style={[
                    styles.attendancePct,
                    { color: toolbox.rate >= TOOLBOX_TARGET ? HSE_COLORS.pass : HSE_COLORS.amber },
                  ]}
                >
                  {Math.round(toolbox.rate * 100)}%
                </Text>
                <Text style={styles.attendanceMeta}>
                  {toolbox.acknowledged} of {toolbox.total} acknowledged · target 80%
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, toolbox.rate * 100)}%`,
                      backgroundColor: toolbox.rate >= TOOLBOX_TARGET ? HSE_COLORS.pass : HSE_COLORS.amber,
                    },
                  ]}
                />
              </View>
            </Card>

            <Card title="Record a course">
              <Text style={styles.label}>Course</Text>
              <TextInput
                style={styles.input}
                value={courseName}
                onChangeText={setCourseName}
                placeholder="e.g. Working at Height refresher"
                placeholderTextColor="#94A3B8"
              />

              {certTypes.length > 0 ? (
                <>
                  <Text style={styles.label}>Certification this covers</Text>
                  <View style={styles.chips}>
                    {certTypes.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setCertId(certId === c.id ? null : c.id)}
                        style={[styles.chip, certId === c.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, certId === c.id && styles.chipTextActive]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Assessment score</Text>
              <TextInput
                style={styles.input}
                value={score}
                onChangeText={setScore}
                keyboardType="numeric"
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Result</Text>
              <View style={styles.resultRow}>
                <TouchableOpacity
                  style={[styles.result, passed && styles.resultPass]}
                  onPress={() => setPassed(true)}
                >
                  <Text style={[styles.resultText, passed && styles.resultTextActive]}>Pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.result, !passed && styles.resultFail]}
                  onPress={() => setPassed(false)}
                >
                  <Text style={[styles.resultText, !passed && styles.resultTextActive]}>Fail</Text>
                </TouchableOpacity>
              </View>
              {!passed ? (
                <Text style={styles.failNote}>
                  A fail is still worth recording, but the competence flag stays until you pass —
                  it will not unblock a permit.
                </Text>
              ) : null}

              <Text style={styles.label}>Certificate reference</Text>
              <TextInput
                style={styles.input}
                value={certRef}
                onChangeText={setCertRef}
                placeholder="Optional"
                placeholderTextColor="#94A3B8"
              />

              <PrimaryButton label="Record training" onPress={submit} busy={busy} />
            </Card>

            <Card title={`My training record (${records.length})`}>
              {records.length === 0 ? (
                <EmptyState text="No training recorded yet." />
              ) : (
                records.map(r => (
                  <View key={r.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{r.course_name ?? `Record #${r.id}`}</Text>
                      <Text
                        style={[
                          styles.result_,
                          { color: r.result === 'pass' ? HSE_COLORS.pass : HSE_COLORS.block },
                        ]}
                      >
                        {(r.result ?? 'pending').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {r.completed_at ? `Completed ${r.completed_at}` : 'Not completed'}
                      {r.expires_at ? ` · expires ${r.expires_at}` : ''}
                      {r.score != null ? ` · score ${r.score}` : ''}
                    </Text>
                    <Text style={styles.verify}>
                      {r.verified_at
                        ? 'Verified by a supervisor'
                        : 'Awaiting supervisor verification'}
                    </Text>
                    {!r.toolbox_acknowledged_at ? (
                      <TouchableOpacity onPress={() => acknowledge(r.id)}>
                        <Text style={styles.action}>Acknowledge toolbox talk</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </Card>

            {matrix.length > 0 ? (
              <Card title="What your role requires">
                {matrix.map(m => (
                  <View key={m.id} style={styles.reqRow}>
                    <Text style={styles.reqName}>{m.requirement_name}</Text>
                    {m.is_safety_critical ? (
                      <Text style={styles.criticalTag}>SAFETY CRITICAL</Text>
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  attendanceHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  attendancePct: { fontSize: 28, fontWeight: '800' },
  attendanceMeta: { fontSize: 11, color: HSE_COLORS.textMuted, flex: 1 },
  track: { height: 8, backgroundColor: '#EEF2F7', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, color: HSE_COLORS.textMid },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  resultRow: { flexDirection: 'row', gap: 8 },
  result: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  resultPass: { backgroundColor: HSE_COLORS.pass, borderColor: HSE_COLORS.pass },
  resultFail: { backgroundColor: HSE_COLORS.block, borderColor: HSE_COLORS.block },
  resultText: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textMid },
  resultTextActive: { color: '#fff' },
  failNote: { fontSize: 11, color: HSE_COLORS.block, marginTop: 8, lineHeight: 16 },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  result_: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  verify: { fontSize: 11, color: HSE_COLORS.textLight, marginTop: 3, fontStyle: 'italic' },
  action: { fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: 8 },

  reqRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 8 },
  reqName: { fontSize: 12, color: HSE_COLORS.textMid, flex: 1 },
  criticalTag: { fontSize: 9, fontWeight: '800', color: '#B91C1C' },
});
