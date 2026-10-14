/**
 * Step 03 PREPARE · the brief pack, read before going out.
 *
 * "The auto-generated brief pack — previous findings, open actions, current
 * score, overdue permits — is readable offline before they walk out."
 *
 * The auditor does not build this and cannot edit it. The only action on this
 * screen is confirming they read it, which is what unlocks the opening meeting:
 * an auditor who has not seen last time's findings cannot set a credible scope.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, CLASSIFICATION_META, Classification,
} from '../services/auditService';
import {
  Banner, C, Card, ClassificationChip, Empty, KV, PrimaryButton, RiskBandChip,
  ScreenHeader, SectionLabel,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export function BriefPackScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [pack, setPack] = useState<Record<string, any> | null>(null);
  const [meta, setMeta] = useState<{ generated_at?: string; reviewed_at?: string; due_date?: string }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, bp] = await Promise.all([
        auditService.get(auditId),
        auditService.briefPack(auditId),
      ]);
      setAudit(a);
      setPack(bp.pack || {});
      setMeta({ generated_at: bp.generated_at, reviewed_at: bp.reviewed_at, due_date: bp.due_date });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not load the brief pack.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auditId]);

  useEffect(() => { load(); }, [load]);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await auditService.markBriefReviewed(auditId);
      if (res.queued) {
        Alert.alert('Saved offline', 'Your confirmation will sync when you have signal.');
      }
      navigation.replace('OpeningMeeting', { auditId, audit: res.data ?? audit });
    } catch (e: any) {
      Alert.alert('Could not confirm', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const prev: any[] = pack?.previous_findings ?? [];
  const actions: any[] = pack?.open_actions ?? [];
  const permits: any[] = pack?.overdue_permits ?? [];
  const areas: any[] = pack?.highest_risk_areas ?? [];
  const guidance: any[] = pack?.regulatory_guidance ?? [];
  const watch: any[] = pack?.repeat_watchlist ?? [];
  const reviewed = !!meta.reviewed_at || !!audit?.brief_pack_reviewed_at;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Brief pack"
        subtitle={`Step 03 · ${audit?.audit_ref ?? ''}`}
        onBack={() => navigation.goBack()}
        right={<RiskBandChip value={audit?.risk_band} small />}
      />

      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          {!!error && <Banner tone="danger" title="Brief pack unavailable" text={error} />}

          <Banner
            tone="info"
            icon="document-text"
            title="Built by the system, not by you"
            text={`Generated ${fmt(meta.generated_at)}. It is a snapshot — it records what you were briefed on, so it does not change under you while you are on site.`}
          />

          {/* Why this audit is happening at all */}
          <Card title="This audit">
            <KV k="Trigger" v={pack?.trigger?.label ?? audit?.trigger_label ?? '—'} />
            <KV k="Site risk band" v={<RiskBandChip value={pack?.risk_band ?? audit?.risk_band} small />} />
            <KV k="Type" v={audit?.checklist_type ?? '—'} />
            <KV k="Scheduled" v={fmt(audit?.scheduled_date)} />
            {!!pack?.trigger?.detail && <Text style={styles.note}>{pack.trigger.detail}</Text>}
          </Card>

          {/* Where the site stands right now */}
          <Card title="Current score">
            {pack?.current_score?.last_audit_score != null ? (
              <>
                <KV k="Last audit" v={pack.current_score.last_audit_ref ?? '—'} />
                <KV k="Score" v={`${pack.current_score.last_audit_score}%`} />
                <KV k="Rating" v={(pack.current_score.last_audit_rating ?? '—').replace(/_/g, ' ')} />
                <KV k="Date" v={fmt(pack.current_score.last_audit_date)} />
              </>
            ) : (
              <Text style={styles.note}>No previous audit at this site — this is the baseline.</Text>
            )}
          </Card>

          {/* Lead with the failures */}
          <SectionLabel>Areas flagged as highest risk</SectionLabel>
          <Card>
            {areas.length ? (
              areas.map((a, i) => (
                <View key={i} style={styles.riskRow}>
                  <View style={styles.riskRank}><Text style={styles.riskRankText}>{i + 1}</Text></View>
                  <Text style={styles.riskName}>{a.section}</Text>
                  <Text style={styles.riskWeight}>weight {a.risk_weight}</Text>
                </View>
              ))
            ) : (
              <Empty icon="shield-checkmark-outline" text="Nothing flagged from previous audits. Your checklist runs in its standard order." />
            )}
            {areas.length > 0 && (
              <Text style={styles.note}>
                Your checklist has been ordered to put these first.
              </Text>
            )}
          </Card>

          {/* Previous findings — and which came back */}
          <SectionLabel>Previous findings ({prev.length})</SectionLabel>
          {watch.length > 0 && (
            <Banner
              tone="warn"
              icon="repeat"
              title={`${watch.length} closed finding${watch.length > 1 ? 's' : ''} to check again`}
              text="These were signed off last time. If you find them again, the system flags them as a repeat and treats them as more serious than a first occurrence."
            />
          )}
          <Card>
            {prev.length ? prev.map((f, i) => (
              <View key={i} style={[styles.findRow, i === prev.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle}>{f.title}</Text>
                  <Text style={styles.findMeta}>
                    {f.audit_ref ?? '—'} · {fmt(f.audit_date)} · {f.was_closed ? 'closed' : f.status}
                  </Text>
                </View>
                <ClassificationChip value={f.classification as Classification} small />
              </View>
            )) : <Empty icon="albums-outline" text="No findings from previous audits at this site." />}
          </Card>

          {/* What is still owed */}
          <SectionLabel>Open corrective actions ({actions.length})</SectionLabel>
          <Card tone={actions.some((a) => a.overdue) ? 'warn' : 'default'}>
            {actions.length ? actions.map((a, i) => (
              <View key={i} style={[styles.findRow, i === actions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle} numberOfLines={2}>{a.description}</Text>
                  <Text style={[styles.findMeta, a.overdue && styles.overdue]}>
                    {a.capa_ref ?? '—'} · due {fmt(a.due_date)}{a.overdue ? ' · OVERDUE' : ''}
                  </Text>
                </View>
              </View>
            )) : <Empty icon="checkmark-done-outline" text="No corrective actions outstanding at this site." />}
          </Card>

          {/* Overdue permits */}
          <SectionLabel>Overdue permits ({permits.length})</SectionLabel>
          <Card tone={permits.length ? 'warn' : 'default'}>
            {permits.length ? permits.slice(0, 8).map((p, i) => (
              <View key={i} style={[styles.findRow, i === Math.min(permits.length, 8) - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle} numberOfLines={2}>{p.work_description || 'Permit'}</Text>
                  <Text style={[styles.findMeta, styles.overdue]}>
                    {p.permit_ref} · expired {p.days_expired}d ago · {p.workflow_status}
                  </Text>
                </View>
              </View>
            )) : <Empty icon="document-outline" text="No permits past their validity at this site." />}
            {permits.length > 8 && (
              <Text style={styles.note}>+ {permits.length - 8} more. Verify these on site under WF-02.</Text>
            )}
          </Card>

          {/* The clauses the report will map to */}
          <SectionLabel>Regulatory guidance</SectionLabel>
          <Card>
            {guidance.map((g, i) => (
              <View key={i} style={[styles.findRow, i === guidance.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.clauseTag}>
                  <Text style={styles.clauseTagText}>{g.clause}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findTitle}>{g.topic}</Text>
                  <Text style={styles.findMeta}>{g.standard}</Text>
                </View>
              </View>
            ))}
          </Card>

          <View style={{ height: 8 }} />
          {reviewed ? (
            <>
              <Banner tone="ok" title="Brief pack reviewed" text={`Confirmed ${fmt(meta.reviewed_at ?? audit?.brief_pack_reviewed_at)}.`} />
              <PrimaryButton
                label="Go to opening meeting"
                icon="people"
                onPress={() => navigation.navigate('OpeningMeeting', { auditId, audit })}
              />
            </>
          ) : (
            <PrimaryButton
              label="I have read the brief"
              icon="checkmark-circle"
              onPress={confirm}
              loading={busy}
            />
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },
  note: { fontSize: 11.5, color: C.muted, lineHeight: 16, fontWeight: '600', marginTop: 8 },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  riskRank: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  riskRankText: { fontSize: 11, fontWeight: '900', color: '#C2410C' },
  riskName: { flex: 1, fontSize: 13, fontWeight: '700', color: C.ink },
  riskWeight: { fontSize: 10, fontWeight: '700', color: C.light },
  findRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  findTitle: { fontSize: 12.5, fontWeight: '700', color: C.ink, lineHeight: 17 },
  findMeta: { fontSize: 10.5, fontWeight: '600', color: C.light, marginTop: 2 },
  overdue: { color: '#B91C1C' },
  clauseTag: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  clauseTagText: { fontSize: 9.5, fontWeight: '800', color: C.mid },
});

export default BriefPackScreen;
