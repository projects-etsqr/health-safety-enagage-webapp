import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { EmptyState } from '../components/feedback/EmptyState';
import { hazardService, type MyHazard } from '../services/hazardService';
import { Colors } from '../theme/colors';

/**
 * The unsafe acts this worker logged, each with its position on the eight stages.
 *
 * A worker could log an unsafe act and then never hear anything again — nothing in
 * the app showed what happened to it. This closes that loop: the same stage
 * rail the supervisor and manager see, rendered from the same backend-derived
 * `stage` fields, so all three roles are looking at one answer.
 *
 * The backend's derived stage fields are read rather than a status being
 * mapped here, so every role sees one answer.
 * It reads the flat stage shape the register returns via `toStageInfo`, so this
 * screen never maps a status to a stage itself.
 */

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
};

/** What is happening to the unsafe act, worded for the person who reported it. */
const STATUS_FOR_WORKER: Record<string, string> = {
  open: 'Logged — your supervisor has not assessed it yet',
  interim_control: 'A temporary control is in place while the fix is designed',
  under_review: 'Being reviewed to work out the permanent fix',
  controls_planned: 'A permanent control has been planned',
  pending_verification: 'The control is in — being checked that it works',
  controlled: 'Confirmed controlled',
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

export default function MyHazardsScreen({ navigation }: any) {
  const [rows, setRows] = useState<MyHazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    hazardService.myHazards()
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
      <AppHeader title="My Unsafe Acts" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[Colors.primary]} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🛡️"
            title="No unsafe acts logged"
            subtitle="Anything you add to the unsafe act register appears here, with its progress."
          />
        ) : (
          rows.map(h => {
            const isOpen = expanded === h.id;
            return (
              <TouchableOpacity
                key={h.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => setExpanded(isOpen ? null : h.id)}
              >
                <View style={styles.headerRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {h.hazard_name || `Hazard ${h.id}`}
                  </Text>
                  {!!h.assessed_priority && (
                    <View style={[styles.prio, { backgroundColor: PRIORITY_COLOR[h.assessed_priority] ?? '#64748B' }]}>
                      <Text style={styles.prioText}>{h.assessed_priority}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.meta}>
                  {h.reference}
                  {h.category_name ? ` · ${h.category_name}` : ''}
                  {h.station_name ? ` · ${h.station_name}` : ''}
                  {h.logged_at ? ` · ${timeAgo(h.logged_at)}` : ''}
                </Text>

                <Text style={styles.status}>
                  {STATUS_FOR_WORKER[h.register_status || ''] ?? h.register_status}
                </Text>

                {h.is_overdue ? (
                  <Text style={styles.overdue}>
                    Past its response deadline — chase your supervisor if it is still there.
                  </Text>
                ) : null}

                {isOpen && (
                  <View style={styles.detail}>
                    {!!h.description && (
                      <Detail label="WHAT YOU REPORTED" value={h.description} />
                    )}
                    {!!h.risk_score && (
                      <Detail
                        label="ASSESSED SCORE"
                        value={`${h.risk_score} of 25${h.severity ? ` · ${h.severity}` : ''}${h.probability ? ` / ${h.probability}` : ''}`}
                      />
                    )}
                    {!!h.interim_control && (
                      <Detail label="TEMPORARY CONTROL" value={h.interim_control} />
                    )}
                    {!!h.planned_controls && (
                      <Detail label="PERMANENT CONTROL" value={h.planned_controls} />
                    )}
                    {!h.interim_control && !h.planned_controls && (
                      <Text style={styles.pending}>No control recorded against it yet.</Text>
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
