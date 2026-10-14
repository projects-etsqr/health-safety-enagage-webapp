import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { PendingSyncBanner } from '../../components/PendingSyncBanner';
import { Icon } from '../components/display/Icon';
import { Colors } from '../theme/colors';
import { useTasks } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';
import { AiFab } from '../../components/AiAssistant';

export default function DashboardScreen({ navigation }: any) {
  const { tasks, shiftSummary, isLoading, refetch } = useTasks();
  const user = useAuthStore(s => s.user);

  // Live safety score derived from the site's compliance rating (out of 5).
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  useEffect(() => {
    apiClient
      .get('dashboard/stats')
      .then((res: any) => {
        const rating = res?.data?.avg_compliance_rating;
        if (typeof rating === 'number') setSafetyScore(Math.round((rating / 5) * 100));
      })
      .catch(() => {});
  }, []);

  // "Values Worker Gets" — this worker's own numbers for one month. The backend
  // anchors that month on the worker's latest data, so it is not always the
  // current calendar month; period_label says which month is on screen.
  const [myKpis, setMyKpis] = useState<{
    my_incidents: number; my_near_misses: number;
    hours_logged_month: number; my_open_capa: number;
    period_label?: string;
  } | null>(null);
  const loadMyKpis = useCallback(() => {
    apiClient
      .get('worker/my-kpis')
      // The client interceptor already unwrapped { success, data }.
      .then((res: any) => setMyKpis(res?.data ?? null))
      .catch(() => {});
  }, []);
  useEffect(() => { loadMyKpis(); }, [loadMyKpis]);

  // Hours come back as a float (195.5); drop the ".0" but keep a real half-shift.
  const fmtHours = (h?: number) =>
    typeof h === 'number' ? (Number.isInteger(h) ? String(h) : h.toFixed(1)) : '—';

  // Recent Activity feed — real worker notifications (latest 3).
  const [activity, setActivity] = useState<any[]>([]);
  const loadActivity = useCallback(() => {
    apiClient
      .get('worker/notifications')
      .then((res: any) => {
        const items = res?.data?.items ?? [];
        setActivity(Array.isArray(items) ? items.slice(0, 3) : []);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const relTime = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  };

  const activityStyle = (type?: string) => {
    switch ((type || '').toLowerCase()) {
      case 'success':
        return { bg: '#E8F5E9', color: '#2E7D32', icon: 'check-circle', label: 'Success' };
      case 'warning':
      case 'alert':
      case 'danger':
      case 'error':
        return { bg: '#FFEBEE', color: '#C62828', icon: 'alert-triangle', label: 'Alert' };
      default:
        return { bg: '#E3F2FD', color: '#1565C0', icon: 'file-text', label: 'Info' };
    }
  };

  const onRefresh = useCallback(
    () => { refetch(); loadActivity(); loadMyKpis(); },
    [refetch, loadActivity, loadMyKpis],
  );

  // Coming back from Shift Check-In (or any reporting screen) must show the new
  // numbers — without this the dashboard keeps the figures it loaded at mount.
  useEffect(() => navigation.addListener('focus', onRefresh), [navigation, onRefresh]);

  // No fallback numbers. `total_tasks` defaulted to 5 and `active_permits` to
  // 2, and fetchShiftSummary swallows its errors — so a worker whose phone
  // could not reach the backend was shown "5 pending tasks" and "2 active
  // permits" as though they were real, with nothing to say otherwise. The
  // Safety Score tile in this same screen already renders an em dash when it
  // has no value; these now do the same.
  const total     = shiftSummary?.total_tasks ?? null;
  const completed = shiftSummary?.completed_tasks ?? null;
  const pending   = total != null && completed != null ? total - completed : null;

  // Real breakdown of the worker's own tasks.
  const now = Date.now();
  const isSameDay = (d: string) => {
    const t = new Date(d); const n = new Date();
    return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
  };
  const overdueCount = (tasks ?? []).filter(
    (t: any) => t?.due_at && new Date(t.due_at).getTime() < now && t?.status !== 'completed',
  ).length;
  const todayCount = (tasks ?? []).filter((t: any) => t?.due_at && isSameDay(t.due_at)).length;

  // "Your Schedule" — real tasks that have a due time, earliest first.
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  const scheduleItems = (tasks ?? [])
    .filter((t: any) => t?.due_at)
    .sort((a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, 5);
  // Highlight the next upcoming task (fall back to the first row).
  const activeIdx = (() => {
    const idx = scheduleItems.findIndex((t: any) => new Date(t.due_at).getTime() >= now);
    return idx === -1 ? 0 : idx;
  })();

  const displayName = user?.name ?? 'Alex';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Banner risk level derived from the live site compliance score (out of 100).
  // Higher compliance → lower operating risk.
  const risk =
    safetyScore == null
      ? { label: 'Normal', color: '#FBBF24' }
      : safetyScore >= 80
      ? { label: 'Low', color: '#4ADE80' }
      : safetyScore >= 50
      ? { label: 'Normal', color: '#FBBF24' }
      : { label: 'High', color: '#F87171' };

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>Ehsera</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon name="bell" style={styles.headerIcon} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      {/* Offline drafts waiting to reach the backend. Also drives the flush on
          app foreground — see components/PendingSyncBanner.tsx. */}
      <PendingSyncBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Good Morning Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerGreeting}>{greeting},</Text>
          <Text style={styles.bannerName}>{displayName}</Text>
          <Text style={styles.bannerSubtitle}>
            Site {user?.site || 'Alpha'} is currently operating at{' '}
            <Text style={{ color: risk.color, fontWeight: '800' }}>{risk.label} Risk</Text>. Stay safe today.
          </Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('SafetyChecklist')}>
            <Icon name="clipboard" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Checklist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ReportIncident')}>
            <Icon name="alert-octagon" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Report Incident</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ReportNearMiss')}>
            <Icon name="alert-triangle" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Near Miss</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('RaisePermit')}>
            <Icon name="edit-3" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Request Permit</Text>
          </TouchableOpacity>
          {/* Flow 5 · logs into the standing register, which the worker can
              then follow to closure on My Unsafe Acts. */}
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('LogHazard')}>
            <Icon name="tool" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Log Unsafe Act</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('SafetyTraining')}>
            <Icon name="award" style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>Training</Text>
          </TouchableOpacity>
        </View>

        {/* Your month — personal figures, not site-wide */}
        <View style={styles.myKpiHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Your Month</Text>
          {!!myKpis?.period_label && (
            <Text style={styles.myKpiPeriod}>{myKpis.period_label}</Text>
          )}
        </View>
        <View style={styles.myKpiRow}>
          <View style={styles.myKpiCard}>
            <Text style={styles.myKpiVal}>{fmtHours(myKpis?.hours_logged_month)}</Text>
            <Text style={styles.myKpiLbl}>Hours Logged</Text>
          </View>
          <View style={styles.myKpiCard}>
            <Text style={styles.myKpiVal}>{myKpis?.my_incidents ?? '—'}</Text>
            <Text style={styles.myKpiLbl}>My Incidents</Text>
          </View>
          <View style={styles.myKpiCard}>
            <Text style={styles.myKpiVal}>{myKpis?.my_near_misses ?? '—'}</Text>
            <Text style={styles.myKpiLbl}>My Near Misses</Text>
          </View>
          {/* This tile counted the worker's own corrective actions but had no
              screen behind it — the CAPA screen lives in the supervisor stack.
              It now opens the owner's list. */}
          <TouchableOpacity
            style={styles.myKpiCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('MyActions')}
          >
            <Text style={styles.myKpiVal}>{myKpis?.my_open_capa ?? '—'}</Text>
            <Text style={styles.myKpiLbl}>Open CAPAs</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsRow}>
          {/* Card 1: Safety Score */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Safety Score</Text>
              <Icon name="trending-up" style={styles.trendIcon} color="#22C55E" />
            </View>
            <View style={styles.statCardValueRow}>
              <Text style={styles.statCardValue}>{safetyScore ?? '—'}</Text>
              <Text style={styles.statCardSubValue}>%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${safetyScore ?? 0}%`, backgroundColor: '#22C55E' }]} />
            </View>
            <Text style={styles.statCardTrendText}>Site compliance rating</Text>
          </View>

          {/* Card 2: Pending Tasks */}
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Tasks')}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Pending Tasks</Text>
              <Icon name="clipboard" style={styles.cardHeaderIcon} />
            </View>
            <Text style={styles.statCardValue}>{pending ?? '—'}</Text>
            <Text style={styles.statCardSubText}>{overdueCount} overdue, {todayCount} for today</Text>
          </TouchableOpacity>

          {/* Card 3: Active Permits */}
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Alerts')}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>Active Permits</Text>
              <Icon name="map-pin" style={styles.cardHeaderIcon} />
            </View>
            <Text style={styles.statCardValue}>{shiftSummary?.active_permits ?? '—'}</Text>
            <Text style={styles.statCardSubText}>Track active & pending safety permits</Text>
          </TouchableOpacity>
        </View>

        {/* Your Schedule */}
        <Text style={styles.sectionTitle}>Your Schedule</Text>
        <View style={styles.scheduleCard}>
          {scheduleItems.length === 0 ? (
            <Text style={styles.timelineLoc}>No scheduled tasks.</Text>
          ) : (
            scheduleItems.map((t: any, i: number) => {
              const isActive = i === activeIdx;
              const isLast = i === scheduleItems.length - 1;
              return (
                <View key={t.id ?? i} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, isActive && styles.timelineDotActive]} />
                    {!isLast && (
                      <View style={[styles.timelineLine, isActive && styles.timelineLineActive]} />
                    )}
                  </View>
                  <View style={styles.timelineRight}>
                    <Text style={styles.timelineTime}>{fmtTime(t.due_at)}</Text>
                    <Text style={[styles.timelineTitle, !isActive && styles.timelineTitlePending]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.timelineLoc} numberOfLines={1}>{t.location}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          {activity.length === 0 ? (
            <View style={styles.activityItem}>
              <Text style={styles.activityMeta}>No recent activity.</Text>
            </View>
          ) : (
            activity.map((a, i) => {
              const s = activityStyle(a.type);
              return (
                <View
                  key={a.id ?? i}
                  style={[styles.activityItem, i === activity.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.activityIconBox, { backgroundColor: s.bg }]}>
                    <Icon name={s.icon} style={styles.activityIcon} color={s.color} />
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.activityMeta} numberOfLines={1}>
                      {a.message ? `${a.message} • ${relTime(a.created_at)}` : relTime(a.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Same assistant button the other three roles use, stacked above the
          permit FAB so the two don't overlap. */}
      <AiFab
        style={styles.aiFab}
        onPress={() => navigation.navigate('AISafetyAssistant')}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RaisePermit')}
      >
        <Icon name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  myKpiHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: 12, marginTop: 4,
  },
  myKpiPeriod: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  myKpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  myKpiCard: {
    flexGrow: 1, flexBasis: '45%', minWidth: 140,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  myKpiVal: { fontSize: 22, fontWeight: '800', color: '#2563EB' },
  myKpiLbl: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    position: 'relative',
  },
  headerIcon: {
    fontSize: 22,
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  scroll: {
    padding: 16,
  },
  banner: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerGreeting: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  bannerName: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: -2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 10,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  trendIcon: {
    fontSize: 14,
  },
  cardHeaderIcon: {
    fontSize: 14,
  },
  statCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  statCardSubValue: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 2,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginVertical: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  statCardTrendText: {
    fontSize: 8,
    color: '#22C55E',
    fontWeight: '700',
  },
  statCardSubText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 4,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
    width: 20,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineDotActive: {
    backgroundColor: '#2563EB',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  timelineLineActive: {
    backgroundColor: '#2563EB',
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineTitlePending: {
    color: '#475569',
    fontWeight: '600',
  },
  timelineLoc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  featuredCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  featuredImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  featuredContent: {
    padding: 20,
  },
  featuredTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  featuredDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  featuredBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIcon: {
    fontSize: 16,
  },
  activityBody: {
    flex: 1,
    marginRight: 8,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 17,
  },
  activityMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickActionBtn: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  // Position only — size, colour and icon come from the shared AiFab so this
  // matches supervisor/manager/auditor. Sits one FAB-height + gap above the
  // permit FAB, and right-aligned with it (the shared default is 18).
  aiFab: {
    bottom: 88,
    right: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '500',
    marginTop: -2,
  },
});
