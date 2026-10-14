import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { reportWorkflowService } from '../services/reportWorkflowService';
import { hazardRegisterService } from '../services/hazardRegisterService';

interface Props {
  navigation: any;
}

/**
 * The supervisor's Tasks tab — what the workers under them have sent up.
 *
 * This was the "Incidents" tab, and it showed one flat safety feed: incidents
 * and near misses interleaved in a single stream, with risk observations and
 * hazard register entries reachable only through a tools grid further down. A
 * supervisor could not see how many of each family were waiting, and the two
 * families that had no feed row looked like they had nothing outstanding.
 *
 * So the four families a worker can raise each get a card carrying their own
 * counts, and the entries live behind the card rather than in a merged list.
 * The count that leads is "waiting on you" — every family's `next-actions`
 * endpoint already resolves whose step it is, and that is the number a
 * supervisor opens this tab to find.
 *
 * Unsafe acts stay in the tools grid below as "Observations": they are a fifth
 * family and were not part of what this tab was asked to surface, and moving
 * them would have taken the screen away from the supervisors already using it.
 */

type FamilyKey = 'incident' | 'near_miss' | 'risk' | 'hazard';

interface FamilyCard {
  key: FamilyKey;
  label: string;
  blurb: string;
  icon: string;
  color: string;
  bg: string;
  route: string;
}

const FAMILIES: FamilyCard[] = [
  {
    key: 'incident', label: 'Incidents', blurb: 'Something happened and someone may be hurt',
    icon: 'flame-outline', color: '#EF4444', bg: '#FEF2F2', route: 'IncidentQueue',
  },
  {
    key: 'near_miss', label: 'Near Misses', blurb: 'It nearly happened — the warning before the injury',
    icon: 'warning-outline', color: '#F97316', bg: '#FFF7ED', route: 'NearMissManagement',
  },
  {
    key: 'risk', label: 'Risk Observations', blurb: 'A risk a worker saw in the field',
    icon: 'alert-circle-outline', color: '#8B5CF6', bg: '#FAF5FF', route: 'RiskManagement',
  },
  {
    key: 'hazard', label: 'Unsafe Act Register', blurb: 'An unsafe act logged against the register',
    icon: 'shield-half-outline', color: '#0891B2', bg: '#ECFEFF', route: 'HazardRegisterManagement',
  },
];

interface Counts {
  mine: number;
  open: number;
}

const EMPTY: Counts = { mine: 0, open: 0 };

/**
 * "Open" means "not closed", counted the same way for all four.
 *
 * Each family reports its statuses differently: the factory-built three wrap
 * them in `by_status`, the incident endpoint predates the factory and returns
 * them at the top level with no wrapper, and the hazard register also publishes
 * an `open` of its own — which counts only hazards not yet *controlled*, so a
 * hazard sitting at LEARN is excluded from it. Using that number here would put
 * 6 next to a family holding 18 live records while its neighbours counted every
 * live record they had, and the four cards are read side by side.
 */
function notClosed(byStatus: Record<string, unknown> | null | undefined): number {
  if (!byStatus) return 0;
  return Object.entries(byStatus)
    .filter(([k]) => !['closed', 'total', 'report_type'].includes(k))
    .reduce((sum, [, n]) => sum + (typeof n === 'number' ? n : 0), 0);
}

export function TasksScreen({ navigation }: Props) {
  const [counts, setCounts] = useState<Record<FamilyKey, Counts>>({
    incident: EMPTY, near_miss: EMPTY, risk: EMPTY, hazard: EMPTY,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const next: Record<FamilyKey, Counts> = {
      incident: EMPTY, near_miss: EMPTY, risk: EMPTY, hazard: EMPTY,
    };

    const reportFamily = async (key: 'incident' | 'near_miss' | 'risk') => {
      const api = reportWorkflowService(key);
      const [queue, stats] = await Promise.all([
        api.getNextActions(true).catch(() => ({ count: 0, items: [], mine_count: 0 })),
        api.getStats().catch(() => null as any),
      ]);
      next[key] = {
        mine: queue.mine_count ?? queue.count ?? 0,
        open: notClosed(stats?.by_status ?? stats),
      };
    };

    const hazardFamily = async () => {
      const [queue, stats] = await Promise.all([
        hazardRegisterService.getNextActions(true).catch(() => ({ count: 0, items: [], mine_count: 0 })),
        hazardRegisterService.stats().catch(() => null),
      ]);
      next.hazard = {
        mine: queue.mine_count ?? queue.count ?? 0,
        open: notClosed(stats?.by_status),
      };
    };

    await Promise.all([
      reportFamily('incident'),
      reportFamily('near_miss'),
      reportFamily('risk'),
      hazardFamily(),
    ]);
    setCounts(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const totalWaiting = Object.values(counts).reduce((n, c) => n + c.mine, 0);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.headerSubtitle}>
          {loading
            ? 'Loading what your team has raised…'
            : totalWaiting === 0
              ? 'Nothing is waiting on you right now'
              : `${totalWaiting} item${totalWaiting === 1 ? '' : 's'} waiting on you`}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={styles.sectionTitle}>Raised by your team</Text>

        <View style={styles.cards}>
          {FAMILIES.map((f) => {
            const c = counts[f.key];
            return (
              <TouchableOpacity
                key={f.key}
                style={styles.familyCard}
                onPress={() => navigation.navigate(f.route)}
                activeOpacity={0.85}
              >
                <View style={[styles.familyIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon as any} size={24} color={f.color} />
                </View>

                <View style={styles.familyBody}>
                  <Text style={styles.familyLabel}>{f.label}</Text>
                  <Text style={styles.familyBlurb} numberOfLines={2}>{f.blurb}</Text>

                  <View style={styles.familyCounts}>
                    {c.mine > 0 ? (
                      <View style={[styles.countPill, { backgroundColor: f.bg }]}>
                        <Text style={[styles.countPillText, { color: f.color }]}>
                          {c.mine} waiting on you
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.countPill, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.countPillText, { color: '#16A34A' }]}>Clear</Text>
                      </View>
                    )}
                    <Text style={styles.countMuted}>{c.open} open</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#C2C8D6" />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Safety Management Modules</Text>

        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('SafetyObservationManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="eye-outline" size={22} color="#DB2777" />
            </View>
            <Text style={styles.gridLabel}>Observations</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('InspectionManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkbox-outline" size={22} color="#16A34A" />
            </View>
            <Text style={styles.gridLabel}>Inspections</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('CAPAManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="hammer-outline" size={22} color="#004AC6" />
            </View>
            <Text style={styles.gridLabel}>CAPA Logs</Text>
          </TouchableOpacity>

          {/* The supervisor's own steps on somebody else's action: the 50%
              halfway check and the independent review of evidence. */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('CapaReviewQueue')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#ECFEFF' }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#0891B2" />
            </View>
            <Text style={styles.gridLabel}>CAPA Reviews</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0B1C30' },
  headerSubtitle: { fontSize: 12, color: '#737686', marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0B1C30', marginTop: 16, marginBottom: 14 },

  cards: { gap: 12, marginBottom: 8 },
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  familyIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  familyBody: { flex: 1 },
  familyLabel: { fontSize: 15, fontWeight: '700', color: '#0B1C30' },
  familyBlurb: { fontSize: 11.5, color: '#737686', marginTop: 2, lineHeight: 16 },
  familyCounts: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  countPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countPillText: { fontSize: 10.5, fontWeight: '800' },
  countMuted: { fontSize: 11, color: '#9AA1B4' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
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
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  gridLabel: { fontSize: 11, fontWeight: '600', color: '#434655', textAlign: 'center' },
});
