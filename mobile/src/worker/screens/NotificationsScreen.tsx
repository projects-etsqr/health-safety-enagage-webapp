import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Icon } from '../components/display/Icon';
import { EmptyState } from '../components/feedback/EmptyState';
import { Colors } from '../theme/colors';
import { notificationService, Notification } from '../services/notificationService';

const PRIORITY_COLOR: Record<string, string> = {
  critical: Colors.critical,
  high:     Colors.warning,
  medium:   Colors.blue,
  low:      Colors.textLight,
};

const PRIORITY_ICON: Record<string, string> = {
  critical: '🚨',
  high:     '⚠️',
  medium:   'ℹ️',
  low:      '🔔',
  // → alert-octagon / alert-triangle / info / bell (see EMOJI_ICON_MAP)
};

function formatAge(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.items ?? []);
    } catch {
      Alert.alert('Error', 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      Alert.alert('Error', 'Could not mark notifications as read.');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScreenLayout>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && notifications.length === 0 ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No Notifications"
          subtitle="You're all caught up. Pull down to refresh."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={load} tintColor={Colors.primary} />
          }
        >
          {notifications.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => handleMarkRead(n.id)}
              activeOpacity={0.75}
            >
              {/* Priority stripe */}
              <View style={[styles.stripe, { backgroundColor: PRIORITY_COLOR[n.priority] ?? Colors.textLight }]} />

              <Icon
                emoji={PRIORITY_ICON[n.priority] ?? '🔔'}
                style={styles.rowIcon}
                color={PRIORITY_COLOR[n.priority] ?? Colors.textLight}
              />

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, !n.read && styles.rowTitleUnread]} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={styles.rowAge}>{formatAge(n.created_at)}</Text>
                </View>
                {n.body ? (
                  <Text style={styles.rowDesc} numberOfLines={2}>{n.body}</Text>
                ) : null}
              </View>

              {!n.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  backBtn:  { marginRight: 4 },
  backIcon: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textDark, flex: 1 },
  badge:     { backgroundColor: Colors.critical, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  markAllBtn:  { paddingVertical: 6, paddingHorizontal: 4 },
  markAllText: { fontSize: 13, color: Colors.blue, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 14, paddingRight: 16,
  },
  rowUnread: { backgroundColor: '#F0F5FF' },
  stripe:    { width: 4, alignSelf: 'stretch', marginRight: 12, borderRadius: 2 },
  rowIcon:   { fontSize: 22, marginRight: 12 },
  rowBody:   { flex: 1 },
  rowTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  rowTitle:      { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textMid },
  rowTitleUnread:{ fontWeight: '700', color: Colors.textDark },
  rowAge:    { fontSize: 11, color: Colors.textLight, marginLeft: 8 },
  rowDesc:   { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.blue, marginLeft: 10,
  },
});
