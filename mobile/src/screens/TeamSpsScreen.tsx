/**
 * Supervisor · Team SPS View (WF-07).
 *
 * "Five domain sub-scores for own area, red-line KPI alerts."
 *
 * The domains are ordered by weighted contribution rather than by the spec's
 * listing order, so the biggest lever is at the top — that is what a supervisor
 * can actually act on this week.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Card, DomainBar, ScoreTile, EmptyState, Loading, bandColor, HSE_COLORS } from '../components/hseiq';
import { spsService, SpsScore, SpsAlert } from '../services/hseiqService';

const DOMAIN_LABELS: Record<string, string> = {
  hazard_exposure: 'Hazard Exposure',
  control_integrity: 'Control Integrity',
  work_discipline: 'Work Authorisation & Discipline',
  human_readiness: 'Human Readiness & Capacity',
  org_health: 'Organisational & System Health',
};

export default function TeamSpsScreen({ navigation }: any) {
  const [score, setScore] = useState<SpsScore | null>(null);
  const [alerts, setAlerts] = useState<SpsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([spsService.team().catch(() => null), spsService.alerts().catch(() => [])])
      .then(([s, a]) => { setScore(s); setAlerts(a as SpsAlert[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const ranked = useMemo(() => {
    if (!score) return [];
    return Object.entries(score.domains)
      .map(([k, v]) => ({ key: k, label: DOMAIN_LABELS[k] ?? k, value: v, weight: score.weights[k] ?? 0 }))
      .sort((a, b) => b.value * b.weight - a.value * a.weight);
  }, [score]);

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Team Safety Performance</Text>
        <Text style={styles.subtitle}>
          Weekly, server-calculated. Higher is worse — this is a risk score.
        </Text>

        {loading ? (
          <Loading />
        ) : !score ? (
          <EmptyState text="The Safety Performance Score could not be loaded." />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <ScoreTile
                  value={score.sps.toFixed(1)}
                  band={score.band}
                  label="Safety Performance Score"
                  sub={
                    score.delta != null
                      ? `${score.delta >= 0 ? '+' : ''}${score.delta.toFixed(1)} on last period`
                      : undefined
                  }
                />
                <View style={styles.side}>
                  <Text style={styles.period}>
                    {score.period_start} → {score.period_end}
                  </Text>
                  {score.stale_data_penalty > 0 ? (
                    <Text style={styles.penalty}>
                      +{score.stale_data_penalty} stale-data penalty. Data completeness{' '}
                      {score.data_completeness}%.
                    </Text>
                  ) : (
                    <Text style={styles.ok}>All feeds current.</Text>
                  )}
                </View>
              </View>
            </Card>

            <Card title="Five domains — biggest lever first">
              {ranked.map(d => (
                <DomainBar key={d.key} name={d.label} score={d.value} weight={d.weight} />
              ))}
              <Text style={styles.formula}>{score.explanation}</Text>
            </Card>

            <Card title={`Red-line alerts (${alerts.length})`}>
              {alerts.length === 0 ? (
                <EmptyState text="No open alerts." />
              ) : (
                alerts.map(a => (
                  <View key={a.id} style={[styles.alert, { borderLeftColor: bandColor(a.new_band ?? 'elevated') }]}>
                    <Text style={styles.alertType}>{a.alert_type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.alertMsg}>{a.message}</Text>
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
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  side: { flex: 1.2, justifyContent: 'center', paddingLeft: 10 },
  period: { fontSize: 11, color: HSE_COLORS.textMuted },
  penalty: { fontSize: 11, color: HSE_COLORS.amber, marginTop: 8, fontWeight: '600', lineHeight: 16 },
  ok: { fontSize: 11, color: HSE_COLORS.pass, marginTop: 8, fontWeight: '600' },

  formula: { fontSize: 10, color: HSE_COLORS.textLight, marginTop: 6, lineHeight: 15 },

  alert: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 8, marginBottom: 8 },
  alertType: { fontSize: 11, fontWeight: '800', color: HSE_COLORS.textDark, textTransform: 'uppercase' },
  alertMsg: { fontSize: 12, color: HSE_COLORS.textMuted, marginTop: 3, lineHeight: 17 },
});
