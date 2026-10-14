/**
 * WF-07 · My Safety Score — the worker's personal Human Readiness contribution.
 *
 * Deliberately narrow. The spec gives the worker "competence gaps, fatigue
 * flags" and nothing else: a worker sees their own readiness, never a
 * colleague's score and never the site's. The backend enforces that too — this
 * screen has no way to ask for anyone else.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Card, ScoreTile, EmptyState, Loading, bandColor, HSE_COLORS } from '../../components/hseiq';
import { spsService, MySafetyScore } from '../../services/hseiqService';

export default function MySafetyScoreScreen({ navigation }: any) {
  const [score, setScore] = useState<MySafetyScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    spsService
      .mine()
      .then(setScore)
      .catch(() => setScore(null))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  return (
    <ScreenLayout>
      <AppHeader title="My Safety Score" onBack={() => navigation.goBack()} light />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {loading ? (
          <Loading text="Loading your readiness…" />
        ) : !score ? (
          <EmptyState text="Your safety score could not be loaded." />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <ScoreTile
                  value={score.human_readiness.toFixed(0)}
                  band={score.band}
                  label="Human Readiness"
                  sub="lower is better"
                />
                <View style={styles.side}>
                  <Stat label="Open training gaps" value={score.open_competence_gaps} />
                  <Stat
                    label="Safety-critical gaps"
                    value={score.safety_critical_gaps}
                    danger={score.safety_critical_gaps > 0}
                  />
                  <Stat
                    label="Latest fatigue index"
                    value={score.latest_fatigue_index ?? '—'}
                    danger={score.latest_fatigue_band === 'block'}
                  />
                </View>
              </View>
            </Card>

            <View style={[styles.guidance, { borderLeftColor: bandColor(score.band) }]}>
              <Text style={styles.guidanceText}>{score.guidance}</Text>
            </View>

            {score.blocked_tasks.length > 0 ? (
              <Card title="What this blocks">
                {score.blocked_tasks.map(t => (
                  <Text key={t} style={styles.blockedItem}>• {t}</Text>
                ))}
                <Text style={styles.note}>
                  A permit naming you cannot be issued for these until the certificate is renewed.
                </Text>
              </Card>
            ) : null}

            <Card title="How this is calculated">
              <Text style={styles.explain}>
                Human Readiness is one of the five domains in the site's Safety Performance
                Score. Yours is built only from your own competence gaps and your latest
                fatigue declaration — no medical or biometric information is used, and no
                one else's score is visible to you.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

function Stat({ label, value, danger }: { label: string; value: any; danger?: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, danger && { color: HSE_COLORS.block }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { flex: 1.3, justifyContent: 'center', paddingLeft: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { fontSize: 12, color: HSE_COLORS.textMuted, flex: 1 },
  statValue: { fontSize: 13, fontWeight: '700', color: HSE_COLORS.textDark },

  guidance: {
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: '#fff', borderRadius: 8, borderLeftWidth: 4,
    borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  guidanceText: { fontSize: 13, color: HSE_COLORS.textMid, lineHeight: 19 },

  blockedItem: { fontSize: 13, color: '#991B1B', marginTop: 4 },
  note: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 10, fontStyle: 'italic' },
  explain: { fontSize: 12, color: HSE_COLORS.textMuted, lineHeight: 18 },
});
