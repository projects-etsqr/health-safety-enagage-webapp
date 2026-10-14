import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useDashboard } from '../hooks/useDashboard';
import { permitService } from '../services/permitService';
import { apiClient } from '../api/client';
import { Avatar } from '../components';
import { AiFab, AI_PROMPTS } from '../components/AiAssistant';

const PERMIT_STATUS_COLOR: Record<string, string> = {
  active: '#16A34A', approved: '#16A34A', pending: '#F59E0B',
  pending_approval: '#F59E0B', rejected: '#EF4444', expired: '#94A3B8',
};

interface Props {
  navigation: any;
}

export function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { stats, alerts, shiftStatus, isLoading, refresh } = useDashboard();

  // "Values Supervisor Gets" — zone rates and the queues this supervisor owns.
  const [zoneKpis, setZoneKpis] = useState<any | null>(null);
  const loadZoneKpis = useCallback(() => {
    apiClient.get('/supervisor/my-kpis')
      .then((r: any) => setZoneKpis(r.data ?? null))
      .catch(() => {});
  }, []);

  // Real permits for the "Active Permits" section.
  const [permits, setPermits] = useState<any[]>([]);
  const loadPermits = useCallback(() => {
    permitService.getPermits().then((r: any) => setPermits(r?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    loadPermits();
    loadZoneKpis();

    const unsubscribe = navigation.addListener('focus', () => {
      refresh();
      loadPermits();
      loadZoneKpis();
    });

    const interval = setInterval(() => {
      refresh();
      loadPermits();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [navigation, refresh, loadPermits]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={user?.name ?? 'Supervisor'} size={42} />
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeSub}>Welcome back,</Text>
            <Text style={styles.welcomeTitle}>{user?.name ?? 'Site Supervisor'}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationCenter')}
          style={styles.bellBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.textDark} />
          {alerts.length > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} colors={[Colors.primary]} />
        }
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Attendance */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('TeamManagement')}
            activeOpacity={0.9}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="people" size={20} color="#004AC6" />
            </View>
            <Text style={styles.statValue}>
              {stats?.attendance_pct != null ? `${stats.attendance_pct}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Team Attendance</Text>
          </TouchableOpacity>

          {/* Active Permits */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardLarge]}
            onPress={() => navigation.navigate('Permits')}
            activeOpacity={0.9}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="document-text" size={20} color="#16A34A" />
            </View>
            <View style={styles.permitStats}>
              <Text style={styles.statValue}>
                {stats?.active_permits ?? '—'} Active
              </Text>
              {stats?.pending_permits ? (
                <Text style={styles.statSubValue}>
                  {stats.pending_permits} Pending approval
                </Text>
              ) : (
                <Text style={styles.statSubValue}>All permits approved</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Safety Compliance */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('SafetyObservationManagement')}
            activeOpacity={0.9}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#F97316" />
            </View>
            <Text style={styles.statValue}>
              {stats?.safety_compliance_pct != null ? `${stats.safety_compliance_pct}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Safety Score</Text>
          </TouchableOpacity>
        </View>

        {/* Zone KPIs — the supervisor's own area, not the whole org */}
        <Text style={styles.sectionTitle}>Your Zone</Text>
        <View style={styles.zoneGrid}>
          {/* "Site", not "Zone": the rate is computed over the whole site because
              the injury count behind it is, and the data cannot attribute an
              injury to one supervisor's team. Team Man-Hours below is genuinely
              this supervisor's. */}
          <ZoneTile label="Site TRIR" value={zoneKpis?.zone_trir} />
          <ZoneTile label="Near Miss Ratio" value={zoneKpis?.near_miss_ratio} />
          <ZoneTile label="Open Permits" value={zoneKpis?.open_permits} />
          <ZoneTile label="Pending CAPAs" value={zoneKpis?.pending_capa} />
          <ZoneTile label="Walk Follow-Up" value={zoneKpis?.walk_follow_up_rate} suffix="%" />
          <ZoneTile label="Avg Walk Rating" value={zoneKpis?.walk_avg_rating} suffix="/5" />
          <ZoneTile label="Team Man-Hours" value={zoneKpis?.team_man_hours} />
          <ZoneTile label="Investigations" value={zoneKpis?.investigations_queue} />
        </View>

        {/* Quick Actions Title */}
        <Text style={styles.sectionTitle}>Quick Management Actions</Text>

        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('Permits')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="create-outline" size={24} color="#004AC6" />
            </View>
            <Text style={styles.gridLabel}>Approve Permits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('InspectionManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkbox-outline" size={24} color="#16A34A" />
            </View>
            <Text style={styles.gridLabel}>Site Inspections</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            // ShiftConfirmation is registered in SupervisorOperationsStack, not in
            // this Home stack, so a bare navigate('ShiftConfirmation') is not
            // handled by any navigator. Address it through its parent tab.
            onPress={() =>
              navigation.navigate('Operations', { screen: 'ShiftConfirmation' })
            }
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="time-outline" size={24} color="#2563EB" />
            </View>
            <Text style={styles.gridLabel}>Confirm Shift Hours</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('SafetyObservationManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="eye-outline" size={24} color="#DB2777" />
            </View>
            <Text style={styles.gridLabel}>Safety Audits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('Tasks')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
            </View>
            <Text style={styles.gridLabel}>Report Incident</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('Training')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#ECFEFF' }]}>
              <Ionicons name="play-circle-outline" size={24} color="#0891B2" />
            </View>
            <Text style={styles.gridLabel}>Training</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('SessionManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FAF5FF' }]}>
              <Ionicons name="time-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.gridLabel}>Shift Session</Text>
          </TouchableOpacity>
        </View>

        {/* AI Safety Insights Banner */}
        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => navigation.navigate('AISafetyInsights')}
          activeOpacity={0.85}
        >
          <View style={styles.aiLeft}>
            <View style={styles.aiIconBox}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.aiTextBox}>
              <Text style={styles.aiTitle}>AI Safety Insights</Text>
              <Text style={styles.aiDesc}>
                {alerts.length > 0
                  ? `${alerts.length} safety alert${alerts.length > 1 ? 's' : ''} flagged — tap to review`
                  : 'No active safety alerts — all clear'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ opacity: 0.8 }} />
        </TouchableOpacity>

        {/* Workforce Status Card */}
        <TouchableOpacity
          style={styles.workforceCard}
          onPress={() => navigation.navigate('TeamPerformanceMetrics')}
          activeOpacity={0.9}
        >
          <View style={styles.wfHeader}>
            <Text style={styles.wfTitle}>Workforce Status</Text>
            {shiftStatus?.is_live && <Text style={styles.wfLive}>● Live</Text>}
          </View>
          <View style={styles.wfRow}>
            <View style={styles.wfItem}>
              <Text style={styles.wfVal}>{shiftStatus?.logged_in ?? '—'}</Text>
              <Text style={styles.wfLbl}>On Site Today</Text>
            </View>
            <View style={styles.wfItem}>
              <Text style={styles.wfVal}>{shiftStatus?.total ?? '—'}</Text>
              <Text style={styles.wfLbl}>Total Team</Text>
            </View>
            <View style={styles.wfItem}>
              <Text style={[styles.wfVal, { color: '#EF4444' }]}>{shiftStatus?.pending ?? '—'}</Text>
              <Text style={styles.wfLbl}>Pending</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Active Permits Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Permits</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Permits')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Coded Permits List — real data */}
        <View style={styles.permitsList}>
          {permits.length === 0 ? (
            <View style={styles.permitItem}>
              <Text style={styles.permitSub}>No permits to show right now.</Text>
            </View>
          ) : (
            permits.slice(0, 5).map((p: any) => {
              const statusKey = String(p.status || '').toLowerCase();
              const color = PERMIT_STATUS_COLOR[statusKey] || '#94A3B8';
              const expTime = p.validity_end
                ? new Date(p.validity_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : null;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.permitItem}
                  onPress={() => navigation.navigate('PermitRequestManagement')}
                  activeOpacity={0.8}
                >
                  <View style={styles.permitLeft}>
                    <View style={[styles.permitIndicator, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permitName} numberOfLines={1}>
                        {p.title || p.permit_type || p.permit_ref || 'Permit'}
                      </Text>
                      <Text style={styles.permitSub} numberOfLines={1}>
                        {[p.location, expTime ? `Exp. ${expTime}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.permitRight}>
                    <Text style={[styles.permitStatusText, { color }]}>
                      {statusKey ? statusKey.replace(/_/g, ' ') : 'Active'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <AiFab onPress={() => navigation.navigate('AiAssistant', AI_PROMPTS.supervisor)} />
    </SafeAreaView>
  );
}

function ZoneTile({ label, value, suffix = '' }: { label: string; value?: number | null; suffix?: string }) {
  return (
    <View style={styles.zoneTile}>
      <Text style={styles.zoneVal}>{value == null ? '—' : `${value}${suffix}`}</Text>
      <Text style={styles.zoneLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  zoneTile: {
    flexGrow: 1, flexBasis: '45%', minWidth: 140,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  zoneVal: { fontSize: 19, fontWeight: '800', color: '#004AC6' },
  zoneLbl: { fontSize: 11, fontWeight: '700', color: '#737686', marginTop: 4 },
  root: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeBox: {
    justifyContent: 'center',
  },
  welcomeSub: {
    fontSize: 12,
    color: '#737686',
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1C30',
  },
  bellBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statCardLarge: {
    flex: 1.8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1C30',
  },
  statSubValue: {
    fontSize: 10,
    color: '#737686',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#737686',
    marginTop: 4,
  },
  permitStats: {
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1C30',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: '31%',
    aspectRatio: 1.1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#434655',
    textAlign: 'center',
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#004AC6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTextBox: {
    justifyContent: 'center',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  workforceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  wfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  wfTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1C30',
  },
  wfLive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  wfRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  wfItem: {
    alignItems: 'center',
  },
  wfVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B1C30',
  },
  wfLbl: {
    fontSize: 11,
    color: '#737686',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#004AC6',
  },
  permitsList: {
    gap: 12,
  },
  permitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  permitLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 10,
  },
  permitIndicator: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  permitName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1C30',
  },
  permitSub: {
    fontSize: 11,
    color: '#737686',
    marginTop: 2,
  },
  permitRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  permitStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    textTransform: 'capitalize',
  },
});
