/**
 * Supervisor · Check-in Monitor + Transport Authorisation (WF-09).
 *
 * "Live journey board, missed check-in escalation" and "Approve movements
 *  scoring ≥ 13. Set check-in interval and comms protocol."
 *
 * Both live on one screen because they are the same job: a supervisor deciding
 * whether a movement should start, then watching whether it is going to plan.
 * Overdue journeys sort to the top and refresh on a timer — a missed check-in
 * is only useful if someone sees it while it still matters.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Card, EmptyState, Loading, bandColor, HSE_COLORS } from '../components/hseiq';
import { transportService, CheckInMonitorRow, JourneyPlan } from '../services/hseiqService';

const REFRESH_MS = 60_000;

export default function CheckInMonitorScreen({ navigation }: any) {
  const [rows, setRows] = useState<CheckInMonitorRow[]>([]);
  const [pending, setPending] = useState<JourneyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      transportService.monitor().catch(() => []),
      transportService.pendingAuthorisation().catch(() => []),
    ])
      .then(([m, p]) => { setRows(m); setPending(p); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load();
    // The board is only useful if it is current — poll while it is open.
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const authorise = useCallback(
    (j: JourneyPlan, approved: boolean) => {
      transportService
        .authorise(j.id, {
          approved,
          rejection_reason: approved ? undefined : 'Not authorised by supervisor',
        })
        .then(() => {
          Alert.alert(approved ? 'Authorised' : 'Rejected',
            approved
              ? `Journey ${j.id} may depart. Check-in every ${j.checkin_interval_minutes} minutes.`
              : `Journey ${j.id} was not authorised.`);
          load();
        })
        .catch(() => Alert.alert('Could not update the journey'));
    },
    [load],
  );

  const overdue = rows.filter(r => (r.minutes_overdue ?? 0) > 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Journey Monitor</Text>
        <Text style={styles.subtitle}>
          {rows.length} in progress · {overdue.length} overdue · {pending.length} awaiting authorisation
        </Text>

        {loading ? (
          <Loading />
        ) : (
          <>
            <Card title={`Awaiting Transport Authorisation (${pending.length})`}>
              {pending.length === 0 ? (
                <EmptyState text="Nothing waiting for authorisation." />
              ) : (
                pending.map(j => (
                  <View key={j.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{j.destination || `Journey #${j.id}`}</Text>
                      <View style={[styles.pill, { backgroundColor: bandColor(j.risk_band) }]}>
                        <Text style={styles.pillText}>JRS {j.journey_risk_score}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>
                      {j.transport_mode} · route {j.route_score} × mode {j.mode_score} × cargo {j.cargo_score}
                      {j.pretrip_completed_at ? ' · pre-trip done' : ' · pre-trip outstanding'}
                    </Text>
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => authorise(j, true)}>
                        <Text style={[styles.action, { color: HSE_COLORS.pass }]}>Authorise</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => authorise(j, false)}>
                        <Text style={[styles.action, { color: HSE_COLORS.block }]}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card title={`Live journeys (${rows.length})`}>
              {rows.length === 0 ? (
                <EmptyState text="No journeys in progress." />
              ) : (
                rows.map(r => {
                  const late = (r.minutes_overdue ?? 0) > 0;
                  return (
                    <View
                      key={r.journey_plan_id}
                      style={[styles.row, late && styles.rowLate]}
                    >
                      <View style={styles.rowHead}>
                        <Text style={styles.rowTitle}>
                          {r.employee_name ?? `Employee #${r.employee_id}`}
                        </Text>
                        {late ? (
                          <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                            <Text style={styles.pillText}>{r.minutes_overdue} MIN LATE</Text>
                          </View>
                        ) : (
                          <View style={[styles.pill, { backgroundColor: HSE_COLORS.pass }]}>
                            <Text style={styles.pillText}>ON PLAN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rowMeta}>
                        {r.destination || 'in transit'} · {r.risk_band} risk
                        {r.next_due_at ? ` · next check-in ${r.next_due_at.slice(11, 16)}` : ''}
                      </Text>
                      {r.missed_count > 0 ? (
                        <Text style={styles.missed}>
                          {r.missed_count} missed check-in{r.missed_count > 1 ? 's' : ''}
                          {r.is_escalated ? ' — escalated to the control room' : ''}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
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

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLate: { backgroundColor: HSE_COLORS.blockBg, borderRadius: 8, paddingHorizontal: 10, marginBottom: 6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  rowMeta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  missed: { fontSize: 11, color: HSE_COLORS.block, fontWeight: '700', marginTop: 6 },

  actions: { flexDirection: 'row', gap: 20, marginTop: 10 },
  action: { fontSize: 13, fontWeight: '700' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
