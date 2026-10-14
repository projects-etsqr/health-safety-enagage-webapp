import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  incidentWorkflowService,
  type IncidentNextAction,
  type NextActionItem,
} from '../services/incidentWorkflowService';
import { newestFirst } from '../utils/newestFirst';

/**
 * The incident entries behind the Tasks tab's Incidents card.
 *
 * Near misses, unsafe acts and risk observations share `ReportWorkflowList`
 * because the backend builds their routers from one factory. Incidents do not:
 * they carry treatment level, days away and the statutory fields, and their
 * investigation form lives on `CAPAManagement`. So this screen is the list and
 * nothing else — which step each incident is on and whose it is — and the
 * existing screen keeps the acting.
 *
 * The two tabs read the same `next-actions` resolver rather than a status
 * filter of their own, so the queue and the incident's own screen cannot
 * disagree about whose step it is.
 */

type Tab = 'mine' | 'all';

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#2563EB', P5: '#64748B',
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

export function IncidentQueueScreen({ navigation }: any) {
  const [items, setItems] = useState<NextActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('mine');

  const load = useCallback(async () => {
    try {
      // mineOnly=false: the "All open" tab needs the steps sitting with the
      // manager too. A supervisor chasing an incident has to see it is waiting
      // on somebody else rather than assume it was dropped.
      const res = await incidentWorkflowService.getNextActions(false);
      setItems(newestFirst(res.items ?? []));
      setError(null);
    } catch (e) {
      console.log('Failed to load the incident queue:', e);
      setError('Could not load incidents. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  // Your step *or* your record. An incident used to leave this tab the moment
  // the supervisor finished with it — the step passed to the manager, `is_mine`
  // went false, and their own work looked like it had disappeared. It stays,
  // and the card says who is holding it now.
  const mine = useMemo(() => items.filter((i) => i.is_mine || i.handled_by_me), [items]);
  const rows = tab === 'mine' ? mine : items;

  const [tracking, setTracking] = useState<NextActionItem | null>(null);
  const [track, setTrack] = useState<IncidentNextAction | null>(null);

  const openTrack = async (item: NextActionItem) => {
    setTracking(item);
    setTrack(null);
    try {
      setTrack(await incidentWorkflowService.getNextAction(item.id));
    } catch {
      setTrack(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#0B1C30" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Incidents</Text>
          <Text style={styles.sub}>What your team reported, and which step each is on</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {([['mine', `Waiting on you (${mine.length})`], ['all', `All open (${items.length})`]] as Array<[Tab, string]>)
          .map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
      </View>

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color="#004AC6" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {!error && rows.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={40} color="#16A34A" />
              <Text style={styles.emptyTitle}>
                {tab === 'mine' ? 'Nothing waiting on you' : 'No open incidents'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'mine'
                  ? 'Steps sitting with the manager or a CAPA owner are under "All open".'
                  : 'Everything your team has reported has been closed out.'}
              </Text>
            </View>
          )}

          {rows.map((i) => (
            <View key={i.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.ref}>{i.reference}</Text>
                <View style={styles.badges}>
                  {i.statutory_reportable && (
                    <View style={[styles.tag, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={[styles.tagText, { color: '#BE123C' }]}>STATUTORY</Text>
                    </View>
                  )}
                  {i.is_hipo && (
                    <View style={[styles.tag, { backgroundColor: '#FFF7ED' }]}>
                      <Text style={[styles.tagText, { color: '#C2410C' }]}>HIPO</Text>
                    </View>
                  )}
                  {!!i.priority && (
                    <View style={[styles.tag, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.tagText, { color: PRIORITY_COLOR[i.priority] ?? '#475569' }]}>
                        {i.priority}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.desc} numberOfLines={2}>{i.description}</Text>

              <Text style={styles.stage}>
                {i.stage_number ? `Stage ${String(i.stage_number).padStart(2, '0')} ${i.stage_label ?? ''} · ` : ''}
                {i.action}
              </Text>
              <Text style={[styles.meta, i.is_overdue && styles.metaLate]}>
                {i.is_mine
                  ? 'Your step'
                  : i.handled_by_me
                    ? `You are done — now with the ${i.owner_role.replace(/_/g, ' ')}`
                    : `With the ${i.owner_role.replace(/_/g, ' ')}`}
                {i.waiting_since ? ` · ${timeAgo(i.waiting_since)}` : ''}
                {i.is_overdue ? ' · overdue' : ''}
              </Text>

              <View style={styles.cta}>
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => navigation.navigate('CAPAManagement', { incidentId: i.id })}
                >
                  <Ionicons name="document-text-outline" size={15} color="#004AC6" />
                  <Text style={styles.ctaText}>{i.is_mine ? i.cta : 'Open'}</Text>
                </TouchableOpacity>

                <View style={styles.ctaDivider} />

                <TouchableOpacity style={styles.ctaBtn} onPress={() => openTrack(i)}>
                  <Ionicons name="git-commit-outline" size={15} color="#004AC6" />
                  <Text style={styles.ctaText}>Track</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={tracking !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTracking(null)}
      >
        <View style={styles.trackBackdrop}>
          <View style={styles.trackSheet}>
            <Text style={styles.trackTitle}>{tracking?.reference}</Text>
            <Text style={styles.trackDesc} numberOfLines={3}>{tracking?.description}</Text>

            {track ? (
              <>
                {/* The stage in words, not the eight-dot rail. The rail is
                    deliberately off every supervisor and manager screen — what
                    is useful here is which step is outstanding and who holds
                    it, which is what follows. */}
                {!!track.stage_label && (
                  <Text style={styles.trackStage}>
                    {track.stage_number ? `${String(track.stage_number).padStart(2, '0')} · ` : ''}
                    {track.stage_label}
                  </Text>
                )}
                <Text style={styles.trackStep}>
                  {track.next_action
                    ? track.next_action.action
                    : 'Nothing outstanding — this incident is complete.'}
                </Text>
                <Text style={styles.trackOwner}>
                  {track.is_closed
                    ? 'Closed.'
                    : track.is_mine
                      ? 'Your step.'
                      : `With the ${(track.next_action?.owner_role ?? 'next role').replace(/_/g, ' ')}.`}
                  {track.next_action?.unblocks
                    ? ` Clearing it opens ${track.next_action.unblocks}.`
                    : ''}
                </Text>
              </>
            ) : (
              <ActivityIndicator color="#004AC6" style={{ marginVertical: 24 }} />
            )}

            <TouchableOpacity style={styles.trackClose} onPress={() => setTracking(null)}>
              <Text style={styles.trackCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  error: { fontSize: 13, color: '#BE123C', textAlign: 'center', paddingVertical: 12 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0B1C30' },
  emptyText: { fontSize: 12.5, color: '#63739B', textAlign: 'center', lineHeight: 18 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 12.5, fontWeight: '800', color: '#004AC6' },
  badges: { flexDirection: 'row', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 9.5, fontWeight: '800' },
  desc: { fontSize: 14, color: '#0B1C30', marginTop: 8, lineHeight: 20 },
  stage: { fontSize: 12, color: '#2D3748', marginTop: 8, fontWeight: '600' },
  meta: { fontSize: 11.5, color: '#63739B', marginTop: 4 },
  metaLate: { color: '#C2410C', fontWeight: '700' },
  cta: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  ctaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 4,
  },
  ctaDivider: { width: 1, height: 18, backgroundColor: '#EEF2F7' },
  ctaText: { fontSize: 12.5, fontWeight: '700', color: '#004AC6' },

  trackBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  trackSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
  },
  trackTitle: { fontSize: 15, fontWeight: '800', color: '#004AC6' },
  trackDesc: { fontSize: 13, color: '#0B1C30', marginTop: 6, lineHeight: 19 },
  trackStage: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 14,
    textTransform: 'uppercase', color: '#63739B',
  },
  trackStep: { fontSize: 13, fontWeight: '700', color: '#0B1C30', marginTop: 14 },
  trackOwner: { fontSize: 12, color: '#63739B', marginTop: 4, lineHeight: 17 },
  trackClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  trackCloseText: { fontSize: 13.5, fontWeight: '700', color: '#63739B' },
});
