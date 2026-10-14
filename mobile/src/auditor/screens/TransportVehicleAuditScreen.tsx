/**
 * Auditor · Transport & Vehicle Audit (WF-09).
 *
 * "Pre-trip sampling, licence & roadworthiness, check-in log completeness,
 *  post-movement reviews."
 *
 * Check-in completeness is the headline number: a journey plan nobody checked
 * into is a control that existed only on paper.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, ScoreTile, EmptyState, Loading, bandColor, HSE_COLORS } from '../../components/hseiq';
import { transportService, JourneyPlan, Vehicle } from '../../services/hseiqService';

const isExpired = (d?: string | null) => !!d && new Date(d) < new Date();

export default function TransportVehicleAuditScreen({ navigation }: any) {
  const [journeys, setJourneys] = useState<JourneyPlan[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      transportService.auditList(90).catch(() => []),
      transportService.vehicles().catch(() => []),
      transportService.kpis(90).catch(() => null),
    ])
      .then(([j, v, k]) => { setJourneys(j as JourneyPlan[]); setVehicles(v as Vehicle[]); setKpis(k); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const open = useCallback((j: JourneyPlan) => {
    if (expanded === j.id) { setExpanded(null); setCheckIns([]); return; }
    setExpanded(j.id);
    setCheckIns([]);
    transportService.checkIns(j.id).then(setCheckIns).catch(() => setCheckIns([]));
  }, [expanded]);

  const noPreTrip = journeys.filter(j => !j.pretrip_completed_at);
  const defectVehicles = vehicles.filter(v => v.defect_status !== 'none');
  const expiredDocs = vehicles.filter(v => isExpired(v.roadworthiness_expiry));

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Transport & Vehicle Audit</Text>
        <Text style={styles.subtitle}>Pre-trip sampling, roadworthiness and check-in completeness.</Text>

        {loading ? (
          <Loading />
        ) : (
          <>
            {kpis ? (
              <Card>
                <View style={{ flexDirection: 'row' }}>
                  <ScoreTile
                    value={`${kpis.checkin_completeness}%`}
                    band={kpis.checkin_completeness >= 95 ? 'low' : kpis.checkin_completeness >= 80 ? 'elevated' : 'critical'}
                    label="Check-in completeness"
                  />
                  <ScoreTile
                    value={kpis.checkins_missed}
                    band={kpis.checkins_missed > 0 ? 'high' : 'low'}
                    label="Missed check-ins"
                  />
                </View>
                <Text style={styles.kpiMeta}>
                  {kpis.journeys_total} journeys · {kpis.journeys_high_risk} high risk ·{' '}
                  {kpis.authorisation_rate}% of high-risk journeys authorised ·{' '}
                  {kpis.fatigue_flag_rate}% fatigue flag rate
                </Text>
              </Card>
            ) : null}

            {(noPreTrip.length > 0 || expiredDocs.length > 0) ? (
              <View style={styles.finding}>
                {noPreTrip.length > 0 ? (
                  <Text style={styles.findingText}>
                    {noPreTrip.length} journey{noPreTrip.length > 1 ? 's' : ''} with no recorded
                    pre-trip inspection.
                  </Text>
                ) : null}
                {expiredDocs.length > 0 ? (
                  <Text style={styles.findingText}>
                    {expiredDocs.length} vehicle{expiredDocs.length > 1 ? 's' : ''} with expired
                    roadworthiness.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Card title={`Vehicles (${vehicles.length})`}>
              {vehicles.length === 0 ? (
                <EmptyState text="No vehicles on the register." />
              ) : (
                vehicles.map(v => (
                  <View key={v.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{v.registration}</Text>
                      <View
                        style={[
                          styles.pill,
                          { backgroundColor: v.defect_status === 'none' ? HSE_COLORS.pass : HSE_COLORS.block },
                        ]}
                      >
                        <Text style={styles.pillText}>{v.defect_status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      {v.vehicle_type ?? 'Vehicle'}
                      {v.roadworthiness_expiry
                        ? ` · roadworthy to ${v.roadworthiness_expiry}${isExpired(v.roadworthiness_expiry) ? ' (EXPIRED)' : ''}`
                        : ' · roadworthiness not recorded'}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            <Card title={`Journeys sampled (${journeys.length})`}>
              {journeys.length === 0 ? (
                <EmptyState text="No journeys in this period." />
              ) : (
                journeys.slice(0, 25).map(j => (
                  <View key={j.id}>
                    <TouchableOpacity style={styles.row} onPress={() => open(j)} activeOpacity={0.7}>
                      <View style={styles.rowHead}>
                        <Text style={styles.rowTitle}>{j.destination || `Journey #${j.id}`}</Text>
                        <View style={[styles.pill, { backgroundColor: bandColor(j.risk_band) }]}>
                          <Text style={styles.pillText}>JRS {j.journey_risk_score}</Text>
                        </View>
                      </View>
                      <Text style={styles.meta}>
                        {j.transport_mode} · {j.status.replace(/_/g, ' ')}
                        {j.pretrip_completed_at ? ' · pre-trip done' : ' · NO PRE-TRIP'}
                        {j.requires_authorisation
                          ? j.authorised_at ? ' · authorised' : ' · NOT AUTHORISED'
                          : ''}
                      </Text>
                    </TouchableOpacity>

                    {expanded === j.id ? (
                      <View style={styles.detail}>
                        {checkIns.length === 0 ? (
                          <Text style={styles.mutedSmall}>No check-in events recorded.</Text>
                        ) : (
                          checkIns.map((c: any) => (
                            <View key={c.id} style={styles.ciRow}>
                              <Text style={styles.ciSeq}>#{c.sequence_no}</Text>
                              <Text style={styles.ciDue}>due {c.due_at?.slice(5, 16).replace('T', ' ')}</Text>
                              <Text
                                style={[
                                  styles.ciStatus,
                                  { color: c.checked_in_at ? (c.missed ? HSE_COLORS.amber : HSE_COLORS.pass) : HSE_COLORS.block },
                                ]}
                              >
                                {c.checked_in_at ? (c.missed ? 'late' : 'on time') : 'missed'}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
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
  kpiMeta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 8, lineHeight: 16 },

  finding: {
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 8,
    backgroundColor: HSE_COLORS.blockBg, borderLeftWidth: 4, borderLeftColor: HSE_COLORS.block,
  },
  findingText: { fontSize: 12, color: '#991B1B', fontWeight: '600', lineHeight: 18 },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },

  detail: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 10 },
  ciRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 },
  ciSeq: { fontSize: 11, color: HSE_COLORS.textMuted, width: 30 },
  ciDue: { fontSize: 11, color: HSE_COLORS.textMid, flex: 1 },
  ciStatus: { fontSize: 11, fontWeight: '700' },
  mutedSmall: { fontSize: 12, color: HSE_COLORS.textMuted },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
