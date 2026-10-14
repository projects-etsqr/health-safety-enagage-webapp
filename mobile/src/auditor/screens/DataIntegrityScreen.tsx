/**
 * Auditor · Data Integrity & Validation (WF-07) — the Data Quality Gate.
 *
 * "Verify feeds current — any source >14 days stale = Data Gap, applying a
 *  10-point SPS penalty. Confidence-score review."
 *
 * This is the screen that stops a clean-looking dashboard from being trusted
 * when it is really just empty. "Stale feeds are penalised, not silently
 * trusted" is the rule, and an auditor needs to see which feed caused it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Card, ScoreTile, EmptyState, Loading, HSE_COLORS } from '../../components/hseiq';
import { spsService } from '../../services/hseiqService';

const FRIENDLY: Record<string, string> = {
  training_records: 'Training records',
  fatigue_declarations: 'Fatigue declarations',
  competence_matrix: 'Competence matrix',
  contractor_companies: 'Contractor registry',
  vehicles: 'Vehicle register',
  rams_scores: 'RAMS scores',
  journey_plans: 'Journey plans',
};

export default function DataIntegrityScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [sps, setSps] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([spsService.dataQuality().catch(() => null), spsService.score().catch(() => null)])
      .then(([dq, s]) => { setData(dq); setSps(s); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Data Integrity & Validation</Text>
        <Text style={styles.subtitle}>
          Any source not verified in {data?.stale_threshold_days ?? 14} days is a Data Gap.
        </Text>

        {loading ? (
          <Loading />
        ) : !data ? (
          <EmptyState text="The data quality gate could not be run." />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <ScoreTile
                  value={data.stale_sources}
                  band={data.stale_sources > 0 ? 'high' : 'low'}
                  label="Stale feeds"
                />
                <ScoreTile
                  value={`${data.confidence_score}%`}
                  band={data.confidence_score >= 80 ? 'low' : data.confidence_score >= 50 ? 'elevated' : 'critical'}
                  label="Confidence"
                />
              </View>
              {data.penalty_applied > 0 ? (
                <Text style={styles.penalty}>
                  A {data.penalty_applied}-point penalty is being applied to the Safety Performance
                  Score{sps ? ` (currently ${sps.sps}, ${sps.band})` : ''} because at least one feed
                  is out of date. The score is worse than the raw numbers suggest, deliberately.
                </Text>
              ) : (
                <Text style={styles.clean}>
                  All feeds are current. No data-quality penalty is being applied.
                </Text>
              )}
            </Card>

            <Card title="Source feeds">
              {(data.rows ?? []).map((r: any) => (
                <View key={r.source_table} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowTitle}>{FRIENDLY[r.source_table] ?? r.source_table}</Text>
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: r.is_data_gap ? HSE_COLORS.block : HSE_COLORS.pass },
                      ]}
                    >
                      <Text style={styles.pillText}>{r.is_data_gap ? 'DATA GAP' : 'CURRENT'}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {r.record_count} record{r.record_count === 1 ? '' : 's'} ·{' '}
                    {r.last_verified_at
                      ? `last verified ${r.last_verified_at.slice(0, 10)}${
                          r.days_stale != null ? ` (${r.days_stale} days ago)` : ''
                        }`
                      : 'never verified'}
                  </Text>
                </View>
              ))}
            </Card>

            <Card title="What this means">
              <Text style={styles.explain}>
                The Safety Performance Score is only as good as the field capture behind it. A feed
                that has gone quiet does not make a site safer — it makes the score less
                trustworthy, so the platform penalises the gap rather than reporting a clean number
                it cannot support. Gaps here are where mobile reporting has stopped, and they are a
                finding in their own right.
              </Text>
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
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  penalty: { fontSize: 12, color: HSE_COLORS.block, marginTop: 8, lineHeight: 18, fontWeight: '600' },
  clean: { fontSize: 12, color: HSE_COLORS.pass, marginTop: 8, lineHeight: 18, fontWeight: '600' },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  explain: { fontSize: 12, color: HSE_COLORS.textMuted, lineHeight: 18 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
