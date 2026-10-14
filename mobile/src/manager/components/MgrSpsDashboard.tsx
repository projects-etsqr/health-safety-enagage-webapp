/**
 * Safety Manager · SPS Dashboard + alerts (WF-07).
 *
 * "Weekly 0–100, five domain breakdown. Bands Critical ≥75 · High 50–74 ·
 *  Elevated 25–49 · Acceptable 10–24 · Low <10."
 * "SPS Alerts & CAPA Lookup — fires on Δ ≥ 10 pts/week, band change, or KPI
 *  red-line. 2–3 pre-defined CAPAs per KPI."
 *
 * Acknowledging an alert can raise the CAPA in the same tap, because an alert
 * nobody actions is just a number that moved.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import {
  Card, DomainBar, ScoreTile, EmptyState, Loading, PrimaryButton, bandColor, HSE_COLORS,
} from '../../components/hseiq';
import { spsService, SpsScore, SpsAlert } from '../../services/hseiqService';

const DOMAIN_LABELS: Record<string, string> = {
  hazard_exposure: 'Hazard Exposure',
  control_integrity: 'Control Integrity',
  work_discipline: 'Work Authorisation & Discipline',
  human_readiness: 'Human Readiness & Capacity',
  org_health: 'Organisational & System Health',
};

export default function MgrSpsDashboard({ setCurrentScreen }: any) {
  const [score, setScore] = useState<SpsScore | null>(null);
  const [alerts, setAlerts] = useState<SpsAlert[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      spsService.score().catch(() => null),
      spsService.alerts().catch(() => []),
      spsService.history(12).catch(() => []),
    ])
      .then(([s, a, h]) => { setScore(s); setAlerts(a as SpsAlert[]); setHistory(h as any[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const ranked = useMemo(() => {
    if (!score) return [];
    return Object.entries(score.domains)
      .map(([k, v]) => ({ key: k, label: DOMAIN_LABELS[k] ?? k, value: v, weight: score.weights[k] ?? 0 }))
      .sort((a, b) => b.value * b.weight - a.value * a.weight);
  }, [score]);

  const runBatch = useCallback(() => {
    setBusy(true);
    spsService
      .compute()
      .then(() => { Alert.alert('Weekly batch complete', 'Snapshot stored and any alerts raised.'); load(); })
      .catch(err => Alert.alert('Could not run the batch', err?.response?.data?.detail ?? ''))
      .finally(() => setBusy(false));
  }, [load]);

  const ack = useCallback(
    (a: SpsAlert, withCapa: boolean) => {
      const suggestion = a.suggested_capa?.[0];
      spsService
        .ackAlert(a.id, {
          create_capa: withCapa,
          capa_description: suggestion?.action ?? a.message ?? undefined,
          due_days: suggestion?.due_days ?? 14,
        })
        .then(() => {
          Alert.alert(withCapa ? 'CAPA raised' : 'Acknowledged');
          load();
        })
        .catch(() => Alert.alert('Could not acknowledge the alert'));
    },
    [load],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentScreen('app')}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Safety Performance Score</Text>
        </View>

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
                  label="SPS (0–100, higher is worse)"
                  sub={
                    score.delta != null
                      ? `${score.delta >= 0 ? '+' : ''}${score.delta.toFixed(1)} week on week`
                      : 'no prior snapshot'
                  }
                />
                <View style={styles.side}>
                  <Text style={styles.period}>{score.period_start} → {score.period_end}</Text>
                  {score.stale_data_penalty > 0 ? (
                    <Text style={styles.penalty}>
                      Includes a +{score.stale_data_penalty} stale-data penalty. Completeness{' '}
                      {score.data_completeness}%.
                    </Text>
                  ) : (
                    <Text style={styles.ok}>All feeds current.</Text>
                  )}
                  <Text style={styles.note}>Server-calculated. No manual entry anywhere.</Text>
                </View>
              </View>
            </Card>

            <Card title="Five domains — weighted, biggest lever first">
              {ranked.map(d => (
                <DomainBar key={d.key} name={d.label} score={d.value} weight={d.weight} />
              ))}
              <Text style={styles.formula}>{score.explanation}</Text>
            </Card>

            <Card
              title={`Alerts (${alerts.length})`}
              right={
                <Text style={styles.hint}>Δ≥10 · band change · red-line</Text>
              }
            >
              {alerts.length === 0 ? (
                <EmptyState text="No open alerts." />
              ) : (
                alerts.map(a => (
                  <View key={a.id} style={[styles.alert, { borderLeftColor: bandColor(a.new_band ?? 'elevated') }]}>
                    <Text style={styles.alertType}>{a.alert_type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.alertMsg}>{a.message}</Text>
                    {a.suggested_capa && a.suggested_capa.length > 0 ? (
                      <Text style={styles.capa}>Suggested: {a.suggested_capa[0].action}</Text>
                    ) : null}
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => ack(a, false)}>
                        <Text style={styles.action}>Acknowledge</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => ack(a, true)}>
                        <Text style={[styles.action, { color: HSE_COLORS.block }]}>Acknowledge + raise CAPA</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </Card>

            {history.length > 0 ? (
              <Card title="Trend">
                {history.slice(0, 8).map((h: any) => (
                  <View key={h.id} style={styles.histRow}>
                    <Text style={styles.histDate}>{h.period_end}</Text>
                    <View style={styles.histTrack}>
                      <View
                        style={[
                          styles.histFill,
                          { width: `${Math.min(100, h.sps)}%`, backgroundColor: bandColor(h.band) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.histVal, { color: bandColor(h.band) }]}>{Number(h.sps).toFixed(0)}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={{ paddingHorizontal: 16 }}>
              <PrimaryButton label="Run weekly batch now" onPress={runBatch} busy={busy} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: '#2563EB', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark },

  side: { flex: 1.2, justifyContent: 'center', paddingLeft: 10 },
  period: { fontSize: 11, color: HSE_COLORS.textMuted },
  penalty: { fontSize: 11, color: HSE_COLORS.amber, marginTop: 6, fontWeight: '600', lineHeight: 16 },
  ok: { fontSize: 11, color: HSE_COLORS.pass, marginTop: 6, fontWeight: '600' },
  note: { fontSize: 10, color: HSE_COLORS.textLight, marginTop: 8, fontStyle: 'italic' },
  formula: { fontSize: 10, color: HSE_COLORS.textLight, marginTop: 6, lineHeight: 15 },
  hint: { fontSize: 10, color: HSE_COLORS.textLight },

  alert: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 10, marginBottom: 10 },
  alertType: { fontSize: 11, fontWeight: '800', color: HSE_COLORS.textDark, textTransform: 'uppercase' },
  alertMsg: { fontSize: 12, color: HSE_COLORS.textMuted, marginTop: 3, lineHeight: 17 },
  capa: { fontSize: 11, color: '#1E40AF', marginTop: 6, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  action: { fontSize: 12, color: '#2563EB', fontWeight: '700' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  histDate: { fontSize: 10, color: HSE_COLORS.textMuted, width: 74 },
  histTrack: { flex: 1, height: 8, backgroundColor: '#EEF2F7', borderRadius: 4, overflow: 'hidden' },
  histFill: { height: 8, borderRadius: 4 },
  histVal: { fontSize: 11, fontWeight: '800', width: 26, textAlign: 'right' },
});
