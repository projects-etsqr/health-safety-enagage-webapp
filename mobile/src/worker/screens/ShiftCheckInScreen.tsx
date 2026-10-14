import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { FormSection } from '../components/layout/FormSection';
import { Icon } from '../components/display/Icon';
import { Colors } from '../theme/colors';
import { shiftService, ShiftRecord, ShiftType } from '../services/shiftService';
import { lookupService, WorkingStation } from '../services/lookupService';

const SHIFT_TYPES: ShiftType[] = ['Morning', 'Afternoon', 'Night'];

/** Default clock windows per shift, so the common case is one tap. */
const SHIFT_WINDOWS: Record<ShiftType, { start: string; end: string; hours: string }> = {
  Morning:   { start: '06:00', end: '14:00', hours: '8' },
  Afternoon: { start: '14:00', end: '22:00', hours: '8' },
  Night:     { start: '22:00', end: '06:00', hours: '8' },
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function ShiftCheckInScreen({ navigation }: any) {
  const [shiftDate, setShiftDate] = useState(todayISO());
  const [shiftType, setShiftType] = useState<ShiftType>('Morning');
  const [shiftStart, setShiftStart] = useState(SHIFT_WINDOWS.Morning.start);
  const [shiftEnd, setShiftEnd] = useState(SHIFT_WINDOWS.Morning.end);
  const [hours, setHours] = useState(SHIFT_WINDOWS.Morning.hours);

  const [stations, setStations] = useState<WorkingStation[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);

  const [recent, setRecent] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadShifts = useCallback(() => {
    setLoading(true);
    shiftService.myShifts()
      .then(setRecent)
      .catch(() => setRecent([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadShifts();
    lookupService.workingStations()
      .then(rows => {
        setStations(rows);
        setStationId(prev => prev ?? rows[0]?.id ?? null);
      })
      .catch(() => setStations([]));
  }, [loadShifts]);

  const pickShiftType = (t: ShiftType) => {
    setShiftType(t);
    setShiftStart(SHIFT_WINDOWS[t].start);
    setShiftEnd(SHIFT_WINDOWS[t].end);
    setHours(SHIFT_WINDOWS[t].hours);
  };

  const handleSubmit = async () => {
    const parsedHours = Number(hours);
    if (!hours || isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      Alert.alert('Required', 'Enter the hours you actually worked (between 0 and 24).');
      return;
    }

    setSubmitting(true);
    try {
      await shiftService.checkIn({
        shift_date: shiftDate,
        shift_type: shiftType,
        shift_start: shiftStart || undefined,
        shift_end: shiftEnd || undefined,
        actual_hours_worked: parsedHours,
        station_id: stationId ?? undefined,
      });
      Alert.alert('Shift Logged', `${parsedHours} hours recorded for ${shiftDate}.`);
      loadShifts();
    } catch (err: any) {
      Alert.alert(
        'Check-In Failed',
        err?.response?.data?.detail || 'Could not log your shift. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalHours = recent.reduce((sum, r) => sum + (r.actual_hours_worked ?? 0), 0);

  return (
    <ScreenLayout bg="#F8FAFC">
      <AppHeader title="Shift Check-In" onBack={() => navigation.goBack()} light />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadShifts} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Log the hours you actually worked. These hours are the basis for every site
          safety rate, so please record them at the end of each shift.
        </Text>

        <FormSection label="SHIFT DATE" required>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={shiftDate}
              onChangeText={setShiftDate}
            />
          </View>
        </FormSection>

        <FormSection label="SHIFT TYPE">
          <View style={styles.chipRow}>
            {SHIFT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, shiftType === t && styles.chipActive]}
                onPress={() => pickShiftType(t)}
              >
                <Text style={[styles.chipText, shiftType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FormSection>

        <View style={styles.timeRow}>
          <FormSection label="START" style={styles.timeField}>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="HH:MM"
                placeholderTextColor="#94A3B8"
                value={shiftStart}
                onChangeText={setShiftStart}
              />
            </View>
          </FormSection>
          <FormSection label="END" style={styles.timeField}>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="HH:MM"
                placeholderTextColor="#94A3B8"
                value={shiftEnd}
                onChangeText={setShiftEnd}
              />
            </View>
          </FormSection>
        </View>

        <FormSection label="ACTUAL HOURS WORKED" required>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="8"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={hours}
              onChangeText={t => setHours(t.replace(/[^0-9.]/g, ''))}
            />
          </View>
        </FormSection>

        <FormSection label="WORKING STATION">
          <View style={styles.chipWrap}>
            {stations.map(st => (
              <TouchableOpacity
                key={st.id}
                style={[styles.chip, stationId === st.id && styles.chipActive]}
                onPress={() => setStationId(st.id)}
              >
                <Text style={[styles.chipText, stationId === st.id && styles.chipTextActive]}>
                  {st.station_name}
                </Text>
              </TouchableOpacity>
            ))}
            {stations.length === 0 && (
              <Text style={styles.emptyText}>No working stations configured.</Text>
            )}
          </View>
        </FormSection>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.submitText}>Log Shift Hours</Text>}
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Shifts</Text>
          <Text style={styles.recentTotal}>{totalHours.toFixed(1)} hrs logged</Text>
        </View>

        {!loading && recent.length === 0 && (
          <Text style={styles.emptyText}>No shifts logged yet.</Text>
        )}

        {recent.map(r => (
          <View key={r.id} style={styles.shiftCard}>
            <View style={styles.shiftMain}>
              <Text style={styles.shiftDate}>{r.shift_date}</Text>
              <Text style={styles.shiftMeta}>
                {r.shift_type ?? '—'}
                {r.station_name ? ` · ${r.station_name}` : ''}
              </Text>
            </View>
            <View style={styles.shiftRight}>
              <Text style={styles.shiftHours}>
                {r.actual_hours_worked != null ? `${r.actual_hours_worked}h` : '—'}
              </Text>
              {r.confirmed && (
                <View style={styles.confirmedRow}>
                  <Icon name="check-circle" size={11} color="#16A34A" />
                  <Text style={styles.confirmedText}>Confirmed</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 16 },
  intro: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 20,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 14, color: '#0F172A' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  chipTextActive: { color: '#FFFFFF' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  recentTotal: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
  },
  shiftMain: { flex: 1 },
  shiftDate: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  shiftMeta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  shiftRight: { alignItems: 'flex-end' },
  shiftHours: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  confirmedText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
});
