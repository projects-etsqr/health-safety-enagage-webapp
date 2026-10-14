/**
 * Step 07 CLASSIFY · findings & score.
 *
 * "Scores each item and assigns the classification. The system calculates the
 * score but the auditor owns the judgement on what each finding is."
 *
 * That division is the whole screen. The arithmetic — points, section
 * percentages, the band, the overall rating — is shown but never editable. The
 * classifications are editable right up until submission, and after that the
 * closing meeting locks them.
 *
 * Two rules are not the auditor's to override, and the screen says so rather
 * than silently correcting: a critical item scoring zero is a Major NC at
 * minimum, and a section below 60% raises its own Minor NC attributed to nobody.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  auditService, Audit, ChecklistItem, Classification, CLASSIFICATION_META,
  RESPONSE_META, ScoreBreakdown, defaultClassification,
} from '../services/auditService';
import {
  Banner, C, Card, ClassificationChip, Empty, PrimaryButton, RatingChip,
  ScoreRing, ScreenHeader, SectionLabel,
} from '../components';

const CLASSES: Classification[] = ['conformance', 'observation', 'minor_nc', 'major_nc', 'critical'];

type Row = ChecklistItem & { isRepeat?: boolean };

export function ReviewFindingsScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const pendingItems: Array<Partial<Row>> | undefined = route.params?.pendingItems;

  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [items, setItems] = useState<Row[]>([]);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await auditService.get(auditId);
      setAudit(a);

      // Answers made on the walk win over the server's copy: an audit walked
      // offline has answers here that never reached the server, and showing the
      // server's blanks would look like the walk was lost.
      const overlay = new Map((pendingItems ?? []).map((p) => [p.id, p]));
      setItems(
        a.findings.map((i) => ({ ...i, ...(overlay.get(i.id) ?? {}) })) as Row[],
      );

      try { setScore(await auditService.score(auditId)); }
      catch { setScore(null); }
    } catch (e: any) {
      Alert.alert('Could not load the review', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auditId, pendingItems]);

  useEffect(() => { load(); }, [load]);

  const locked = !!audit?.findings_locked;

  const setClass = (item: Row, c: Classification) => {
    if (locked) return;
    if (item.is_critical && item.response === 'none' &&
        CLASSIFICATION_META[c].severity < CLASSIFICATION_META.major_nc.severity) {
      Alert.alert(
        'This is a critical item',
        'A critical item scoring zero is a Major non-conformance at minimum. You can escalate it to Critical, but not below it.',
      );
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, classification: c } : i)));
  };

  // Local preview of the rubric so the numbers move as classifications change,
  // rather than only after a round trip. The server recomputes on submit and its
  // answer is the one that is stored.
  const preview = useMemo(() => {
    let earned = 0, possible = 0, na = 0, unanswered = 0;
    const counts: Record<Classification, number> = {
      conformance: 0, observation: 0, minor_nc: 0, major_nc: 0, critical: 0,
    };
    const sections = new Map<string, { e: number; p: number }>();
    for (const i of items) {
      if (!i.response) { unanswered++; continue; }
      if (i.response === 'na') { na++; continue; }
      const pts = i.response === 'full' ? 2 : i.response === 'partial' ? 1 : 0;
      earned += pts; possible += 2;
      const key = i.section || 'General';
      const b = sections.get(key) ?? { e: 0, p: 0 };
      b.e += pts; b.p += 2; sections.set(key, b);
      const c = i.classification ?? defaultClassification(i.response, i.is_critical);
      if (c) counts[c] += 1;
    }
    const pct = possible ? Math.round((earned / possible) * 1000) / 10 : 0;
    const below = [...sections.entries()]
      .map(([name, b]) => ({ name, pct: b.p ? Math.round((b.e / b.p) * 1000) / 10 : 0 }))
      .filter((s) => s.pct < 60);
    const rating =
      counts.critical || counts.major_nc ? 'unsatisfactory'
        : counts.minor_nc > 3 ? 'requires_improvement' : 'satisfactory';
    return { pct, earned, possible, na, unanswered, counts, below, rating: rating as any };
  }, [items]);

  const submit = async () => {
    if (preview.unanswered > 0) {
      Alert.alert(
        'Not every item is answered',
        `${preview.unanswered} item(s) still need a score or Not Applicable.`,
      );
      return;
    }
    Alert.alert(
      'Lock in the classifications?',
      `${preview.pct}% — ${preview.rating.replace(/_/g, ' ')}. Corrective actions and deadlines are generated from these classifications. You can still change them until the closing meeting.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Classify',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await auditService.classify(auditId, {
                items: items.map((i) => ({
                  id: i.id,
                  response: i.response,
                  remarks: i.remarks,
                  classification: i.classification,
                  gps_latitude: i.gps_latitude,
                  gps_longitude: i.gps_longitude,
                })),
                shift: audit?.shift ?? undefined,
              });
              if (res.queued) {
                Alert.alert(
                  'Saved offline',
                  'The classifications and score will sync when you have signal. Hold the closing meeting when you are back online.',
                );
                navigation.navigate('AuditDetail', { auditId });
                return;
              }
              navigation.replace('ClosingMeeting', { auditId, audit: res.data ?? audit });
            } catch (e: any) {
              Alert.alert('Could not classify', e?.response?.data?.detail ?? 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Findings & score" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const scoring = items.filter((i) => i.response && i.response !== 'na');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Findings & score"
        subtitle={`Step 07 · ${audit?.audit_ref ?? ''}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {locked && (
          <Banner
            tone="warn" icon="lock-closed"
            title="Findings are locked"
            text="The closing meeting is done. These can only change through a formal amendment."
          />
        )}

        {/* The arithmetic — shown, never editable */}
        <View style={styles.scoreCard}>
          <ScoreRing score={preview.pct} band={
            preview.pct >= 90 ? 'excellent' : preview.pct >= 75 ? 'good' : preview.pct >= 60 ? 'acceptable' : 'poor'
          } size={104} />
          <View style={{ flex: 1, gap: 9 }}>
            <RatingChip value={preview.rating} />
            <Text style={styles.formula}>
              ({preview.earned} earned ÷ {preview.possible} possible) × 100
            </Text>
            <Text style={styles.formulaNote}>
              {preview.na} item{preview.na === 1 ? '' : 's'} marked Not Applicable and excluded, so the
              score is not diluted by questions that did not apply.
            </Text>
          </View>
        </View>

        {/* Counts */}
        <View style={styles.countRow}>
          {CLASSES.map((c) => {
            const n = preview.counts[c];
            const m = CLASSIFICATION_META[c];
            return (
              <View key={c} style={[styles.countChip, { backgroundColor: n ? m.bg : '#F8FAFC' }]}>
                <Text style={[styles.countNum, { color: n ? m.color : C.light }]}>{n}</Text>
                <Text style={[styles.countLabel, { color: n ? m.color : C.light }]}>{m.short}</Text>
              </View>
            );
          })}
        </View>

        {preview.rating === 'unsatisfactory' && (
          <Banner
            tone="danger" icon="alert-circle"
            title="Unsatisfactory"
            text="Any Major non-conformance or regulatory breach makes the audit unsatisfactory, whatever the percentage says."
          />
        )}
        {preview.rating === 'requires_improvement' && (
          <Banner
            tone="warn" icon="warning"
            title="Requires improvement"
            text="More than three Minor non-conformances."
          />
        )}

        {/* Sections the system will raise a finding against on its own */}
        {preview.below.length > 0 && (
          <Banner
            tone="warn" icon="git-branch"
            title={`${preview.below.length} section${preview.below.length > 1 ? 's' : ''} below 60%`}
            text={`${preview.below.map((s) => `${s.name} (${s.pct}%)`).join(', ')}. Each raises a Minor NC of its own — a section falling below the threshold is a lapse in the system, not in one item. You cannot suppress these.`}
          />
        )}

        {/* Section breakdown */}
        {!!score?.sections?.length && (
          <>
            <SectionLabel>Section scores</SectionLabel>
            <Card>
              {score.sections.map((s) => (
                <View key={s.section} style={styles.sectionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionName}>{s.section}</Text>
                    <View style={styles.sectionBar}>
                      <View style={[
                        styles.sectionFill,
                        { width: `${Math.max(2, s.score)}%`, backgroundColor: s.below_threshold ? '#DC2626' : '#059669' },
                      ]} />
                    </View>
                  </View>
                  <Text style={[styles.sectionPct, s.below_threshold && { color: '#DC2626' }]}>
                    {s.score}%
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* The judgement — this is the auditor's */}
        <SectionLabel>Your judgement on each finding</SectionLabel>
        <Text style={styles.judgeNote}>
          The system scored the items. What each finding is called is yours. Tap a row to change it.
        </Text>

        {scoring.length ? scoring.map((item) => {
          const open = expanded === item.id;
          const m = RESPONSE_META[item.response as keyof typeof RESPONSE_META];
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              onPress={() => setExpanded(open ? null : item.id)}
              activeOpacity={0.9}
            >
              <View style={styles.itemHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemSection}>{item.section || 'General'}</Text>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <View style={[styles.respChip, { backgroundColor: m.bg }]}>
                    <Text style={[styles.respChipText, { color: m.color }]}>{m.label} · {m.points}</Text>
                  </View>
                  <ClassificationChip value={item.classification} small repeat={item.isRepeat} />
                </View>
              </View>

              {!!item.remarks && (
                <Text style={styles.itemRemarks} numberOfLines={open ? undefined : 2}>{item.remarks}</Text>
              )}

              <View style={styles.itemMeta}>
                {item.is_critical && (
                  <View style={styles.criticalTag}>
                    <Ionicons name="alert" size={9} color="#FFFFFF" />
                    <Text style={styles.criticalTagText}>CRITICAL ITEM</Text>
                  </View>
                )}
                <View style={styles.evTag}>
                  <Ionicons
                    name={item.evidence_count ? 'images' : 'alert-circle-outline'}
                    size={11}
                    color={item.evidence_count ? '#047857' : '#B45309'}
                  />
                  <Text style={[styles.evTagText, !item.evidence_count && { color: '#B45309' }]}>
                    {item.evidence_count || 0} evidence
                  </Text>
                </View>
                {!!item.clause && (
                  <View style={styles.clauseTag}><Text style={styles.clauseTagText}>{item.clause}</Text></View>
                )}
              </View>

              {open && !locked && (
                <View style={styles.classRow}>
                  {CLASSES.map((c) => {
                    const cm = CLASSIFICATION_META[c];
                    const on = item.classification === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[styles.classBtn, on && { backgroundColor: cm.bg, borderColor: cm.color }]}
                        onPress={() => setClass(item, c)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.classBtnText, on && { color: cm.color }]}>{cm.short}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {open && !!item.classification && (
                <Text style={styles.meaning}>{CLASSIFICATION_META[item.classification].meaning ?? ''}</Text>
              )}
            </TouchableOpacity>
          );
        }) : (
          <Empty icon="clipboard-outline" text="Nothing scored yet. Walk the checklist first." />
        )}

        <View style={{ height: 10 }} />
        {locked ? (
          <PrimaryButton
            label="View the report"
            icon="document-text"
            onPress={() => navigation.navigate('AuditReport', { auditId, audit })}
          />
        ) : (
          <PrimaryButton
            label="Classify & go to closing meeting"
            icon="arrow-forward"
            onPress={submit}
            loading={busy}
          />
        )}
        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF',
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 15, marginBottom: 12,
  },
  formula: { fontSize: 12, fontWeight: '800', color: C.ink },
  formulaNote: { fontSize: 10.5, fontWeight: '600', color: C.muted, lineHeight: 15 },

  countRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  countChip: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 8 },
  countNum: { fontSize: 15, fontWeight: '900' },
  countLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.3, marginTop: 1 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sectionName: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 5 },
  sectionBar: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  sectionFill: { height: '100%', borderRadius: 3 },
  sectionPct: { fontSize: 13, fontWeight: '900', color: '#047857', width: 48, textAlign: 'right' },

  judgeNote: { fontSize: 11.5, fontWeight: '600', color: C.muted, lineHeight: 16, marginBottom: 11 },

  itemCard: {
    backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 9,
  },
  itemHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemSection: { fontSize: 8.5, fontWeight: '900', color: C.light, letterSpacing: 0.7, textTransform: 'uppercase' },
  itemTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink, marginTop: 3, lineHeight: 18 },
  respChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  respChipText: { fontSize: 9, fontWeight: '900' },
  itemRemarks: { fontSize: 11.5, color: C.mid, fontWeight: '600', lineHeight: 16.5, marginTop: 8 },
  itemMeta: { flexDirection: 'row', gap: 6, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' },
  criticalTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DC2626',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3,
  },
  criticalTagText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  evTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  evTagText: { fontSize: 9.5, fontWeight: '800', color: '#047857' },
  clauseTag: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  clauseTagText: { fontSize: 8.5, fontWeight: '800', color: C.mid },

  classRow: { flexDirection: 'row', gap: 5, marginTop: 12 },
  classBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  classBtnText: { fontSize: 9, fontWeight: '900', color: C.mid },
  meaning: { fontSize: 10.5, color: C.muted, fontWeight: '600', lineHeight: 15, marginTop: 9 },
});

export default ReviewFindingsScreen;
