import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { EmptyState } from '../components/feedback/EmptyState';
import { myIncidentsService, type MyIncident } from '../services/incidentService';
import { Colors } from '../theme/colors';

/**
 * The incidents this worker reported, and what has happened to each since.
 *
 * The last family to get one of these screens, and only because it looked like
 * it already had one: Recent Submissions on the Reports screen used to be the
 * incident list, so incidents appeared to be covered while near misses, risks
 * and hazards each needed their own. Once that list took in all five families
 * it became a history of everything rather than a place to follow one thing,
 * and incidents were left as the only family a worker could report without
 * being able to follow.
 *
 * What this shows that its three siblings do not is the statutory line. An
 * incident can be reportable to the regulator, on a legal clock, and the person
 * who raised it is the one most likely to be asked about it.
 */

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

/**
 * What is happening to the incident, worded for the person who reported it.
 *
 * Not the investigator's vocabulary: "pending_approval" tells a labourer
 * nothing, and "waiting on the manager" is the only part they can act on.
 */
const STATUS_FOR_WORKER: Record<string, string> = {
  reported: 'Reported — your supervisor has not picked it up yet',
  acknowledged: 'Your supervisor has taken it on and is making the area safe',
  under_investigation: 'Being investigated to find out what went wrong',
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

export default function MyIncidentsScreen({ navigation }: any) {
  const [rows, setRows] = useState<MyIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    myIncidentsService.mine()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener?.('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  return (
    <ScreenLayout>
      <AppHeader title="My Incidents" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🚨"
            title="No incidents reported"
            subtitle="Anything you report appears here, with how far along it is."
          />
        ) : (
          rows.map(inc => {
            const status = inc.workflow_status ?? '';
            const overdue = Boolean(
              inc.investigation_due_at && status !== 'closed' &&
              new Date(inc.investigation_due_at).getTime() < Date.now(),
            );

            return (
              <View key={inc.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {inc.description || `Incident ${inc.id}`}
                  </Text>
                  {!!inc.severity_priority && (
                    <View style={[styles.prio, { backgroundColor: PRIORITY_COLOR[inc.severity_priority] ?? '#64748B' }]}>
                      <Text style={styles.prioText}>{inc.severity_priority}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.meta}>
                  INC-{inc.id}
                  {inc.incident_type ? ` · ${inc.incident_type}` : ''}
                  {inc.reported_at ? ` · ${timeAgo(inc.reported_at)}` : ''}
                </Text>

                {!!inc.severity_label && (
                  <Text style={styles.severityLabel}>{inc.severity_label}</Text>
                )}

                {inc.is_hipo ? (
                  <Text style={styles.hipo}>HIGH POTENTIAL — this could have been far worse</Text>
                ) : null}

                {/* The one thing this screen has that its siblings do not. A
                    reportable incident is on a legal clock and the reporter is
                    the person most likely to be asked about it. */}
                {inc.statutory_reportable ? (
                  <Text style={styles.statutory}>
                    REPORTABLE TO THE REGULATOR — the safety team is handling the filing
                  </Text>
                ) : null}

                <Text style={styles.status}>{STATUS_FOR_WORKER[status] ?? status}</Text>

                {overdue ? (
                  <Text style={styles.overdue}>
                    The investigation is past its deadline — chase your supervisor if nothing has moved.
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
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
  severityLabel: { fontSize: 11.5, color: '#475569', marginTop: 4, fontWeight: '600' },
  hipo: { fontSize: 10.5, fontWeight: '800', color: '#B91C1C', marginTop: 6, letterSpacing: 0.3 },
  statutory: {
    fontSize: 10.5, fontWeight: '800', color: '#9A3412', marginTop: 6,
    letterSpacing: 0.3, lineHeight: 15,
  },
  status: { fontSize: 12.5, color: '#334155', lineHeight: 18, marginTop: 4 },
  overdue: {
    fontSize: 11.5, color: '#B45309', marginTop: 8, backgroundColor: '#FFFBEB',
    borderRadius: 8, padding: 9, lineHeight: 16,
  },
});
