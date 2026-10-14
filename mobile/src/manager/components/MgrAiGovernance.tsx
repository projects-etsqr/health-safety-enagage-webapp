/**
 * Safety Manager · AI Governance (HSE_AI_Overview_Client, next-phase items).
 *
 * "Model governance and version control — visibility of which AI model version
 *  is in use, and the ability to roll back."
 * "Your team teaches it — whenever someone accepts, amends or rejects an AI
 *  suggestion, the reason and the outcome are recorded."
 *
 * Also surfaces PIRS, which is explicitly the *advisory* counterpart to the
 * deterministic SPS — so this screen labels it as a forecast rather than a
 * measurement, exactly as the specification requires.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Card, ScoreTile, EmptyState, Loading, bandColor, HSE_COLORS } from '../../components/hseiq';
import { aiGovernanceService, Pirs } from '../../services/hseiqService';

export default function MgrAiGovernance({ setCurrentScreen }: any) {
  const [pirs, setPirs] = useState<Pirs | null>(null);
  const [learning, setLearning] = useState<any>(null);
  const [model, setModel] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      aiGovernanceService.pirs(90).catch(() => null),
      aiGovernanceService.learning(90).catch(() => null),
      aiGovernanceService.modelGovernance().catch(() => null),
      aiGovernanceService.log({ mine_only: false }).catch(() => []),
    ])
      .then(([p, l, m, g]) => { setPirs(p); setLearning(l); setModel(m); setLog(g as any[]); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const decide = useCallback(
    (id: number, decision: 'accept' | 'amend' | 'reject') => {
      if (decision === 'accept') {
        aiGovernanceService.decide(id, 'accept').then(load).catch(() => Alert.alert('Could not record'));
        return;
      }
      Alert.alert(
        'Reason required',
        `A ${decision} needs a reason — it is the only thing the learning loop can train on. Open the answer in the assistant to record it.`,
      );
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
          <Text style={styles.title}>AI Governance</Text>
        </View>

        {loading ? (
          <Loading />
        ) : (
          <>
            {pirs ? (
              <Card title="Predictive Injury Risk Score">
                <View style={{ flexDirection: 'row' }}>
                  <ScoreTile value={pirs.horizon_7d.toFixed(0)} band={pirs.band} label="7 days" />
                  <ScoreTile value={pirs.horizon_30d.toFixed(0)} band={pirs.band} label="30 days" />
                  <ScoreTile value={pirs.horizon_90d.toFixed(0)} band={pirs.band} label="90 days" />
                </View>
                <Text style={styles.driversTitle}>Top drivers</Text>
                {pirs.top_drivers.map((d, i) => (
                  <Text key={i} style={styles.driver}>• {d}</Text>
                ))}
                <View style={styles.advisory}>
                  <Text style={styles.advisoryText}>{pirs.advisory_note}</Text>
                </View>
                <Text style={styles.confidence}>Confidence {pirs.confidence}%</Text>
              </Card>
            ) : null}

            {learning ? (
              <Card title="Continuous learning">
                <Text style={styles.interp}>{learning.interpretation}</Text>
                <View style={styles.grid}>
                  <Stat label="Answers" value={learning.total_answers} />
                  <Stat label="Accepted" value={learning.accepted} />
                  <Stat label="Amended" value={learning.amended} />
                  <Stat label="Rejected" value={learning.rejected} />
                </View>
                {learning.mean_confidence_accepted != null && learning.mean_confidence_rejected != null ? (
                  <Text style={styles.meta}>
                    Mean confidence — accepted {learning.mean_confidence_accepted}, rejected{' '}
                    {learning.mean_confidence_rejected}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            {model ? (
              <Card title="Model governance">
                <Row label="Active provider" value={model.active_provider} />
                <Row label="Active model" value={model.active_model || '—'} />
                <Row label="Fallback" value={model.fallback_model || 'none configured'} />
                <Row label="Advisory only" value={model.advisory_only ? 'yes' : 'no'} />
                <Row
                  label="Can lift a safety gate"
                  value={model.can_override_safety_gate ? 'yes' : 'no — enforced in software'}
                />
                <Text style={styles.grounding}>{model.grounding}</Text>
                {(model.versions_seen ?? []).length > 0 ? (
                  <>
                    <Text style={styles.driversTitle}>Versions seen</Text>
                    {model.versions_seen.map((v: any, i: number) => (
                      <Text key={i} style={styles.meta}>
                        {v.provider}/{v.model_id} — {v.answers} answer{v.answers === 1 ? '' : 's'}
                      </Text>
                    ))}
                  </>
                ) : null}
              </Card>
            ) : null}

            <Card title={`Answer log (${log.length})`}>
              {log.length === 0 ? (
                <EmptyState text="No AI answers recorded yet." />
              ) : (
                log.slice(0, 15).map(l => (
                  <View key={l.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.question} numberOfLines={2}>
                        {l.question || 'Question not recorded'}
                      </Text>
                      <Text
                        style={[
                          styles.conf,
                          {
                            color:
                              (l.confidence_score ?? 0) >= 80 ? HSE_COLORS.pass
                                : (l.confidence_score ?? 0) >= 50 ? HSE_COLORS.amber
                                : HSE_COLORS.block,
                          },
                        ]}
                      >
                        {l.confidence_score ?? '—'}%
                      </Text>
                    </View>
                    {l.human_decision ? (
                      <Text style={styles.decided}>
                        {l.human_decision}
                        {l.decision_reason ? ` — ${l.decision_reason}` : ''}
                      </Text>
                    ) : (
                      <View style={styles.actions}>
                        <TouchableOpacity onPress={() => decide(l.id, 'accept')}>
                          <Text style={[styles.action, { color: HSE_COLORS.pass }]}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => decide(l.id, 'amend')}>
                          <Text style={styles.action}>Amend</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => decide(l.id, 'reject')}>
                          <Text style={[styles.action, { color: HSE_COLORS.block }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{String(value)}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  back: { fontSize: 14, color: '#2563EB', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark },

  driversTitle: { fontSize: 12, fontWeight: '700', color: HSE_COLORS.textDark, marginTop: 12, marginBottom: 6 },
  driver: { fontSize: 11, color: HSE_COLORS.textMuted, marginBottom: 4, lineHeight: 16 },
  advisory: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginTop: 10 },
  advisoryText: { fontSize: 11, color: '#1E40AF', lineHeight: 16 },
  confidence: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 8 },

  interp: { fontSize: 12, color: HSE_COLORS.textMid, lineHeight: 18 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 10 },
  statValue: { fontSize: 16, fontWeight: '800', color: HSE_COLORS.textDark },
  statLabel: { fontSize: 9, color: HSE_COLORS.textMuted, marginTop: 2 },
  meta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 6 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 10 },
  kvLabel: { fontSize: 12, color: HSE_COLORS.textMuted, flex: 1 },
  kvValue: { fontSize: 12, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1, textAlign: 'right' },
  grounding: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 10, lineHeight: 16, fontStyle: 'italic' },

  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  question: { fontSize: 12, color: HSE_COLORS.textDark, flex: 1, lineHeight: 17 },
  conf: { fontSize: 12, fontWeight: '800' },
  decided: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 6, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  action: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
});
