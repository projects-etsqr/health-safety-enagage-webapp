/**
 * Safety Manager · Competence Matrix Owner + Fatigue Exception Authority (WF-06).
 *
 * "Role → course → validity. Monthly training effectiveness: incident rate
 *  trained vs untrained."
 * "Only role able to authorise F ≥ 20, with rationale."
 *
 * The two sit together because they are the same authority: the Safety Manager
 * owns what competence means here, and is the only person who can let someone
 * work past the fatigue limit. Both write to the audit trail.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert, Switch,
} from 'react-native';
import { Card, EmptyState, Loading, PrimaryButton, bandColor, HSE_COLORS } from '../../components/hseiq';
import { competenceService, fatigueService, FatigueDeclaration } from '../../services/hseiqService';
import { KeyboardAvoider } from '../../components/layout/KeyboardAvoider';

export default function MgrHumanReadiness({ setCurrentScreen }: any) {
  const [matrix, setMatrix] = useState<any[]>([]);
  const [certTypes, setCertTypes] = useState<any[]>([]);
  const [effectiveness, setEffectiveness] = useState<any>(null);
  const [blocked, setBlocked] = useState<FatigueDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New requirement form
  const [reqName, setReqName] = useState('');
  const [certId, setCertId] = useState<number | null>(null);
  const [critical, setCritical] = useState(false);
  const [busy, setBusy] = useState(false);

  // Exception form
  const [target, setTarget] = useState<FatigueDeclaration | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    Promise.all([
      competenceService.matrix().catch(() => []),
      competenceService.certificationTypes().catch(() => []),
      competenceService.effectiveness(12).catch(() => null),
      fatigueService.team(7, 'block').catch(() => []),
    ])
      .then(([m, c, e, f]) => {
        setMatrix(m as any[]);
        setCertTypes(c as any[]);
        setEffectiveness(e);
        setBlocked((f as FatigueDeclaration[]).filter(d => !d.exception_at));
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const addRequirement = useCallback(() => {
    if (!reqName.trim()) { Alert.alert('Name the requirement'); return; }
    setBusy(true);
    competenceService
      .createRequirement({
        requirement_name: reqName.trim(),
        certification_type_id: certId,
        is_safety_critical: critical,
        is_mandatory: true,
      })
      .then(() => {
        Alert.alert(
          'Requirement added',
          critical
            ? 'Marked safety-critical — an expired certificate will now hard-block the permit gate.'
            : 'Added to the competence matrix.',
        );
        setReqName(''); setCritical(false); setCertId(null);
        load();
      })
      .catch(err => Alert.alert('Could not add', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [reqName, certId, critical, load]);

  const authorise = useCallback(() => {
    if (!target) return;
    if (reason.trim().length < 10) {
      Alert.alert('A written rationale is required', 'This is the only route past a hard block — say why.');
      return;
    }
    setBusy(true);
    fatigueService
      .exception(target.id, reason.trim())
      .then(() => {
        Alert.alert('Exception authorised', 'Recorded against the declaration and the audit trail.');
        setTarget(null); setReason('');
        load();
      })
      .catch(err => Alert.alert('Could not authorise', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [target, reason, load]);

  return (
    <KeyboardAvoider style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentScreen('app')}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Competence & Human Readiness</Text>
        </View>

        {loading ? (
          <Loading />
        ) : (
          <>
            <Card title={`Fatigue exceptions awaiting you (${blocked.length})`}>
              {blocked.length === 0 ? (
                <EmptyState text="Nobody is over the fatigue limit." />
              ) : (
                blocked.map(d => (
                  <View key={d.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>Employee #{d.employee_id}</Text>
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                        <Text style={styles.pillText}>F {d.fatigue_index}</Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      {d.shift_hours}h shift · {d.consecutive_days} consecutive days ·{' '}
                      {d.night_shifts_7d} night shifts
                    </Text>
                    <Text style={styles.warn}>
                      Hard block. 8 h rest is the default. You are the only role that can authorise
                      an exception.
                    </Text>
                    <TouchableOpacity onPress={() => setTarget(d)}>
                      <Text style={styles.action}>Authorise exception</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Card>

            {target ? (
              <Card title={`Authorise F ${target.fatigue_index} — employee #${target.employee_id}`}>
                <Text style={styles.label}>Written rationale (required)</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Why is it acceptable for this person to work past the fatigue limit?"
                  placeholderTextColor="#94A3B8"
                />
                <PrimaryButton label="Authorise with rationale" onPress={authorise} busy={busy} tone="danger" />
                <TouchableOpacity onPress={() => setTarget(null)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            {effectiveness ? (
              <Card title="Training effectiveness">
                <Text style={styles.effect}>{effectiveness.interpretation}</Text>
                <View style={styles.effectGrid}>
                  <Stat label="Trained" value={effectiveness.trained_employees} />
                  <Stat label="Untrained" value={effectiveness.untrained_employees} />
                  <Stat label="Rate trained" value={effectiveness.rate_trained} />
                  <Stat label="Rate untrained" value={effectiveness.rate_untrained} />
                </View>
              </Card>
            ) : null}

            <Card title={`Competence matrix (${matrix.length})`}>
              {matrix.length === 0 ? (
                <EmptyState text="No requirements configured. Until the matrix exists, the permit gate has nothing to check against." />
              ) : (
                matrix.map(m => (
                  <View key={m.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{m.requirement_name}</Text>
                      {m.is_safety_critical ? (
                        <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                          <Text style={styles.pillText}>CRITICAL</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta}>
                      {m.is_mandatory ? 'Mandatory' : 'Optional'}
                      {m.validity_months ? ` · valid ${m.validity_months} months` : ''}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Card title="Add a requirement">
              <Text style={styles.label}>Requirement name</Text>
              <TextInput
                style={styles.input}
                value={reqName}
                onChangeText={setReqName}
                placeholder="e.g. Working at Height"
                placeholderTextColor="#94A3B8"
              />
              {certTypes.length > 0 ? (
                <>
                  <Text style={styles.label}>Certification type</Text>
                  <View style={styles.chips}>
                    {certTypes.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setCertId(c.id)}
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
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Safety critical (expiry hard-blocks permits)</Text>
                <Switch value={critical} onValueChange={setCritical} />
              </View>
              <PrimaryButton label="Add to matrix" onPress={addRequirement} busy={busy} />
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: '#2563EB', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  warn: { fontSize: 11, color: HSE_COLORS.block, marginTop: 6, fontWeight: '600', lineHeight: 16 },
  action: { fontSize: 13, color: '#2563EB', fontWeight: '700', marginTop: 8 },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 10, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  cancel: { fontSize: 13, color: HSE_COLORS.textMuted, textAlign: 'center', marginTop: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, color: HSE_COLORS.textMid },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, gap: 12,
  },
  switchLabel: { fontSize: 12, color: HSE_COLORS.textMid, flex: 1 },

  effect: { fontSize: 12, color: HSE_COLORS.textMid, lineHeight: 18 },
  effectGrid: { flexDirection: 'row', marginTop: 12, gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 10 },
  statValue: { fontSize: 16, fontWeight: '800', color: HSE_COLORS.textDark },
  statLabel: { fontSize: 9, color: HSE_COLORS.textMuted, marginTop: 2, textAlign: 'center' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
