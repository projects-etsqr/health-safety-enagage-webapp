/**
 * Supervisor · Gate Override Console — "D4, CORE FEATURE".
 *
 * "F 10–14 acknowledge · F 15–19 sign-off with mandatory note. Every override
 *  captures reason, context, outcome."
 *
 * That capture is the whole point. It is the signal the learning loop trains
 * on and the record that makes a decision defensible, so this screen refuses
 * to submit an override without a reason, and refuses outright on a hard block
 * — an expired safety-critical certificate or a fatigue index of 20 or more
 * cannot be waved through by anyone, including a Safety Manager on this screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import {
  Card, GateRow, PrimaryButton, EmptyState, Loading, bandColor, HSE_COLORS,
} from '../components/hseiq';
import { fatigueService, gateService, FatigueDeclaration, OverrideRecord } from '../services/hseiqService';
import { KeyboardAvoider } from '../components/layout/KeyboardAvoider';

export default function GateOverrideConsoleScreen({ navigation }: any) {
  const [flags, setFlags] = useState<FatigueDeclaration[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [target, setTarget] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [context, setContext] = useState('');
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fatigueService.team(2).catch(() => []),
      gateService.log({ verdict: 'block' }).catch(() => []),
      gateService.overrides().catch(() => []),
    ])
      .then(([f, b, o]) => {
        setFlags((f as FatigueDeclaration[]).filter(d => d.band !== 'acceptable'));
        setBlocked(b as any[]);
        setOverrides(o as OverrideRecord[]);
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const ack = useCallback(
    (d: FatigueDeclaration) => {
      fatigueService
        .acknowledge(d.id, 'Acknowledged on the gate override console')
        .then(() => { Alert.alert('Acknowledged', 'The amber fatigue flag is recorded as acknowledged.'); load(); })
        .catch(() => Alert.alert('Could not acknowledge'));
    },
    [load],
  );

  const signOff = useCallback(
    (d: FatigueDeclaration) => {
      Alert.prompt?.(
        'Sign-off note',
        'A written note is mandatory for a 15–19 fatigue sign-off.',
        note => {
          if (!note) return;
          fatigueService
            .signOff(d.id, note)
            .then(() => { Alert.alert('Signed off'); load(); })
            .catch(err => Alert.alert('Could not sign off', err?.response?.data?.detail ?? ''));
        },
      ) ??
        // Alert.prompt is iOS-only; fall back to the override form below.
        setTarget({ kind: 'fatigue_signoff', id: d.id, label: `Fatigue ${d.fatigue_index}` });
    },
    [load],
  );

  const submitOverride = useCallback(() => {
    if (!target) return;
    if (reason.trim().length < 10) {
      Alert.alert('A reason is required', 'Say why this is being overridden — at least a sentence.');
      return;
    }
    setBusy(true);

    // A fatigue sign-off is not a gate override — it is the supervisor doing
    // the thing the band asks for, so it goes to the fatigue endpoint.
    const call =
      target.kind === 'fatigue_signoff'
        ? fatigueService.signOff(target.id, reason)
        : gateService.override({
            gate_decision_id: target.id,
            decision: 'accept',
            reason,
            context,
            outcome,
            resulting_verdict: 'amber',
          });

    call
      .then(() => {
        Alert.alert('Recorded', 'The decision, its reason and its context are now on the audit trail.');
        setTarget(null); setReason(''); setContext(''); setOutcome('');
        load();
      })
      .catch(err =>
        Alert.alert(
          'Refused',
          typeof err?.response?.data?.detail === 'string'
            ? err.response.data.detail
            : 'This gate cannot be overridden.',
        ),
      )
      .finally(() => setBusy(false));
  }, [target, reason, context, outcome, load]);

  return (
    <KeyboardAvoider style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Gate Override Console</Text>
        <Text style={styles.subtitle}>
          Every override records reason, context and outcome. Hard blocks cannot be lifted.
        </Text>

        {loading ? (
          <Loading />
        ) : (
          <>
            <Card title={`Fatigue flags (${flags.length})`}>
              {flags.length === 0 ? (
                <EmptyState text="No fatigue flags on the team right now." />
              ) : (
                flags.map(d => (
                  <View key={d.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>Employee #{d.employee_id}</Text>
                      <View style={[styles.pill, { backgroundColor: bandColor(d.band) }]}>
                        <Text style={styles.pillText}>F {d.fatigue_index}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>
                      {d.shift_hours}h shift · {d.consecutive_days} consecutive days ·{' '}
                      {d.night_shifts_7d} nights
                    </Text>

                    {d.band === 'block' ? (
                      <Text style={styles.hard}>
                        Hard block. 8 h rest required — only a Safety Manager can authorise an
                        exception, and only against the declaration itself.
                      </Text>
                    ) : (
                      <View style={styles.actions}>
                        {!d.supervisor_ack_at ? (
                          <TouchableOpacity onPress={() => ack(d)}>
                            <Text style={styles.action}>Acknowledge</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.done}>Acknowledged</Text>
                        )}
                        {d.band === 'signoff' && !d.supervisor_signoff_at ? (
                          <TouchableOpacity
                            onPress={() =>
                              setTarget({
                                kind: 'fatigue_signoff',
                                id: d.id,
                                label: `Fatigue sign-off — index ${d.fatigue_index}`,
                              })
                            }
                          >
                            <Text style={styles.action}>Sign off</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                  </View>
                ))
              )}
            </Card>

            <Card title={`Blocked gates (${blocked.length})`}>
              {blocked.length === 0 ? (
                <EmptyState text="No blocked gates." />
              ) : (
                blocked.slice(0, 15).map(g => (
                  <View key={g.id}>
                    <GateRow
                      gate={{
                        gate_key: g.gate_key,
                        verdict: g.verdict,
                        reason: g.reason ?? '',
                        hard: !!g.details?.hard,
                      }}
                    />
                    {!g.details?.hard ? (
                      <TouchableOpacity
                        onPress={() =>
                          setTarget({ kind: 'gate', id: g.id, label: `${g.gate_key} on ${g.subject_type} #${g.subject_id}` })
                        }
                      >
                        <Text style={[styles.action, { marginBottom: 12 }]}>Override with reason</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </Card>

            {target ? (
              <Card title={`Override — ${target.label}`}>
                <Text style={styles.label}>Reason (required)</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Why is it acceptable to proceed?"
                  placeholderTextColor="#94A3B8"
                />
                {target.kind === 'gate' ? (
                  <>
                    <Text style={styles.label}>Context</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={context}
                      onChangeText={setContext}
                      multiline
                      placeholder="What compensating controls are in place?"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.label}>Expected outcome</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={outcome}
                      onChangeText={setOutcome}
                      multiline
                      placeholder="What will you check afterwards?"
                      placeholderTextColor="#94A3B8"
                    />
                  </>
                ) : null}
                <PrimaryButton label="Record decision" onPress={submitOverride} busy={busy} tone="danger" />
                <TouchableOpacity onPress={() => setTarget(null)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            <Card title="Recent overrides">
              {overrides.length === 0 ? (
                <EmptyState text="No overrides recorded." />
              ) : (
                overrides.slice(0, 10).map(o => (
                  <View key={o.id} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {(o.gate_key || 'gate').replace(/_/g, ' ')} — {o.decision}
                    </Text>
                    <Text style={styles.rowMeta}>{o.reason}</Text>
                    <Text style={styles.rowWho}>
                      {o.overridden_by_role} · {o.overridden_at?.slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                ))
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
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4, lineHeight: 17 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  rowMeta: { fontSize: 12, color: HSE_COLORS.textMuted, marginTop: 4, lineHeight: 17 },
  rowWho: { fontSize: 11, color: HSE_COLORS.textLight, marginTop: 6 },

  hard: { fontSize: 12, color: HSE_COLORS.block, fontWeight: '700', marginTop: 8, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 10 },
  action: { fontSize: 13, color: '#2563EB', fontWeight: '700' },
  done: { fontSize: 13, color: HSE_COLORS.pass, fontWeight: '700' },
  cancel: { fontSize: 13, color: HSE_COLORS.textMuted, textAlign: 'center', marginTop: 12 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 10, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
});
