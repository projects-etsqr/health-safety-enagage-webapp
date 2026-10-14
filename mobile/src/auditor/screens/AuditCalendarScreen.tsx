import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auditService, Audit } from '../services/auditService';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function auditDate(a: Audit): Date | null {
  const raw = a.due_date || a.scheduled_date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function AuditCalendarScreen({ navigation }: any) {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setAudits(await auditService.listAssigned()); }
    catch { /* keep */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  // Map audits to the day they fall on.
  const byDay = useMemo(() => {
    const m: Record<string, Audit[]> = {};
    for (const a of audits) {
      const d = auditDate(a);
      if (!d) continue;
      (m[dayKey(d)] ||= []).push(a);
    }
    return m;
  }, [audits]);

  // Build a 6x7 grid for the displayed month.
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; currentMonth: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: new Date(year, month, i - firstWeekday + 1), currentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), currentMonth: true });
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month, daysInMonth + (cells.length % 7)), currentMonth: false });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dotColor = (list: Audit[]): string | null => {
    if (!list.length) return null;
    if (list.some((a) => a.status === 'overdue')) return '#EF4444';
    if (list.some((a) => a.status === 'completed')) return '#8B5CF6';
    return '#3B82F6';
  };

  const selectedList = byDay[dayKey(selectedDate)] || [];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ehsera</Text>
        <TouchableOpacity style={styles.bellBtn}><Ionicons name="notifications-outline" size={22} color="#0F172A" /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Audit Calendar</Text>
          <Text style={styles.subtitle}>Schedule and monitor safety inspections</Text>
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          <View style={styles.calHeader}>
            <View style={styles.calMonthRow}>
              <Text style={styles.calMonthText}>{MONTHS[month]} {year}</Text>
              <View style={styles.calNavRow}>
                <TouchableOpacity onPress={() => setMonthDate(new Date(year, month - 1, 1))}><Ionicons name="chevron-back" size={18} color="#0F172A" /></TouchableOpacity>
                <TouchableOpacity onPress={() => setMonthDate(new Date(year, month + 1, 1))}><Ionicons name="chevron-forward" size={18} color="#0F172A" /></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.todayBtn} onPress={() => { setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}>
              <Ionicons name="calendar-outline" size={14} color="#2563EB" />
              <Text style={styles.todayText}>Today</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => <Text key={idx} style={styles.weekDayText}>{d}</Text>)}
          </View>

          <View style={styles.calendarGrid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.gridWeekRow}>
                {week.map((cell, ci) => {
                  const isSel = cell.currentMonth && sameDay(cell.date, selectedDate);
                  const isToday = cell.currentMonth && sameDay(cell.date, today);
                  const dot = cell.currentMonth ? dotColor(byDay[dayKey(cell.date)] || []) : null;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[styles.gridCell, isSel && styles.gridCellActive, !isSel && isToday && styles.gridCellToday]}
                      onPress={() => cell.currentMonth && setSelectedDate(cell.date)}
                      disabled={!cell.currentMonth}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cellText, !cell.currentMonth && styles.cellTextShaded, isSel && styles.cellTextActive]}>
                        {cell.date.getDate()}
                      </Text>
                      {dot && !isSel && <View style={[styles.dotIndicator, { backgroundColor: dot }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} /><Text style={styles.legendText}>Scheduled</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} /><Text style={styles.legendText}>Completed</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>Overdue</Text></View>
          </View>
        </View>

        {/* Scheduled Audits for the selected day */}
        <View style={styles.scheduledHeader}>
          <Text style={styles.scheduledTitle}>Audits</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{MONTHS[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}, {selectedDate.getFullYear()}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
        ) : selectedList.length === 0 ? (
          <Text style={styles.empty}>No audits scheduled on this day.</Text>
        ) : (
          <View style={styles.scheduledList}>
            {selectedList.map((a) => {
              const d = auditDate(a);
              const color = a.status === 'overdue' ? '#EF4444' : a.status === 'completed' ? '#8B5CF6' : '#3B82F6';
              return (
                <TouchableOpacity key={a.id} style={[styles.auditCard, { borderLeftColor: color }]}
                  onPress={() => navigation.navigate('AuditDetail', { audit: a })} activeOpacity={0.85}>
                  <View style={styles.auditHeader}>
                    <Text style={styles.auditTitleText}>{a.title}</Text>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#64748B" />
                    <Text style={styles.locationText}>{a.site_name || '—'} · {a.checklist_type || 'Audit'}</Text>
                  </View>
                  <View style={styles.auditFooter}>
                    <Text style={styles.deptText}>{a.department || ''}</Text>
                    <View style={styles.statusBox}>
                      <Ionicons name={a.status === 'completed' ? 'checkmark-circle' : a.status === 'overdue' ? 'alert-circle' : 'calendar-outline'} size={12} color={color} />
                      <Text style={[styles.statusValText, { color }]}>{a.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  bellBtn: { padding: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  titleSection: { marginTop: 16, marginBottom: 14 },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 4 },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 16, marginBottom: 20 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 },
  calMonthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calMonthText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  calNavRow: { flexDirection: 'row', gap: 10 },
  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  todayText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekDayText: { width: 40, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#94A3B8' },
  calendarGrid: { gap: 6, marginBottom: 14 },
  gridWeekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gridCell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  gridCellActive: { backgroundColor: '#2563EB' },
  gridCellToday: { borderWidth: 1.5, borderColor: '#BFDBFE' },
  cellText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  cellTextShaded: { color: '#CBD5E1' },
  cellTextActive: { color: '#FFFFFF' },
  dotIndicator: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  scheduledHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  scheduledTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  dateBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  dateBadgeText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  empty: { textAlign: 'center', color: '#94A3B8', fontWeight: '600', paddingVertical: 24 },
  scheduledList: { gap: 12, marginBottom: 20 },
  auditCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14, borderLeftWidth: 5 },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  auditTitleText: { fontSize: 14, fontWeight: '800', color: '#1E293B', flex: 1 },
  timeBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  timeBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  locationText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  auditFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  deptText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusValText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
