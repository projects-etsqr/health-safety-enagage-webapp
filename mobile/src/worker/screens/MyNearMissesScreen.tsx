import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { EmptyState } from '../components/feedback/EmptyState';
import { nearMissService, type MyNearMiss, type NearMissDetail } from '../services/nearMissService';
import { Colors } from '../theme/colors';

/**
 * The near misses this worker reported, and what has happened to each since.
 *
 * A worker could report a near miss and then never hear anything again — the
 * app had a form and nothing behind it. That is worse than a gap in the UI: a
 * reporter who never sees an outcome stops reporting, and near misses are the
 * one event family whose whole value is volume.
 *
 * The same screen `MyHazardsScreen` gives the register, for the same reason.
 */

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

/**
 * What is happening to the near miss, worded for the person who reported it.
 *
 * Deliberately not the supervisor's wording: "pending_approval" means nothing
 * to a labourer, and "waiting on the manager" is the only part of it they can
 * act on — by chasing, or by knowing not to.
 */
const STATUS_FOR_WORKER: Record<string, string> = {
  reported: 'Reported — your supervisor has not picked it up yet',
  acknowledged: 'Your supervisor has taken it on and is making the area safe',
  under_investigation: 'Being investigated to find out why it nearly happened',
  escalated: 'Escalated to the manager',
  pending_approval: 'Investigation done — with the manager for approval',
  capa_open: 'A corrective action is being carried out',
  pending_verification: 'The fix is in — being checked that it actually worked',
  investigated: 'The fix is in — being checked that it actually worked',
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

const CONSEQUENCE_LABEL: Record<string, string> = {
  minor_injury: 'Minor injury',
  lost_time_injury: 'Lost time injury',
  property_damage: 'Property damage',
  environmental_impact: 'Environmental impact',
};

export default function MyNearMissesScreen({ navigation }: any) {
  const [rows, setRows] = useState<MyNearMiss[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Detail is fetched only when a card is opened: the list endpoint carries the
  // stage but not the root cause or the lesson, and pulling all of it for every
  // row would make the list slower for the common case of just checking progress.
  const [detail, setDetail] = useState<NearMissDetail | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    nearMissService.myNearMisses()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener?.('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const toggle = async (row: MyNearMiss) => {
    if (expanded === row.id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(row.id);
    setDetail(null);
    try {
      setDetail(await nearMissService.getNearMiss(row.id));
    } catch {
      setDetail(null);
    }
  };

  return (
    <ScreenLayout>
      <AppHeader title="My Near Misses" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="⚠️"
            title="No near misses reported"
            subtitle="Anything you report appears here, with how far along it is."
          />
        ) : (
          rows.map(nm => {
            const isOpen = expanded === nm.id;
            const status = nm.workflow_status ?? '';
            const overdue = Boolean(
              nm.response_due_at && status !== 'closed' &&
              new Date(nm.response_due_at).getTime() < Date.now(),
            );

            return (
              <TouchableOpacity
                key={nm.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => toggle(nm)}
              >
                <View style={styles.headerRow}>
                  <Text style={styles.title} numberOfLines={isOpen ? undefined : 2}>
                    {nm.description || `Near miss ${nm.id}`}
                  </Text>
                  {!!nm.assessed_priority && (
                    <View style={[styles.prio, { backgroundColor: PRIORITY_COLOR[nm.assessed_priority] ?? '#64748B' }]}>
                      <Text style={styles.prioText}>{nm.assessed_priority}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.meta}>
                  NEA-{nm.id}
                  {nm.severity ? ` · ${nm.severity}` : ''}
                  {nm.reported_at ? ` · ${timeAgo(nm.reported_at)}` : ''}
                </Text>

                {nm.is_hipo ? (
                  <Text style={styles.hipo}>
                    HIGH POTENTIAL — this could have been serious
                  </Text>
                ) : null}

                <Text style={styles.status}>
                  {STATUS_FOR_WORKER[status] ?? status}
                </Text>

                {overdue ? (
                  <Text style={styles.overdue}>
                    Past its response deadline — chase your supervisor if it is still there.
                  </Text>
                ) : null}

                {isOpen && (
                  <View style={styles.detail}>
                    {detail === null ? (
                      <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />
                    ) : (
                      <>
                        {!!detail.details?.potential_consequence && (
                          <Detail
                            label="WHAT COULD HAVE HAPPENED"
                            value={
                              CONSEQUENCE_LABEL[detail.details.potential_consequence] ??
                              String(detail.details.potential_consequence)
                            }
                          />
                        )}
                        {!!detail.immediate_actions_taken && (
                          <Detail label="WHAT WAS DONE STRAIGHT AWAY" value={detail.immediate_actions_taken} />
                        )}
                        {!!detail.root_cause && (
                          <Detail label="ROOT CAUSE FOUND" value={detail.root_cause} />
                        )}
                        {/* The lesson is the point of reporting a near miss.
                            Showing it back to the reporter is what makes the
                            loop visibly close. */}
                        {!!detail.closure_notes && (
                          <Detail label="HOW IT WAS CLOSED" value={detail.closure_notes} />
                        )}
                        {!detail.root_cause && !detail.immediate_actions_taken && (
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
  detailBlock: { marginBottom: 10 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 3 },
  detailValue: { fontSize: 12.5, color: '#334155', lineHeight: 18 },
  pending: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  expandHint: { fontSize: 10, color: '#CBD5E1', marginTop: 10, fontWeight: '700' },
});
