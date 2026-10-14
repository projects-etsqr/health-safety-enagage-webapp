import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Icon } from '../components/display/Icon';
import { Card } from '../components/cards/Card';
import { StatusBadge } from '../components/display/Badge';
import { EmptyState } from '../components/feedback/EmptyState';
import { Colors } from '../theme/colors';
import {
  submissionsService, FAMILY_LABEL, FAMILY_TINT,
  type Submission,
} from '../services/submissionsService';
import { formatDate } from '../utils/formatters';

/** Rows per page in Recent Submissions. */
const PAGE_SIZE = 15;

/**
 * The five things a worker can report.
 *
 * `tint` is the icon chip's background. The glyph on it is drawn in the app's
 * standard black outline — no `color` is passed, so Icon.tsx falls back to
 * DEFAULT_COLOR and these follow it if it ever changes. Every other Feather
 * icon in the worker UI is that same black line, and five coloured glyphs on
 * one grid broke the only visual convention these screens keep.
 *
 * So colour identifies the report type through the chip behind the glyph and
 * does nothing else. Black on each of the five tints ranges 15.46:1 to 16.96:1,
 * which is as legible as this screen gets.
 *
 * Before any of this the whole card was washed in the tint with the title set
 * to match, which stacked five saturated blocks side by side and made most of
 * the text unreadable — the "Near Miss" title was amber #F59E0B on amber
 * #FEF3C7 at 1.93:1, against a 4.5:1 minimum, and every description line failed
 * too. Near Miss and Hazard Register also shared #FEF3C7 outright, so two of
 * the five were the same colour. All five tints are distinct now; Hazard
 * Register moved to teal, which suits it — a register is standing reference
 * data, not an event that just happened.
 */
const REPORT_TYPES = [
  { id: 'near_miss',  icon: 'alert-triangle', title: 'Near Miss',       desc: 'Report a near miss event',            tint: '#FEF3C7', screen: 'ReportNearMiss'  },
  { id: 'incident',   icon: 'alert-octagon',  title: 'Incident',        desc: 'Report a safety incident',            tint: '#FEE2E2', screen: 'ReportIncident'  },
  { id: 'risk',       icon: 'shield',         title: 'Risk Observation', desc: 'One-off unsafe condition you saw',   tint: '#EDE9FE', screen: 'ReportRisk'      },
  // One Unsafe Act entry, not the two that used to sit here. "Unsafe Act" and
  // "Hazard Register" were the same family under two names — an unsafe act IS
  // a hazard — so the register flow survived (it runs all eight stages and the
  // worker can follow it) and took the Unsafe Act name and its blue/eye
  // identity.
  { id: 'hazard',     icon: 'eye',            title: 'Unsafe Act',      desc: 'Log an unsafe act that needs controlling', tint: '#DBEAFE', screen: 'LogHazard'  },
];

/** `under_investigation` -> `under investigation`. Every family stores its
 *  status this way, so one helper serves all five. */
function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function showSubmissionDetail(sub: Submission) {
  const lines = [
    `Ref: ${sub.reference}`,
    `Type: ${FAMILY_LABEL[sub.family]}`,
    sub.severity ? `Severity: ${String(sub.severity).toUpperCase()}` : '',
    `Date: ${sub.at ? formatDate(sub.at) : '—'}`,
    sub.status ? `Status: ${statusLabel(sub.status)}` : '',
    sub.title ? `\n${sub.title}` : '',
  ].filter(Boolean).join('\n');

  Alert.alert(FAMILY_LABEL[sub.family], lines);
}

export default function ReportsScreen({ navigation }: any) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubs = useCallback(() => {
    submissionsService
      .mine()
      .then(setSubs)
      .catch(() => setSubs([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadSubs();
    const unsubscribe = navigation.addListener('focus', loadSubs);
    // Five endpoints rather than one now, so the old five-second poll would be
    // twenty-five calls a minute for a list that changes when the worker
    // submits something. Refetching on focus covers that, and pull-to-refresh
    // covers the rest.
    return unsubscribe;
  }, [navigation, loadSubs]);

  const onRefresh = useCallback(() => { setIsLoading(true); loadSubs(); }, [loadSubs]);

  // ── Recent Submissions paging ──────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const scrollRef = React.useRef<ScrollView>(null);
  const listTopY = React.useRef(0);

  const pageCount = Math.max(1, Math.ceil(subs.length / PAGE_SIZE));
  // Clamped rather than stored blindly: a refresh can return fewer rows than
  // the page the worker is standing on — closing something out is enough — and
  // an out-of-range page renders as an empty list with no way to tell why.
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const visible = subs.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (next: number) => {
    setPage(next);
    // Without this, paging while scrolled to the bottom lands the reader on the
    // last rows of the new page rather than its first.
    scrollRef.current?.scrollTo({ y: listTopY.current, animated: true });
  };

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Incidents lead: the most serious thing a worker can raise, and the
            one they are most likely to come back to. It had no row here for
            longer than the others only because Recent Submissions used to be
            the incident list. */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('MyIncidents')}
          activeOpacity={0.8}
        >
          <View style={[styles.registerChip, { backgroundColor: '#FEE2E2' }]}>
            <Icon name="alert-octagon" style={styles.registerIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>My Incidents</Text>
            <Text style={styles.registerDesc}>Follow what you reported through the investigation</Text>
          </View>
          <Icon name="chevron-right" style={styles.registerChevron} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Flow 5 · the standing register the worker can follow to closure.
            Recent Submissions below now carries every family, but it is a
            history: this is the way in to the register itself. */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('MyHazards')}
          activeOpacity={0.8}
        >
          <View style={[styles.registerChip, { backgroundColor: '#DBEAFE' }]}>
            <Icon name="list" style={styles.registerIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>My Unsafe Acts</Text>
            <Text style={styles.registerDesc}>Track the unsafe acts you logged through all eight stages</Text>
          </View>
          <Icon name="chevron-right" style={styles.registerChevron} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Near misses run the same eight stages as the register above. A
            reporter who never sees an outcome stops reporting, which is the one
            thing a near miss programme cannot afford. */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('MyNearMisses')}
          activeOpacity={0.8}
        >
          <View style={[styles.registerChip, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="alert-triangle" style={styles.registerIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>My Near Misses</Text>
            <Text style={styles.registerDesc}>Follow what you reported from triage to closure</Text>
          </View>
          <Icon name="chevron-right" style={styles.registerChevron} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* The last family with a form and no way back to it. A risk observation
            is usually about something still standing on site, so whether anyone
            acted on it is a question the reporter has a live interest in.
            Separate from My Hazards above: that is the standing register. */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('MyRiskReports')}
          activeOpacity={0.8}
        >
          <View style={[styles.registerChip, { backgroundColor: '#EDE9FE' }]}>
            <Icon name="shield" style={styles.registerIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerTitle}>My Risk Reports</Text>
            <Text style={styles.registerDesc}>See how each risk you raised was rated and controlled</Text>
          </View>
          <Icon name="chevron-right" style={styles.registerChevron} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* New Report grid */}
        <Text style={styles.sectionTitle}>New Report</Text>
        <View style={styles.reportGrid}>
          {REPORT_TYPES.map(rt => (
            <TouchableOpacity
              key={rt.id}
              style={styles.reportCard}
              onPress={() => navigation.navigate(rt.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.reportChip, { backgroundColor: rt.tint }]}>
                <Icon name={rt.icon} style={styles.reportIcon} />
              </View>
              <Text style={styles.reportTitle}>{rt.title}</Text>
              <Text style={styles.reportDesc}>{rt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Submissions — every family, newest first, 15 to a page */}
        <View
          style={styles.recentHeader}
          onLayout={(e) => { listTopY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Recent Submissions</Text>
          {subs.length > 0 && (
            <Text style={styles.recentCount}>
              {pageStart + 1}–{pageStart + visible.length} of {subs.length}
            </Text>
          )}
        </View>

        {isLoading && subs.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : subs.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No Submissions Yet"
            subtitle="Anything you report — incidents, near misses, unsafe acts and risks — appears here."
          />
        ) : (
          visible.map(sub => {
            const fam = FAMILY_TINT[sub.family];
            return (
              <TouchableOpacity
                key={sub.key}
                onPress={() => showSubmissionDetail(sub)}
                activeOpacity={0.75}
              >
                <Card style={styles.recentCard} accentColor={fam.ink} elevation={1}>
                  <View style={styles.recentLeft}>
                    {/* The family, not the incident sub-type. Five families share
                        this list now and which one a row belongs to is the first
                        thing a reader needs. */}
                    <View style={[styles.recentFamily, { backgroundColor: fam.tint }]}>
                      <Text style={[styles.recentFamilyText, { color: fam.ink }]}>
                        {FAMILY_LABEL[sub.family].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.recentTitle} numberOfLines={2}>{sub.title}</Text>
                    <Text style={styles.recentDate}>
                      {sub.reference}{sub.at ? `  •  ${formatDate(sub.at)}` : ''}
                    </Text>
                  </View>
                  {!!sub.status && <StatusBadge status={statusLabel(sub.status)} />}
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* Only when there is somewhere to go. One page of results needs no
            controls, and showing a dead "Page 1 of 1" invites a tap that does
            nothing. */}
        {pageCount > 1 && (
          <View style={styles.pager}>
            <TouchableOpacity
              style={[styles.pagerBtn, safePage === 0 && styles.pagerBtnOff]}
              onPress={() => goToPage(safePage - 1)}
              disabled={safePage === 0}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              accessibilityState={{ disabled: safePage === 0 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name="chevron-left"
                style={styles.pagerIcon}
                color={safePage === 0 ? Colors.textLight : Colors.textDark}
              />
            </TouchableOpacity>

            <Text style={styles.pagerLabel}>Page {safePage + 1} of {pageCount}</Text>

            <TouchableOpacity
              style={[styles.pagerBtn, safePage >= pageCount - 1 && styles.pagerBtnOff]}
              onPress={() => goToPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Next page"
              accessibilityState={{ disabled: safePage >= pageCount - 1 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name="chevron-right"
                style={styles.pagerIcon}
                color={safePage >= pageCount - 1 ? Colors.textLight : Colors.textDark}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textDark },
  scroll: { flex: 1, padding: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 12, marginTop: 14 },

  // All three "My ..." rows used to be solid amber, whatever they linked to —
  // three identical blocks stacked above a grid of five more. They are white
  // cards now and the chip carries the colour, so the row that leads to hazards
  // is recognisably the hazard one.
  registerLink: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  registerChip: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  registerIcon: { fontSize: 19 },
  registerTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  registerDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  registerChevron: { fontSize: 18 },

  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  // White card, hairline border, colour confined to the chip. Matches the
  // register rows above so the whole screen reads as one surface.
  reportCard: {
    width: '47%', borderRadius: 14, padding: 16,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  reportChip: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  reportIcon: { fontSize: 20 },
  reportTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  reportDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },

  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  recentCount: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', fontVariant: ['tabular-nums'] },

  pager: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 4,
  },
  pagerBtn: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  // Faded rather than hidden: a control that vanishes at the ends makes the
  // row jump and the remaining button move under the thumb.
  pagerBtnOff: { backgroundColor: Colors.background, borderColor: '#EEF2F6' },
  pagerIcon: { fontSize: 20 },
  pagerLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textMid,
    fontVariant: ['tabular-nums'],
  },

  recentCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recentLeft: { flex: 1, marginRight: 10 },
  recentFamily: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 5 },
  recentFamilyText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  recentTitle: { fontSize: 14, fontWeight: '600', color: Colors.textDark, marginBottom: 3, lineHeight: 19 },
  recentDate: { fontSize: 12, color: Colors.textMuted },
});
