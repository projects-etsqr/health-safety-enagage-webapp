/**
 * Auditor · Gate Override Audit (WF-06).
 *
 * "Review every fatigue and competence override — who, when, rationale.
 *  The regulatory defensibility record."
 *
 * Read-only by design. An auditor examines the decision trail, they never
 * change it — the backend enforces the same thing, so there is no write path
 * on this screen to begin with.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, EmptyState, Loading, bandColor, HSE_COLORS } from '../../components/hseiq';
import { gateService, fatigueService, OverrideRecord, FatigueDeclaration } from '../../services/hseiqService';

const FILTERS = ['all', 'accept', 'amend', 'reject'] as const;

export default function GateOverrideAuditScreen({ navigation }: any) {
  const [overrides, setOverrides] = useState<OverrideRecord[]>([]);
  const [exceptions, setExceptions] = useState<FatigueDeclaration[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      gateService.overrides().catch(() => []),
      fatigueService.auditList(90).catch(() => []),
    ])
      .then(([o, f]) => {
        setOverrides(o as OverrideRecord[]);
        setExceptions((f as FatigueDeclaration[]).filter(d => d.exception_at));
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(
    () => (filter === 'all' ? overrides : overrides.filter(o => o.decision === filter)),
    [overrides, filter],
  );

  const missingRationale = overrides.filter(o => !o.reason || o.reason.trim().length < 10).length;

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Gate Override Audit</Text>
        <Text style={styles.subtitle}>
          The regulatory defensibility record — who overrode what, when, and why.
        </Text>

        {missingRationale > 0 ? (
          <View style={styles.finding}>
            <Text style={styles.findingText}>
              Audit finding: {missingRationale} override
              {missingRationale > 1 ? 's have' : ' has'} no adequate written rationale.
            </Text>
          </View>
        ) : null}

        <View style={styles.filters}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filter, filter === f && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Loading />
        ) : (
          <>
            <Card title={`Gate overrides (${shown.length})`}>
              {shown.length === 0 ? (
                <EmptyState text="No overrides recorded for this filter." />
              ) : (
                shown.map(o => (
                  <View key={o.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>
                        {(o.gate_key || 'gate').replace(/_/g, ' ')}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: bandColor(o.original_verdict ?? 'amber') }]}>
                        <Text style={styles.pillText}>{o.decision.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.reason}>{o.reason}</Text>
                    {o.context ? <Text style={styles.meta}>Context: {o.context}</Text> : null}
                    {o.outcome ? <Text style={styles.meta}>Outcome: {o.outcome}</Text> : null}
                    <Text style={styles.who}>
                      {o.overridden_by_role ?? 'unknown role'} ·{' '}
                      {o.overridden_at?.slice(0, 16).replace('T', ' ')} ·{' '}
                      {o.original_verdict ?? '?'} → {o.resulting_verdict ?? '?'}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Card title={`Safety Manager fatigue exceptions (${exceptions.length})`}>
              {exceptions.length === 0 ? (
                <EmptyState text="No fatigue exceptions authorised." />
              ) : (
                exceptions.map(d => (
                  <View key={d.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>Employee #{d.employee_id}</Text>
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                        <Text style={styles.pillText}>F {d.fatigue_index}</Text>
                      </View>
                    </View>
                    <Text style={styles.reason}>{d.exception_reason}</Text>
                    <Text style={styles.who}>
                      Authorised {d.exception_at?.slice(0, 16).replace('T', ' ')} ·{' '}
                      {d.shift_hours}h shift, {d.consecutive_days} consecutive days
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4, lineHeight: 17 },

  finding: {
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 8,
    backgroundColor: HSE_COLORS.blockBg, borderLeftWidth: 4, borderLeftColor: HSE_COLORS.block,
  },
  findingText: { fontSize: 12, color: '#991B1B', fontWeight: '600', lineHeight: 17 },

  filters: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  filter: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  filterActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 12, color: HSE_COLORS.textMid, textTransform: 'capitalize' },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: HSE_COLORS.textDark, flex: 1, textTransform: 'capitalize' },
  reason: { fontSize: 12, color: HSE_COLORS.textMid, marginTop: 6, lineHeight: 17 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  who: { fontSize: 10, color: HSE_COLORS.textLight, marginTop: 6 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
