import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Icon } from '../components/display/Icon';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import { capaService, CapaSummary } from '../services/capaService';

/**
 * The corrective actions this worker owns.
 *
 * The dashboard has shown an "Open CAPAs" count for a long time with nothing
 * behind it — CAPAManagement exists only in the supervisor stack — so an action
 * assigned to a worker was invisible on their own app. This is that screen.
 *
 * Deliberately shows the deadline as elapsed percentage rather than days left:
 * the whole escalation chain is proportional, so "82% of the time gone" is the
 * number that matches what the system is about to do next.
 */

const BAND_STYLES: Record<string, { bg: string; fg: string }> = {
  Critical: { bg: Colors.criticalBg, fg: Colors.critical },
  High:     { bg: Colors.warningBg,  fg: '#B45309' },
  Standard: { bg: '#EFF6FF',         fg: Colors.blue },
};

function progressColour(pct: number | null, overdue: boolean) {
  if (overdue) return Colors.critical;
  if (pct != null && pct >= 75) return Colors.warning;
  return Colors.success;
}

export default function MyActionsScreen({ navigation }: any) {
  const [actions, setActions] = useState<CapaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setActions(await capaService.myActions());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not load your corrective actions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Reload on focus: the supervisor may have run the halfway check, which
    // changes what this screen can do next.
    return navigation?.addListener?.('focus', load);
  }, [load, navigation]);

  const overdue = actions.filter(a => a.is_overdue);
  const rest = actions.filter(a => !a.is_overdue);

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Actions</Text>
        <Text style={styles.headerSub}>
          Corrective actions assigned to you
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {error && (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={16} color={Colors.critical} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {actions.length === 0 && !error && (
            <View style={styles.empty}>
              <Icon name="check-circle" size={34} color={Colors.textLight} />
              <Text style={styles.emptyText}>No corrective actions assigned to you.</Text>
            </View>
          )}

          {overdue.length > 0 && (
            <Text style={[styles.sectionLabel, { color: Colors.critical }]}>
              Overdue · {overdue.length}
            </Text>
          )}
          {overdue.map(a => (
            <ActionCard key={a.id} action={a} navigation={navigation} />
          ))}

          {rest.length > 0 && <Text style={styles.sectionLabel}>Open · {rest.length}</Text>}
          {rest.map(a => (
            <ActionCard key={a.id} action={a} navigation={navigation} />
          ))}
        </ScrollView>
      )}
    </ScreenLayout>
  );
}

function ActionCard({ action, navigation }: { action: CapaSummary; navigation: any }) {
  const band = BAND_STYLES[action.priority_band ?? ''] ?? { bg: '#F1F5F9', fg: Colors.textMuted };
  const pct = action.elapsed_percent;
  // Clamped so a badly overdue action does not draw a bar off the card.
  const width = Math.max(0, Math.min(100, pct ?? 0));

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('ActionDetail', { id: action.id })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.ref}>{action.capa_ref}</Text>
        <View style={[styles.badge, { backgroundColor: band.bg }]}>
          <Text style={[styles.badgeText, { color: band.fg }]}>
            {action.priority_band ?? 'Unscored'}
          </Text>
        </View>
      </View>

      <Text style={styles.desc} numberOfLines={2}>{action.description}</Text>

      <View style={styles.stepRow}>
        <Icon name="git-commit" size={13} color={Colors.textMuted} />
        <Text style={styles.stepText}>
          Step {action.step} of 10 · {action.step_label}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${width}%`, backgroundColor: progressColour(pct, action.is_overdue) },
          ]}
        />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.due}>
          {action.due_date ? `Due ${action.due_date}` : 'No deadline set'}
        </Text>
        <Text style={[styles.pct, { color: progressColour(pct, action.is_overdue) }]}>
          {pct == null ? '—' : `${pct}% elapsed`}
        </Text>
      </View>

      {action.reopened_count > 0 && (
        <View style={styles.flagRow}>
          <Icon name="rotate-ccw" size={12} color={Colors.critical} />
          <Text style={styles.flagText}>
            Reopened {action.reopened_count}× — the previous fix did not hold
          </Text>
        </View>
      )}
      {action.systemic_flag && (
        <View style={styles.flagRow}>
          <Icon name="alert-octagon" size={12} color={Colors.critical} />
          <Text style={styles.flagText}>Part of a flagged systemic issue</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.card },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textDark },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  body: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10, marginBottom: 8,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  desc: { fontSize: 15, color: Colors.textDark, marginTop: 6, lineHeight: 21 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  stepText: { fontSize: 12, color: Colors.textMuted },

  barTrack: {
    height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginTop: 10, overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  due: { fontSize: 12, color: Colors.textMuted },
  pct: { fontSize: 12, fontWeight: '700' },

  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  flagText: { fontSize: 11, color: Colors.critical, flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  errorBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.criticalBg,
    padding: 12, borderRadius: 10, marginBottom: 12,
  },
  errorText: { color: Colors.critical, fontSize: 13, flex: 1 },
});
