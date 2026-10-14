/**
 * The auditor's queue.
 *
 * Every card answers the same question the detail screen does — which of the ten
 * steps is this waiting on, and is it mine? — because that is what decides
 * whether the auditor taps it. Status alone could not: "in progress" covered
 * both "read the brief" and "hold the opening meeting", which are different jobs
 * on different days.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaScreen } from '../../components/layout/KeyboardAvoider';
import { Ionicons } from '@expo/vector-icons';
import { auditService, Audit } from '../services/auditService';
import {
  Banner, C, Empty, RatingChip, RiskBandChip, SectionLabel, StepTracker,
} from '../components';

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

type Filter = 'active' | 'verifying' | 'closed' | 'all';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'active', label: 'In flight' },
  { key: 'verifying', label: 'To verify' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

export function AssignedAuditsScreen({ navigation }: any) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAudits(await auditService.listAssigned());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not load your audits.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audits.filter((a) => {
      if (filter === 'active' && (a.closed_at || (a.current_step ?? 0) >= 10)) return false;
      if (filter === 'verifying' && !(a.report_issued_at && !a.closed_at)) return false;
      if (filter === 'closed' && !a.closed_at) return false;
      if (!q) return true;
      return [a.title, a.site_name, a.department, a.checklist_type, a.audit_ref]
        .some((f) => (f || '').toLowerCase().includes(q));
    });
  }, [audits, query, filter]);

  const counts = useMemo(() => ({
    active: audits.filter((a) => !a.closed_at && (a.current_step ?? 0) < 10).length,
    verifying: audits.filter((a) => a.report_issued_at && !a.closed_at).length,
    closed: audits.filter((a) => a.closed_at).length,
    all: audits.length,
  }), [audits]);

  return (
    <SafeAreaScreen style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned audits</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AuditCalendar')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="calendar-outline" size={21} color={C.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={C.light} />
        <TextInput
          style={styles.search}
          placeholder="Search by site, reference or type"
          placeholderTextColor={C.light}
          value={query}
          onChangeText={setQuery}
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={C.light} />
          </TouchableOpacity>
        )}
      </View>

      {/* The height constraint belongs on the ScrollView, the padding on its
          content container. With everything on contentContainerStyle and no
          `style`, a horizontal ScrollView in a column flex parent stretches to
          fill the space left over — the chips drew at the top of a band running
          most of the way down the screen, squeezing the list under it.
          AuditTrailScreen already does it this way. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>
              {f.label} ({counts[f.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && <Banner tone="danger" title="Could not load" text={error} />}

          {visible.length ? visible.map((a) => {
            const step = a.steps?.find((s) => s.state === 'active' || s.state === 'blocked');
            const stopped = a.status === 'immediate_action';
            const mine = step ? step.owner === 'auditor' || step.owner === 'system' : false;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.card, stopped && styles.cardStopped]}
                onPress={() => navigation.navigate('AuditDetail', { auditId: a.id, audit: a })}
                activeOpacity={0.9}
              >
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ref}>{a.audit_ref} · {a.trigger_label ?? 'Scheduled'}</Text>
                    <Text style={styles.title} numberOfLines={2}>{a.title}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <RiskBandChip value={a.risk_band} small />
                    {a.compliance_score != null && (
                      <Text style={styles.score}>{a.compliance_score}%</Text>
                    )}
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={11} color={C.light} />
                  <Text style={styles.meta}>{a.site_name ?? '—'}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Ionicons name="calendar-outline" size={11} color={C.light} />
                  <Text style={styles.meta}>{fmt(a.due_date)}</Text>
                </View>

                {!!a.overall_rating && (
                  <View style={{ marginTop: 9, flexDirection: 'row' }}>
                    <RatingChip value={a.overall_rating} />
                  </View>
                )}

                <View style={styles.stepLine}>
                  <StepTracker steps={a.steps ?? []} compact />
                </View>

                {stopped ? (
                  <View style={styles.stopRow}>
                    <Ionicons name="hand-left" size={13} color="#B91C1C" />
                    <Text style={styles.stopText}>Stopped — critical finding. Contain it, then resume.</Text>
                  </View>
                ) : step ? (
                  <View style={styles.stepRow}>
                    <View style={[styles.stepBadge, step.state === 'blocked' && styles.stepBadgeBlocked]}>
                      <Text style={[styles.stepBadgeText, step.state === 'blocked' && { color: '#B91C1C' }]}>
                        {String(step.number).padStart(2, '0')}
                      </Text>
                    </View>
                    <Text style={styles.stepText} numberOfLines={1}>
                      {step.label}
                    </Text>
                    {!mine && (
                      <Text style={styles.waiting}>waiting on {step.owner_label ?? step.owner}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.stepRow}>
                    <Ionicons name="lock-closed" size={12} color="#047857" />
                    <Text style={[styles.stepText, { color: '#047857' }]}>
                      Closed {fmt(a.closed_at)}
                    </Text>
                  </View>
                )}

                {a.open_finding_count > 0 && !!a.report_issued_at && (
                  <Text style={styles.openFindings}>
                    {a.open_finding_count} finding{a.open_finding_count === 1 ? '' : 's'} awaiting
                    verification — the audit stays open until each is checked on site.
                  </Text>
                )}
              </TouchableOpacity>
            );
          }) : (
            <Empty
              icon="clipboard-outline"
              text={query ? 'Nothing matches that search.' : 'No audits in this view.'}
            />
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: C.ink },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16,
    backgroundColor: '#FFFFFF', borderRadius: 11, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 42,
  },
  search: { flex: 1, fontSize: 13, color: C.ink, fontWeight: '600' },

  filterBar: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterBtn: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border,
  },
  filterBtnOn: { backgroundColor: C.brand, borderColor: C.brand },
  filterText: { fontSize: 11.5, fontWeight: '800', color: C.mid },
  filterTextOn: { color: '#FFFFFF' },

  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 10,
  },
  cardStopped: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ref: { fontSize: 9, fontWeight: '900', color: C.light, letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 3, lineHeight: 18.5 },
  score: { fontSize: 14, fontWeight: '900', color: C.brand },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  meta: { fontSize: 10.5, fontWeight: '600', color: C.muted },
  dot: { fontSize: 10.5, color: C.light, marginHorizontal: 2 },

  stepLine: { marginTop: 11 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  stepBadge: {
    width: 20, height: 20, borderRadius: 6, backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeBlocked: { backgroundColor: '#FEE2E2' },
  stepBadgeText: { fontSize: 9.5, fontWeight: '900', color: C.brand },
  stepText: { flex: 1, fontSize: 11.5, fontWeight: '800', color: C.ink },
  waiting: { fontSize: 9.5, fontWeight: '700', color: C.light },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  stopText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#B91C1C', lineHeight: 15 },

  openFindings: { fontSize: 10.5, fontWeight: '600', color: '#B45309', lineHeight: 15, marginTop: 9 },
});

export default AssignedAuditsScreen;
