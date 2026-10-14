import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Icon } from '../display/Icon';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, … 55

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Value shape the permit API expects: "YYYY-MM-DD HH:MM". */
const toValue = (y: number, m: number, d: number, hh: number, mm: number) =>
  `${y}-${pad(m + 1)}-${pad(d)} ${pad(hh)}:${pad(mm)}`;

interface DateTimePickerModalProps {
  visible: boolean;
  /** Current value as "YYYY-MM-DD HH:MM", or null/'' when unset. */
  value?: string | null;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  title?: string;
  /** Disallow dates before today (default true — you can't schedule in the past). */
  minToday?: boolean;
  /** How many years into the future to offer. Default 3. */
  futureYears?: number;
  /**
   * Disallow dates after today. Default false.
   *
   * Set for things that have already happened — an incident cannot occur in the
   * future, and a future date there would corrupt both the investigation SLA
   * and the statutory notification clock, which count from the event time.
   */
  maxToday?: boolean;
  /** How many years into the past to offer. Default 0 (today onwards only). */
  pastYears?: number;
}

type Step = 'year' | 'month' | 'day' | 'time';

/**
 * Pure-JS date + time picker — no native module, so it needs no rebuild and
 * behaves identically on both platforms. Drills year → month → day → time.
 * Unlike DatePickerModal (birthdates), this allows FUTURE dates for scheduling.
 */
export function DateTimePickerModal({
  visible, value, onCancel, onConfirm, title = 'Select date & time',
  minToday = true, futureYears = 3, maxToday = false, pastYears = 0,
}: DateTimePickerModalProps) {
  const now = new Date();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const loYear = now.getFullYear() - pastYears;
  const hiYear = now.getFullYear() + (maxToday ? 0 : futureYears);

  const parsed = useMemo(() => {
    if (value) {
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
      if (m) {
        const [, y, mo, d, hh, mm] = m.map(Number) as unknown as number[];
        return { y, m: mo - 1, d, hh, mm };
      }
    }
    return null;
  }, [value]);

  const [step, setStep] = useState<Step>('day');
  const [year, setYear] = useState(parsed?.y ?? now.getFullYear());
  const [month, setMonth] = useState(parsed?.m ?? now.getMonth());
  const [day, setDay] = useState(parsed?.d ?? now.getDate());
  const [hour, setHour] = useState(parsed?.hh ?? now.getHours());
  const [minute, setMinute] = useState(parsed?.mm ?? 0);

  // Re-seed each time the sheet opens so a cancelled edit doesn't leak forward.
  useEffect(() => {
    if (!visible) return;
    setYear(parsed?.y ?? now.getFullYear());
    setMonth(parsed?.m ?? now.getMonth());
    setDay(parsed?.d ?? now.getDate());
    setHour(parsed?.hh ?? now.getHours());
    setMinute(parsed?.mm ?? 0);
    setStep('day');
  }, [visible, parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = loYear; y <= hiYear; y++) out.push(y);
    return out;
  }, [loYear, hiYear]);

  const grid = useMemo(() => {
    const lead = new Date(year, month, 1).getDay();
    const total = daysInMonth(year, month);
    const cells: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const isPastDay = (d: number) => minToday && new Date(year, month, d) < nowMidnight;
  const isPastMonth = (mi: number) =>
    minToday && new Date(year, mi, 1) < new Date(nowMidnight.getFullYear(), nowMidnight.getMonth(), 1);

  // Mirror images of the two above, for events that have already happened.
  const isFutureDay = (d: number) => maxToday && new Date(year, month, d) > nowMidnight;
  const isFutureMonth = (mi: number) =>
    maxToday && new Date(year, mi, 1) > new Date(nowMidnight.getFullYear(), nowMidnight.getMonth(), 1);

  /** A day the user must not pick, in either direction. */
  const isDisabledDay = (d: number) => isPastDay(d) || isFutureDay(d);
  const isDisabledMonth = (mi: number) => isPastMonth(mi) || isFutureMonth(mi);

  const confirm = () => {
    const clamped = Math.min(day, daysInMonth(year, month));
    onConfirm(toValue(year, month, clamped, hour, minute));
  };

  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb — tap any level to jump back to it */}
          <View style={styles.crumbRow}>
            <TouchableOpacity style={[styles.crumb, step === 'year' && styles.crumbActive]} onPress={() => setStep('year')}>
              <Text style={[styles.crumbText, step === 'year' && styles.crumbTextActive]}>{year}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.crumb, step === 'month' && styles.crumbActive]} onPress={() => setStep('month')}>
              <Text style={[styles.crumbText, step === 'month' && styles.crumbTextActive]}>{MONTHS_SHORT[month]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.crumb, step === 'day' && styles.crumbActive]} onPress={() => setStep('day')}>
              <Text style={[styles.crumbText, step === 'day' && styles.crumbTextActive]}>{day}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.crumb, step === 'time' && styles.crumbActive]} onPress={() => setStep('time')}>
              <Text style={[styles.crumbText, step === 'time' && styles.crumbTextActive]}>{pad(h12)}:{pad(minute)} {ampm}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {step === 'year' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.yearGrid}>
                  {years.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearCell, y === year && styles.cellSelected]}
                      onPress={() => { setYear(y); setStep('month'); }}
                    >
                      <Text style={[styles.yearText, y === year && styles.cellTextSelected]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {step === 'month' && (
              <View style={styles.monthGrid}>
                {MONTHS.map((m, i) => {
                  const disabled = isDisabledMonth(i);
                  return (
                    <TouchableOpacity
                      key={m}
                      disabled={disabled}
                      style={[styles.monthCell, i === month && styles.cellSelected, disabled && styles.cellDisabled]}
                      onPress={() => { setMonth(i); setStep('day'); }}
                    >
                      <Text style={[styles.monthText, i === month && styles.cellTextSelected, disabled && styles.cellTextDisabled]}>
                        {MONTHS_SHORT[i]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 'day' && (
              <>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((w, i) => (
                    <Text key={i} style={styles.weekLabel}>{w}</Text>
                  ))}
                </View>
                <View style={styles.dayGrid}>
                  {grid.map((d, i) => {
                    if (d === null) return <View key={`b${i}`} style={styles.dayCell} />;
                    const disabled = isDisabledDay(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        disabled={disabled}
                        style={[styles.dayCell, d === day && styles.cellSelected]}
                        onPress={() => { setDay(d); setStep('time'); }}
                      >
                        <Text style={[styles.dayText, d === day && styles.cellTextSelected, disabled && styles.cellTextDisabled]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {step === 'time' && (
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeColLabel}>Hour</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.timeScroll}>
                    {HOURS.map(h => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.timeCell, h === hour && styles.cellSelected]}
                        onPress={() => setHour(h)}
                      >
                        <Text style={[styles.timeText, h === hour && styles.cellTextSelected]}>
                          {pad(((h + 11) % 12) + 1)} {h < 12 ? 'AM' : 'PM'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.timeColLabel}>Minute</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.timeScroll}>
                    {MINUTES.map(mm => (
                      <TouchableOpacity
                        key={mm}
                        style={[styles.timeCell, mm === minute && styles.cellSelected]}
                        onPress={() => setMinute(mm)}
                      >
                        <Text style={[styles.timeText, mm === minute && styles.cellTextSelected]}>{pad(mm)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, maxHeight: '78%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  crumbRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  crumb: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  crumbActive: { backgroundColor: '#DBEAFE', borderColor: '#93B4F5' },
  crumbText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  crumbTextActive: { color: '#1D4ED8' },
  body: { minHeight: 240, maxHeight: 300 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearCell: { width: '22.5%', paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#F8FAFC' },
  yearText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: { width: '30%', paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#F8FAFC' },
  monthText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94A3B8' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
  timeColLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', textAlign: 'center', marginBottom: 6 },
  timeScroll: { maxHeight: 250 },
  timeCell: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#F8FAFC', marginBottom: 6 },
  timeText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  cellSelected: { backgroundColor: '#2563EB' },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  cellDisabled: { opacity: 0.4 },
  cellTextDisabled: { color: '#CBD5E1' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB' },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
