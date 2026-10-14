/**
 * Auditor · Competence Evidence Audit (WF-06).
 *
 * "Sample workers on site, verify certs against matrix, flag any expired
 *  safety-critical cert."
 *
 * The audit list deliberately returns only people with an expired or missing
 * requirement — sampling a compliant population proves nothing, and an auditor's
 * time is better spent on the exceptions.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Card, EmptyState, Loading, HSE_COLORS } from '../../components/hseiq';
import { competenceService, TeamMatrixRow, CompetenceCard } from '../../services/hseiqService';

export default function CompetenceEvidenceAuditScreen({ navigation }: any) {
  const [rows, setRows] = useState<TeamMatrixRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<CompetenceCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    competenceService
      .auditList(true)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const open = useCallback((r: TeamMatrixRow) => {
    if (expanded === r.employee_id) { setExpanded(null); setDetail(null); return; }
    setExpanded(r.employee_id);
    setDetail(null);
    competenceService.cardFor(r.employee_id).then(setDetail).catch(() => setDetail(null));
  }, [expanded]);

  const blocked = rows.filter(r => r.is_blocked).length;

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Competence Evidence Audit</Text>
        <Text style={styles.subtitle}>
          Workers with an expired or missing requirement, verified against the matrix.
        </Text>

        {blocked > 0 ? (
          <View style={styles.finding}>
            <Text style={styles.findingText}>
              {blocked} worker{blocked > 1 ? 's hold' : ' holds'} an expired or missing
              safety-critical certificate. Any permit naming them is hard-blocked by the gate
              engine — this is a finding, not a warning.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState text="No competence exceptions found. Every sampled worker is current." />
        ) : (
          <Card title={`Exceptions (${rows.length})`}>
            {rows.map(r => (
              <View key={r.employee_id}>
                <TouchableOpacity style={styles.row} onPress={() => open(r)} activeOpacity={0.7}>
                  <View style={styles.rowHead}>
                    <Text style={styles.name}>{r.employee_name ?? `Employee #${r.employee_id}`}</Text>
                    {r.is_blocked ? (
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.block }]}>
                        <Text style={styles.pillText}>HARD BLOCK</Text>
                      </View>
                    ) : (
                      <View style={[styles.pill, { backgroundColor: HSE_COLORS.amber }]}>
                        <Text style={styles.pillText}>GAP</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta}>
                    {r.expired_count} expired · {r.missing_count} missing · {r.expiring_count} expiring
                    · {r.valid_count} valid
                  </Text>
                </TouchableOpacity>

                {expanded === r.employee_id ? (
                  <View style={styles.detail}>
                    {!detail ? (
                      <Text style={styles.mutedSmall}>Loading evidence…</Text>
                    ) : (
                      detail.items
                        .filter(it => it.status !== 'valid')
                        .map((it, i) => (
                          <View key={i} style={styles.detailRow}>
                            <Text style={styles.detailName}>
                              {it.requirement_name}
                              {it.is_safety_critical ? '  ·  SAFETY CRITICAL' : ''}
                            </Text>
                            <Text style={styles.detailStatus}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4, lineHeight: 17 },

  finding: {
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 8,
    backgroundColor: HSE_COLORS.blockBg, borderLeftWidth: 4, borderLeftColor: HSE_COLORS.block,
  },
  findingText: { fontSize: 12, color: '#991B1B', fontWeight: '600', lineHeight: 18 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 5 },

  detail: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 8 },
  detailName: { fontSize: 12, color: HSE_COLORS.textMid, flex: 1 },
  detailStatus: { fontSize: 11, fontWeight: '700', color: HSE_COLORS.block, textTransform: 'capitalize' },
  mutedSmall: { fontSize: 12, color: HSE_COLORS.textMuted },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
