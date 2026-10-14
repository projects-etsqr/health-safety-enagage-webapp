import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaScreen } from '../components/layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import {
  capaWorkflowService,
  type CapaDetail,
  type CapaQueueItem,
} from '../services/capaWorkflowService';

/**
 * The supervisor's two steps in WF-04.
 *
 *   Halfway check (06) — "when half the time has elapsed the Supervisor must
 *   confirm progress is real". One of the four points the document says cannot
 *   be bypassed: the owner's evidence submission is refused until it exists.
 *
 *   Independent review (08) — someone other than the person who did the work
 *   confirms the control is physically in place. Confirming sends it on to the
 *   Safety Manager; rejecting sends it back to the owner to correct.
 *
 * Both live on one screen because they are the same act at two moments — going
 * to look — and a supervisor who has a queue of one and a queue of two should
 * not have to find two screens to clear three items.
 *
 * Neither step can be performed on your own action. The backend enforces that
 * and returns 403; the message it sends is shown as-is rather than hidden,
 * because "you own this one, someone else has to check it" is the answer.
 */

type Tab = 'interim' | 'review';

const TABS: Array<{ key: Tab; label: string; blurb: string }> = [
  { key: 'interim', label: 'Halfway checks', blurb: 'Confirm progress is real before evidence can be submitted' },
  { key: 'review', label: 'Evidence review', blurb: 'Confirm the control is physically in place' },
];

function priorityColour(band: string | null): { bg: string; fg: string } {
  switch ((band || '').toLowerCase()) {
    case 'critical': return { bg: '#FEF2F2', fg: '#BE123C' };
    case 'high': return { bg: '#FFF7ED', fg: '#C2410C' };
    default: return { bg: '#F1F5F9', fg: '#475569' };
  }
}

export function CapaReviewQueueScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('interim');
  const [items, setItems] = useState<Record<Tab, CapaQueueItem[]>>({ interim: [], review: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The open action, its full detail (evidence and the three checks are only on
  // the detail response), and what the reviewer is about to say about it.
  const [target, setTarget] = useState<CapaQueueItem | null>(null);
  const [detail, setDetail] = useState<CapaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [interim, review] = await Promise.all([
        capaWorkflowService.queue('interim'),
        capaWorkflowService.queue('review'),
      ]);
      setItems({ interim, review });
      setError(null);
    } catch (e) {
      console.log('Failed to load CAPA review queues:', e);
      setError('Could not load the queues. Pull down to try again.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = async (row: CapaQueueItem) => {
    setTarget(row);
    setNotes('');
    setSheetError(null);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await capaWorkflowService.detail(row.id));
    } catch (e) {
      console.log('Failed to load CAPA detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (positive: boolean) => {
    if (!target) return;
    setSubmitting(true);
    setSheetError(null);
    try {
      if (tab === 'interim') {
        await capaWorkflowService.interimCheck(target.id, positive, notes.trim() || undefined);
      } else {
        await capaWorkflowService.independentReview(target.id, positive, notes.trim() || undefined);
      }
      setTarget(null);
      await load();
    } catch (e: any) {
      const detailMsg = e?.response?.data?.detail;
      setSheetError(
        typeof detailMsg === 'string'
          ? detailMsg
          : detailMsg?.message || 'Could not record that. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const rows = items[tab];
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#0B1C30" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CAPA Reviews</Text>
          <Text style={styles.sub}>Your steps on other people's corrective actions</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label} ({items[t.key].length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.blurb}>{active.blurb}</Text>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color="#004AC6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {!error && rows.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={40} color="#16A34A" />
              <Text style={styles.emptyTitle}>
                {tab === 'interim' ? 'No halfway checks owed' : 'No evidence waiting for review'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'interim'
                  ? 'Every action in progress has had its halfway check.'
                  : 'Nothing has been submitted for confirmation since you last looked.'}
              </Text>
            </View>
          )}

          {rows.map((c) => {
            const p = priorityColour(c.priority_band);
            return (
              <TouchableOpacity key={c.id} style={styles.card} onPress={() => open(c)} activeOpacity={0.85}>
                <View style={styles.cardTop}>
                  <Text style={styles.ref}>{c.capa_ref || `CAPA-${c.id}`}</Text>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.fg }]}>{c.priority_band || 'Unscored'}</Text>
                  </View>
                </View>

                <Text style={styles.desc}>{c.description || 'Corrective action'}</Text>

                <Text style={styles.meta}>
                  {c.responsible_person_name || 'Unassigned'} · {c.capa_type || '—'} · due{' '}
                  {c.due_date ? new Date(c.due_date).toLocaleDateString() : 'not set'}
                </Text>
                {c.elapsed_percent !== null && (
                  <Text style={[styles.meta, c.is_overdue && styles.metaLate]}>
                    {c.is_overdue
                      ? 'Past its deadline'
                      : `${c.elapsed_percent}% of its window has gone`}
                  </Text>
                )}

                <View style={styles.cta}>
                  <Text style={styles.ctaText}>
                    {tab === 'interim' ? 'Run halfway check' : 'Review the evidence'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#004AC6" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.sheetTitle}>
                {tab === 'interim' ? 'Halfway check' : 'Independent review'} ·{' '}
                {target?.capa_ref || `CAPA-${target?.id}`}
              </Text>
              <Text style={styles.sheetDesc}>{target?.description || 'Corrective action'}</Text>

              {detailLoading && <ActivityIndicator color="#004AC6" style={{ marginTop: 14 }} />}

              {detail && (
                <>
                  {!!detail.success_criteria && (
                    <View style={styles.block}>
                      <Text style={styles.blockLabel}>Measured against</Text>
                      <Text style={styles.blockText}>{detail.success_criteria}</Text>
                    </View>
                  )}

                  {tab === 'review' && (
                    <>
                      <View style={styles.block}>
                        <Text style={styles.blockLabel}>
                          Evidence attached ({detail.evidence.length})
                        </Text>
                        {detail.evidence.length === 0 ? (
                          <Text style={styles.blockText}>Nothing attached.</Text>
                        ) : (
                          detail.evidence.map((e) => (
                            <Text key={e.id} style={styles.blockText}>
                              • {e.evidence_type.replace(/_/g, ' ')}
                              {e.description ? ` — ${e.description}` : ''}
                              {e.validation_result === 'rejected' ? ' (rejected)' : ''}
                            </Text>
                          ))
                        )}
                      </View>

                      <View style={styles.block}>
                        <Text style={styles.blockLabel}>Closure checks</Text>
                        {detail.closure_checks.map((chk) => (
                          <View key={chk.key} style={styles.checkRow}>
                            <Ionicons
                              name={chk.passed ? 'checkmark-circle' : 'close-circle'}
                              size={15}
                              color={chk.passed ? '#16A34A' : '#DC2626'}
                            />
                            <Text style={styles.checkText}>{chk.label} — {chk.detail}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}

              <Text style={styles.blockLabel}>Notes</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={
                  tab === 'interim'
                    ? 'What did you see on site?'
                    : 'What confirms the control is in place — or what is missing?'
                }
                placeholderTextColor="#9AA6BF"
              />

              {sheetError && <Text style={styles.sheetError}>{sheetError}</Text>}

              <TouchableOpacity
                style={[styles.primary, submitting && styles.disabled]}
                onPress={() => act(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>
                    {tab === 'interim' ? 'Progress is real' : 'Confirm the control is in place'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.danger, submitting && styles.disabled]}
                onPress={() => act(false)}
                disabled={submitting}
              >
                <Text style={styles.dangerText}>
                  {tab === 'interim' ? 'No real progress — tell the owner' : 'Reject — send it back to the owner'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancel} onPress={() => setTarget(null)} disabled={submitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: '#0B1C30' },
  sub: { fontSize: 11.5, color: '#63739B', marginTop: 2 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  tabActive: { backgroundColor: '#004AC6', borderColor: '#004AC6' },
  tabText: { fontSize: 12.5, fontWeight: '700', color: '#63739B' },
  tabTextActive: { color: '#FFFFFF' },
  blurb: { fontSize: 11.5, color: '#63739B', paddingHorizontal: 16, paddingTop: 8 },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  error: { fontSize: 13, color: '#BE123C', textAlign: 'center', paddingVertical: 12 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0B1C30' },
  emptyText: { fontSize: 12.5, color: '#63739B', textAlign: 'center', lineHeight: 18 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 12.5, fontWeight: '800', color: '#004AC6' },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  desc: { fontSize: 14, color: '#0B1C30', marginTop: 8, lineHeight: 20 },
  meta: { fontSize: 11.5, color: '#63739B', marginTop: 6 },
  metaLate: { color: '#C2410C', fontWeight: '700' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  ctaText: { fontSize: 12.5, fontWeight: '700', color: '#004AC6' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '85%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0B1C30' },
  sheetDesc: { fontSize: 13, color: '#2D3748', marginTop: 6, lineHeight: 19 },
  block: { marginTop: 14 },
  blockLabel: {
    fontSize: 11, fontWeight: '800', color: '#63739B',
    textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 6,
  },
  blockText: { fontSize: 12.5, color: '#2D3748', lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 5 },
  checkText: { flex: 1, fontSize: 12, color: '#2D3748', lineHeight: 17 },
  input: {
    borderWidth: 1, borderColor: '#D9E4F6', borderRadius: 10, padding: 12,
    fontSize: 13.5, color: '#0B1C30', minHeight: 78, textAlignVertical: 'top',
  },
  sheetError: { fontSize: 12.5, color: '#BE123C', marginTop: 10, lineHeight: 18 },
  primary: {
    backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', marginTop: 16,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  danger: {
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 10,
  },
  dangerText: { color: '#BE123C', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 13.5, fontWeight: '700', color: '#63739B' },
});
