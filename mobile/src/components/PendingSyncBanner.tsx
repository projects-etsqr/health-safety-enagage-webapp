/**
 * "Waiting to send" banner + the app-wide flush trigger.
 *
 * Two jobs, deliberately together:
 *   1. Tell the worker how many reports are saved but not yet submitted. An
 *      invisible queue is worse than no queue — people re-file things they
 *      think were lost, or assume something landed when it did not.
 *   2. Replay the queue when the app comes back to the foreground, which on a
 *      phone is the moment signal usually returns.
 *
 * Tapping the banner forces a retry, because a worker who has just walked back
 * into range should not have to wait for the next foreground event.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import { flush, readQueue, subscribe, type QueuedRequest } from '../services/offlineQueue';

export function PendingSyncBanner() {
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    readQueue().then(setQueue).catch(() => setQueue([]));
  }, []);

  const runFlush = useCallback(() => {
    setSyncing(true);
    flush()
      .then(refresh)
      .catch(refresh)
      .finally(() => setSyncing(false));
  }, [refresh]);

  useEffect(() => {
    refresh();
    const unsub = subscribe(setQueue);

    // Coming back to the foreground is the usual moment signal returns.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') runFlush();
    });

    // One attempt on mount so a queue left over from a previous session drains
    // without the app having to be backgrounded first.
    runFlush();

    return () => {
      unsub();
      sub.remove();
    };
  }, [refresh, runFlush]);

  if (queue.length === 0) return null;

  const rejected = queue.filter(q => q.attempts > 0);

  return (
    <TouchableOpacity style={styles.banner} onPress={runFlush} activeOpacity={0.85} disabled={syncing}>
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {queue.length} report{queue.length === 1 ? '' : 's'} waiting to send
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {rejected.length > 0
            ? `${rejected.length} rejected by the server — tap to retry`
            : queue.map(q => q.label).slice(0, 2).join(' · ')}
        </Text>
      </View>
      {syncing ? <ActivityIndicator color="#92400E" size="small" /> : <Text style={styles.retry}>Retry</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  title: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  sub: { fontSize: 11, color: '#B45309', marginTop: 1 },
  retry: { fontSize: 12, fontWeight: '700', color: '#92400E' },
});
