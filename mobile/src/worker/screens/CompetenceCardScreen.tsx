/**
 * WF-06 · My Competence Card.
 *
 * "Live matrix vs role. Expiry at 60/30/7. Shows which tasks are blocked.
 *  New-worker flag for first 30 days."
 *
 * The blocked list is the point of this screen: a worker should find out that
 * an expired certificate stops them working here, at the start of the shift,
 * rather than at the permit desk.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Card, EmptyState, Loading, bandColor, HSE_COLORS } from '../../components/hseiq';
import { competenceService, CompetenceCard } from '../../services/hseiqService';

const STATUS_COLOR: Record<string, string> = {
  valid: '#10B981',
  expiring: '#F59E0B',
  expired: '#EF4444',
  missing: '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  missing: 'Not held',
};

export default function CompetenceCardScreen({ navigation }: any) {
  const [card, setCard] = useState<CompetenceCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    competenceService
      .myCard()
      .then(setCard)
      .catch(() => setCard(null))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(load, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScreenLayout>
      <AppHeader title="My Competence Card" onBack={() => navigation.goBack()} light />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {loading ? (
          <Loading text="Loading your competence matrix…" />
        ) : !card ? (
          <EmptyState text="Your competence card could not be loaded." />
        ) : (
          <>
            {card.is_new_worker ? (
              <View style={styles.newWorker}>
                <Text style={styles.newWorkerText}>
                  New worker — first 30 days. A buddy is required for work at height,
                  confined space and hot work.
                </Text>
              </View>
            ) : null}

            {card.blocked_tasks.length > 0 ? (
              <View style={styles.blocked}>
                <Text style={styles.blockedTitle}>
                  {card.blocked_tasks.length} task type{card.blocked_tasks.length > 1 ? 's are' : ' is'} blocked
                </Text>
                {card.blocked_tasks.map(t => (
                  <Text key={t} style={styles.blockedItem}>• {t}</Text>
                ))}
                <Text style={styles.blockedHelp}>
                  A permit naming you cannot be issued until these are renewed.
                </Text>
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              {([
                ['valid', card.valid_count],
                ['expiring', card.expiring_count],
                ['expired', card.expired_count],
                ['missing', card.missing_count],
              ] as const).map(([key, n]) => (
                <View key={key} style={styles.summaryTile}>
                  <Text style={[styles.summaryNum, { color: STATUS_COLOR[key] }]}>{n}</Text>
                  <Text style={styles.summaryLabel}>{STATUS_LABEL[key]}</Text>
                </View>
              ))}
            </View>

            <Card title="Requirements for your role">
              {card.items.length === 0 ? (
                <Text style={styles.muted}>
                  No competence requirements are configured for this organisation yet.
                </Text>
              ) : (
                card.items.map((item, i) => (
                  <View key={`${item.requirement_name}-${i}`} style={styles.item}>
                    <View style={styles.itemHead}>
                      <Text style={styles.itemName}>{item.requirement_name}</Text>
                      <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                        <Text style={styles.badgeText}>{STATUS_LABEL[item.status].toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.itemMeta}>
                      {item.is_safety_critical ? (
                        <Text style={styles.criticalTag}>SAFETY CRITICAL</Text>
                      ) : null}
                      {item.expires_at ? (
                        <Text style={styles.itemDate}>
                          {item.days_to_expiry != null && item.days_to_expiry >= 0
                            ? `Expires ${item.expires_at} · ${item.days_to_expiry} days`
                            : `Expired ${item.expires_at}`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  newWorker: {
    backgroundColor: '#EFF6FF', borderLeftWidth: 4, borderLeftColor: '#3B82F6',
    padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 8,
  },
  newWorkerText: { fontSize: 13, color: '#1E40AF', lineHeight: 19 },

  blocked: {
    backgroundColor: HSE_COLORS.blockBg, borderLeftWidth: 4, borderLeftColor: HSE_COLORS.block,
    padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 8,
  },
  blockedTitle: { fontSize: 14, fontWeight: '800', color: HSE_COLORS.block },
  blockedItem: { fontSize: 13, color: '#991B1B', marginTop: 6 },
  blockedHelp: { fontSize: 12, color: '#B91C1C', marginTop: 10, fontStyle: 'italic' },

  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 },
  summaryTile: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  summaryNum: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 2 },

  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 14, color: HSE_COLORS.textDark, flex: 1, fontWeight: '500' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  itemDate: { fontSize: 11, color: HSE_COLORS.textMuted },
  criticalTag: { fontSize: 9, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  muted: { fontSize: 13, color: HSE_COLORS.textMuted },
});
