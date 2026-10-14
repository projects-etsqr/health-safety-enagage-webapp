/**
 * Safety Manager · Transport Oversight + Change & Drift Log (WF-09, MOC-Lite).
 *
 * "Weather limits by mode, fatigue flag rate, defect rate, monthly KPI batch."
 * "Change & Drift Log — procedure updates, equipment mods, staffing changes,
 *  temporary arrangements. MOC-Lite risk-spike input."
 *
 * Temporary arrangements carry the highest risk-spike weight, because they are
 * the ones that quietly become permanent without ever being re-assessed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Card, ScoreTile, EmptyState, Loading, PrimaryButton, HSE_COLORS } from '../../components/hseiq';
import { transportService, changeLogService, ChangeEvent } from '../../services/hseiqService';
import { KeyboardAvoider } from '../../components/layout/KeyboardAvoider';

const CHANGE_TYPES = [
  { key: 'temporary_arrangement', label: 'Temporary arrangement' },
  { key: 'equipment_mod', label: 'Equipment mod' },
  { key: 'staffing_change', label: 'Staffing change' },
  { key: 'procedure_update', label: 'Procedure update' },
] as const;

export default function MgrTransportOversight({ setCurrentScreen }: any) {
  const [kpis, setKpis] = useState<any>(null);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [changeType, setChangeType] = useState<string>('temporary_arrangement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(() => {
    Promise.all([
      transportService.kpis(30).catch(() => null),
      changeLogService.list().catch(() => []),
    ])
      .then(([k, c]) => { setKpis(k); setChanges(c as ChangeEvent[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const raise = useCallback(() => {
    if (!title.trim()) { Alert.alert('Give the change a title'); return; }
    setBusy(true);
    changeLogService
      .raise({ change_type: changeType, title: title.trim(), description })
      .then(() => { setTitle(''); setDescription(''); load(); })
      .catch(err => Alert.alert('Could not raise', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [changeType, title, description, load]);

  const review = useCallback(
    (c: ChangeEvent) => {
      changeLogService
        .review(c.id, 'reviewed', 'Reviewed by Safety Manager')
        .then(load)
        .catch(() => Alert.alert('Could not review'));
    },
    [load],
  );

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
          <Text style={styles.title}>Transport & Change Oversight</Text>
        </View>

        {loading ? (
          <Loading />
        ) : (
          <>
            {kpis ? (
              <>
                <Card title="Monthly transport KPIs">
                  <View style={{ flexDirection: 'row' }}>
                    <ScoreTile
                      value={`${kpis.checkin_completeness}%`}
                      band={kpis.checkin_completeness >= 95 ? 'low' : kpis.checkin_completeness >= 80 ? 'elevated' : 'critical'}
                      label="Check-in completeness"
                    />
                    <ScoreTile
                      value={`${kpis.fatigue_flag_rate}%`}
                      band={kpis.fatigue_flag_rate < 10 ? 'low' : kpis.fatigue_flag_rate < 25 ? 'elevated' : 'high'}
                      label="Fatigue flag rate"
                    />
                  </View>
                  <View style={styles.kpiGrid}>
                    <Stat label="Journeys" value={kpis.journeys_total} />
                    <Stat label="High risk" value={kpis.journeys_high_risk} />
                    <Stat label="Authorised" value={`${kpis.authorisation_rate}%`} />
                    <Stat label="Defect vehicles" value={kpis.vehicles_with_defects} />
                  </View>
                  {Object.keys(kpis.by_mode ?? {}).length > 0 ? (
                    <Text style={styles.modes}>
                      By mode:{' '}
                      {Object.entries(kpis.by_mode)
                        .map(([m, n]) => `${m} ${n}`)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Card>
              </>
            ) : null}

            <Card title={`Change & drift log (${changes.length})`}>
              {changes.length === 0 ? (
                <EmptyState text="No changes recorded." />
              ) : (
                changes.map(c => (
                  <View key={c.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{c.title}</Text>
                      <Text style={styles.spike}>
                        +{c.risk_spike_score ?? 0}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {c.change_type.replace(/_/g, ' ')} · {c.status}
                      {c.effective_from ? ` · from ${c.effective_from}` : ''}
                    </Text>
                    {c.status === 'open' ? (
                      <TouchableOpacity onPress={() => review(c)}>
                        <Text style={styles.action}>Mark reviewed</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </Card>

            <Card title="Raise a change (MOC-Lite)">
              <View style={styles.chips}>
                {CHANGE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setChangeType(t.key)}
                    style={[styles.chip, changeType === t.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, changeType === t.key && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What changed?" placeholderTextColor="#94A3B8" />
              <Text style={styles.label}>Detail</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Why, and for how long?"
                placeholderTextColor="#94A3B8"
              />
              <PrimaryButton label="Record change" onPress={raise} busy={busy} />
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

  kpiGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 10 },
  statValue: { fontSize: 15, fontWeight: '800', color: HSE_COLORS.textDark },
  statLabel: { fontSize: 9, color: HSE_COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  modes: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 10 },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4, textTransform: 'capitalize' },
  spike: { fontSize: 12, fontWeight: '800', color: HSE_COLORS.amber },
  action: { fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: 8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 11, color: HSE_COLORS.textMid },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 10, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
});
