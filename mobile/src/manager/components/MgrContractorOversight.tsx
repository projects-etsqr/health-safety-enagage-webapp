/**
 * Safety Manager · Contractor Pre-Qualification + Scorecard (WF-08).
 *
 * "Insurance, SSIP/CHAS, 3-yr TRIR/TRIFR. >2× IOGP = reject · 1.5–2× conditional."
 * "Quarterly: <50 enhanced oversight · <30 contract review. Two quarters <30 = off list."
 *
 * The LTIFR verdict is computed server-side and shown before the manager
 * decides, so a decision that differs from the benchmark is a deliberate,
 * recorded choice rather than an accident.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Card, EmptyState, Loading, PrimaryButton, HSE_COLORS } from '../../components/hseiq';
import { contractorService, ContractorCompany } from '../../services/hseiqService';
import { KeyboardAvoider } from '../../components/layout/KeyboardAvoider';

const STATUS_COLOR: Record<string, string> = {
  approved: HSE_COLORS.pass,
  conditional: HSE_COLORS.amber,
  barred: HSE_COLORS.block,
  pending: HSE_COLORS.textMuted,
};

const VERDICT_COLOR: Record<string, string> = {
  ok: HSE_COLORS.pass,
  enhanced_oversight: HSE_COLORS.amber,
  contract_review: HSE_COLORS.block,
  off_list: HSE_COLORS.critical,
};

export default function MgrContractorOversight({ setCurrentScreen }: any) {
  const [companies, setCompanies] = useState<ContractorCompany[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [ltifr, setLtifr] = useState('');

  const load = useCallback(() => {
    Promise.all([
      contractorService.list().catch(() => []),
      contractorService.scorecards().catch(() => []),
    ])
      .then(([c, s]) => { setCompanies(c as ContractorCompany[]); setScorecards(s as any[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const add = useCallback(() => {
    if (!name.trim()) { Alert.alert('Name the company'); return; }
    setBusy(true);
    contractorService
      .create({ company_name: name.trim(), ltifr_3yr: parseFloat(ltifr) || undefined })
      .then(() => { setName(''); setLtifr(''); load(); })
      .catch(err => Alert.alert('Could not add', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [name, ltifr, load]);

  const prequalify = useCallback(
    (c: ContractorCompany) => {
      contractorService
        .prequalify(c.id, {})
        .then(r => {
          Alert.alert(
            `${r.company_name} — ${r.status}`,
            `${r.explanation}\n\nStatus recorded as "${r.status}".`,
          );
          load();
        })
        .catch(err => Alert.alert('Could not pre-qualify', err?.response?.data?.detail ?? ''));
    },
    [load],
  );

  const suspend = useCallback(
    (c: ContractorCompany) => {
      contractorService
        .suspend(c.id, !c.suspended, c.suspended ? undefined : 'Suspended by Safety Manager')
        .then(load)
        .catch(() => Alert.alert('Could not change suspension'));
    },
    [load],
  );

  const computeScorecards = useCallback(() => {
    setBusy(true);
    contractorService
      .computeScorecards()
      .then(rows => { Alert.alert('Scorecards computed', `${rows.length} contractor(s) scored.`); load(); })
      .catch(err => Alert.alert('Could not compute', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [load]);

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
          <Text style={styles.title}>Contractor Oversight</Text>
        </View>

        {loading ? (
          <Loading />
        ) : (
          <>
            <Card title={`Registry (${companies.length})`}>
              {companies.length === 0 ? (
                <EmptyState text="No contractors registered." />
              ) : (
                companies.map(c => (
                  <View key={c.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{c.company_name}</Text>
                      <View
                        style={[
                          styles.pill,
                          { backgroundColor: c.suspended ? HSE_COLORS.critical : STATUS_COLOR[c.prequalification_status] },
                        ]}
                      >
                        <Text style={styles.pillText}>
                          {c.suspended ? 'SUSPENDED' : c.prequalification_status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      3-yr LTIFR {c.ltifr_3yr ?? 'not recorded'}
                      {c.insurance_expiry ? ` · insurance to ${c.insurance_expiry}` : ''}
                    </Text>
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => prequalify(c)}>
                        <Text style={styles.action}>Pre-qualify vs IOGP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => suspend(c)}>
                        <Text style={[styles.action, { color: c.suspended ? HSE_COLORS.pass : HSE_COLORS.block }]}>
                          {c.suspended ? 'Lift suspension' : 'Suspend'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card title="Add a contractor">
              <Text style={styles.label}>Company name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Company" placeholderTextColor="#94A3B8" />
              <Text style={styles.label}>3-year LTIFR</Text>
              <TextInput
                style={styles.input}
                value={ltifr}
                onChangeText={setLtifr}
                keyboardType="numeric"
                placeholder="e.g. 1.8"
                placeholderTextColor="#94A3B8"
              />
              <PrimaryButton label="Add to registry" onPress={add} busy={busy} />
            </Card>

            <Card
              title={`Quarterly scorecards (${scorecards.length})`}
              right={
                <TouchableOpacity onPress={computeScorecards}>
                  <Text style={styles.action}>Compute</Text>
                </TouchableOpacity>
              }
            >
              {scorecards.length === 0 ? (
                <EmptyState text="No scorecards computed yet." />
              ) : (
                scorecards.map(s => (
                  <View key={s.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>
                        {companies.find(c => c.id === s.contractor_company_id)?.company_name ??
                          `Contractor #${s.contractor_company_id}`}
                      </Text>
                      <Text style={[styles.score, { color: VERDICT_COLOR[s.verdict] ?? HSE_COLORS.textDark }]}>
                        {Number(s.score).toFixed(0)}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      Q{s.period_quarter} {s.period_year} · avg RAMS{' '}
                      {s.avg_rams_score != null ? Number(s.avg_rams_score).toFixed(0) : '—'}/120 ·{' '}
                      {s.permit_violations} violation{s.permit_violations === 1 ? '' : 's'}
                    </Text>
                    <Text style={[styles.verdict, { color: VERDICT_COLOR[s.verdict] ?? HSE_COLORS.textMuted }]}>
                      {s.verdict.replace(/_/g, ' ')}
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
  header: { paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: '#2563EB', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  score: { fontSize: 15, fontWeight: '800' },
  verdict: { fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'capitalize' },

  actions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  action: { fontSize: 12, color: '#2563EB', fontWeight: '700' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 10, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
