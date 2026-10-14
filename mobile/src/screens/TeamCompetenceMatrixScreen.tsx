/**
 * Supervisor · Team Competence Matrix (WF-06).
 *
 * "Nightly gap report. Assign buddy for new workers on WAH / CS / hot work."
 *
 * Sorted worst-first on purpose: a supervisor opening this at shift start needs
 * the blocked people at the top, not an alphabetical list they have to scan.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Card, EmptyState, Loading, HSE_COLORS } from '../components/hseiq';
import { competenceService, TeamMatrixRow, CompetenceCard } from '../services/hseiqService';

export default function TeamCompetenceMatrixScreen({ navigation }: any) {
  const [rows, setRows] = useState<TeamMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<CompetenceCard | null>(null);

  const load = useCallback(() => {
    competenceService
      .teamMatrix()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(b.is_blocked) - Number(a.is_blocked) ||
          b.expired_count - a.expired_count ||
          b.missing_count - a.missing_count,
      ),
    [rows],
  );

  const blockedCount = rows.filter(r => r.is_blocked).length;
  const buddyCount = rows.filter(r => r.buddy_required).length;

  const open = useCallback((r: TeamMatrixRow) => {
    if (expanded === r.employee_id) { setExpanded(null); setDetail(null); return; }
    setExpanded(r.employee_id);
    setDetail(null);
    competenceService.cardFor(r.employee_id).then(setDetail).catch(() => setDetail(null));
  }, [expanded]);

  const recompute = useCallback(() => {
    competenceService
      .recomputeGaps()
      .then(res =>
        Alert.alert('Gap report rebuilt', `${res.gaps_created} gaps across ${res.employees_checked} people.`),
      )
      .then(load)
      .catch(() => Alert.alert('Could not rebuild the gap report'));
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Team Competence Matrix</Text>
        <Text style={styles.subtitle}>
          {blockedCount} blocked from high-risk work · {buddyCount} new worker
          {buddyCount === 1 ? '' : 's'} needing a buddy
        </Text>

        <TouchableOpacity onPress={recompute} style={styles.rebuild}>
          <Text style={styles.rebuildText}>Rebuild gap report now</Text>
        </TouchableOpacity>

        {loading ? (
          <Loading />
        ) : sorted.length === 0 ? (
          <EmptyState text="No team members found for this organisation." />
        ) : (
          <Card title={`Team (${sorted.length})`}>
            {sorted.map(r => (
              <View key={r.employee_id}>
                <TouchableOpacity style={styles.row} onPress={() => open(r)} activeOpacity={0.7}>
                  <View style={styles.rowHead}>
                    <Text style={styles.name}>{r.employee_name ?? `Employee #${r.employee_id}`}</Text>
                    {r.is_blocked ? (
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                        <Text style={styles.pillText}>BLOCKED</Text>
                      </View>
                    ) : (
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.pass }]}>
                        <Text style={styles.pillText}>CLEAR</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.counts}>
                    <Count label="valid" n={r.valid_count} color={HSE_COLORS.pass} />
                    <Count label="expiring" n={r.expiring_count} color={HSE_COLORS.amber} />
                    <Count label="expired" n={r.expired_count} color={HSE_COLORS.block} />
                    <Count label="missing" n={r.missing_count} color={HSE_COLORS.textMuted} />
                  </View>
                  {r.buddy_required ? (
                    <Text style={styles.buddy}>
                      New worker — buddy required for work at height, confined space and hot work.
                    </Text>
                  ) : null}
                </TouchableOpacity>

                {expanded === r.employee_id ? (
                  <View style={styles.detail}>
                    {!detail ? (
                      <Text style={styles.muted}>Loading requirements…</Text>
                    ) : (
                      detail.items.map((it, i) => (
                        <View key={i} style={styles.detailRow}>
                          <Text style={styles.detailName}>
                            {it.requirement_name}
                            {it.is_safety_critical ? ' ·  SAFETY CRITICAL' : ''}
                          </Text>
                          <Text
                            style={[
                              styles.detailStatus,
                              {
                                color:
                                  it.status === 'valid' ? HSE_COLORS.pass
                                    : it.status === 'expiring' ? HSE_COLORS.amber
                                    : HSE_COLORS.block,
                              },
                            ]}
                          >
                            {it.status}
                            {it.expires_at ? ` · ${it.expires_at}` : ''}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Count({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <View style={styles.count}>
      <Text style={[styles.countNum, { color }]}>{n}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  rebuild: {
    marginHorizontal: 16, marginTop: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#2563EB', alignItems: 'center',
  },
  rebuildText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },

  counts: { flexDirection: 'row', marginTop: 10, gap: 18 },
  count: { alignItems: 'center' },
  countNum: { fontSize: 16, fontWeight: '800' },
  countLabel: { fontSize: 10, color: HSE_COLORS.textMuted },

  buddy: { fontSize: 11, color: '#1E40AF', marginTop: 8, fontStyle: 'italic' },

  detail: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  detailName: { fontSize: 12, color: HSE_COLORS.textMid, flex: 1 },
  detailStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  muted: { fontSize: 12, color: HSE_COLORS.textMuted },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
