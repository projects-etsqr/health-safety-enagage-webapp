import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { EmptyState } from '../components/feedback/EmptyState';
import { riskService, type MyRisk, type RiskDetail } from '../services/riskService';
import { Colors } from '../theme/colors';

/**
 * The risk observations this worker reported, and what has happened to each
 * since.
 *
 * The same gap `MyNearMissesScreen` and `MyHazardsScreen` closed, for the last
 * family that still had a form and nothing behind it: a worker could report an
 * unsafe condition and never learn whether anyone acted on it. Worse here than
 * for a near miss — a risk observation is usually about something still on site,
 * so "was it dealt with" is a question the reporter has a live interest in.
 *
 * Reads `risk_reports`. The standing register is a different list on a different
 * screen (My Hazards), and the two are kept visibly apart: this one is titled
 * for what the worker did — reported something they saw — and shows RIS- refs.
 *
 * Stage fields come from the backend's derivation, not a mapping of our own, so
 * all four roles see one answer.
 */

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

/** Matches `risk_scoring.score_risk` and the console's BAND_COLOR. */
const BAND_COLOR: Record<string, string> = {
  Low: '#16A34A', Medium: '#CA8A04', High: '#EA580C', Critical: '#DC2626',
};

/**
 * What is happening to the risk, worded for the person who reported it.
 *
 * Deliberately not the supervisor's wording: "pending_approval" means nothing
 * to a labourer, and "waiting on the manager" is the only part of it they can
 * act on — by chasing, or by knowing not to.
 */
const STATUS_FOR_WORKER: Record<string, string> = {
  reported: 'Reported — your supervisor has not picked it up yet',
  acknowledged: 'Your supervisor has taken it on and is making the area safe',
  under_investigation: 'Being looked into to find out why the risk was there',
  escalated: 'Escalated to the manager',
  pending_approval: 'Assessment done — with the manager for approval',
  capa_open: 'A control is being put in place',
  pending_verification: 'The control is in — being checked that it actually worked',
  investigated: 'The control is in — being checked that it actually worked',
  approved: 'Confirmed effective — being closed out',
  closed: 'Closed',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MyRiskReportsScreen({ navigation }: any) {
  const [rows, setRows] = useState<MyRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Detail is fetched only when a card is opened: the list endpoint carries the
  // stage but not the score, the controls or the root cause, and pulling all of
  // it for every row would make the list slower for the common case of just
  // checking progress.
  const [detail, setDetail] = useState<RiskDetail | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    riskService.myRisks()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener?.('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const toggle = async (row: MyRisk) => {
    if (expanded === row.id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(row.id);
    setDetail(null);
    try {
      setDetail(await riskService.getRisk(row.id));
    } catch {
      setDetail(null);
    }
  };

  return (
    <ScreenLayout>
      <AppHeader title="My Risk Reports" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🛡️"
            title="No risks reported"
            subtitle="Anything you report appears here, with how far along it is."
          />
        ) : (
          rows.map(rk => {
            const isOpen = expanded === rk.id;
            const status = rk.workflow_status ?? '';
            const overdue = Boolean(
              rk.response_due_at && status !== 'closed' &&
              new Date(rk.response_due_at).getTime() < Date.now(),
            );
            const d = isOpen ? detail?.details : undefined;
            const band = d?.risk_band ?? null;
            const blocksWork = Boolean(d?.blocks_work);

            return (
              <TouchableOpacity
                key={rk.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => toggle(rk)}
              >
                <View style={styles.headerRow}>
                  <Text style={styles.title} numberOfLines={isOpen ? undefined : 2}>
                    {rk.description || `Risk ${rk.id}`}
                  </Text>
                  {!!rk.assessed_priority && (
                    <View style={[styles.prio, { backgroundColor: PRIORITY_COLOR[rk.assessed_priority] ?? '#64748B' }]}>
                      <Text style={styles.prioText}>{rk.assessed_priority}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.meta}>
                  RIS-{rk.id}
                  {rk.severity ? ` · ${rk.severity}` : ''}
                  {rk.reported_at ? ` · ${timeAgo(rk.reported_at)}` : ''}
                </Text>

                {rk.is_hipo ? (
                  <Text style={styles.hipo}>
                    HIGH POTENTIAL — this could have been serious
                  </Text>
                ) : null}

                <Text style={styles.status}>
                  {STATUS_FOR_WORKER[status] ?? status}
                </Text>

                {overdue ? (
                  <Text style={styles.overdue}>
                    Past its response deadline — chase your supervisor if the risk is still there.
                  </Text>
                ) : null}

                {isOpen && (
                  <View style={styles.detail}>
                    {detail === null ? (
                      <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {/* The rating the report produced. The reporter chose the
                            likelihood and consequence, so they are owed the
                            number those answers came to and what it means. */}
                        {(band || d?.adjusted_risk_score != null) && (
                          <View style={styles.scoreRow}>
                            {!!band && (
                              <View style={[styles.band, { backgroundColor: BAND_COLOR[band] ?? '#64748B' }]}>
                                <Text style={styles.bandText}>{band.toUpperCase()}</Text>
                              </View>
                            )}
                            {d?.adjusted_risk_score != null && (
                              <Text style={styles.scoreText}>
                                Score {d.adjusted_risk_score}
                                {d.risk_score != null && d.adjusted_risk_score !== d.risk_score
                                  ? ` (${d.risk_score} + ${d.uplift_total ?? 0})`
                                  : ''}
                              </Text>
                            )}
                          </View>
                        )}
                        {blocksWork ? (
                          <Text style={styles.blocks}>
                            WORK IS BLOCKED until a control is in place. Do not carry on in this area.
                          </Text>
                        ) : null}
                        {!!d?.risk_explanation && (
                          <Detail label="WHY IT WAS RATED THIS WAY" value={d.risk_explanation} />
                        )}
                        {!!d?.existing_controls && (
                          <Detail label="CONTROLS ALREADY IN PLACE" value={d.existing_controls} />
                        )}
                        {!!detail.immediate_actions_taken && (
                          <Detail label="WHAT WAS DONE STRAIGHT AWAY" value={detail.immediate_actions_taken} />
                        )}
                        {!!detail.root_cause && (
                          <Detail label="ROOT CAUSE FOUND" value={detail.root_cause} />
                        )}
                        {!!d?.suggested_controls && (
                          <Detail label="CONTROLS PUT FORWARD" value={d.suggested_controls} />
                        )}
                        {/* Closing the loop back to the reporter is what keeps
                            people reporting the next one. */}
                        {!!detail.closure_notes && (
                          <Detail label="HOW IT WAS CLOSED" value={detail.closure_notes} />
                        )}
                        {!detail.root_cause && !detail.immediate_actions_taken && !band && (
                          <Text style={styles.pending}>
                            Nothing has been written against it yet.
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}

                <Text style={styles.expandHint}>{isOpen ? 'Tap to collapse' : 'Tap for detail'}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
    padding: 16, marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '800', color: '#1E293B' },
  prio: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prioText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 5, fontWeight: '600' },
  hipo: {
    fontSize: 10.5, fontWeight: '800', color: '#B91C1C', marginTop: 6,
    letterSpacing: 0.3,
  },
  status: { fontSize: 12.5, color: '#334155', lineHeight: 18, marginTop: 4 },
  overdue: {
    fontSize: 11.5, color: '#B45309', marginTop: 8, backgroundColor: '#FFFBEB',
    borderRadius: 8, padding: 9, lineHeight: 16,
  },
  detail: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  band: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  bandText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  scoreText: { fontSize: 12, color: '#475569', fontWeight: '700' },
  blocks: {
    fontSize: 11.5, color: '#B91C1C', backgroundColor: '#FEF2F2', borderRadius: 8,
    padding: 9, lineHeight: 16, marginBottom: 10, fontWeight: '700',
  },
  detailBlock: { marginBottom: 10 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 3 },
  detailValue: { fontSize: 12.5, color: '#334155', lineHeight: 18 },
  pending: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  expandHint: { fontSize: 10, color: '#CBD5E1', marginTop: 10, fontWeight: '700' },
});
