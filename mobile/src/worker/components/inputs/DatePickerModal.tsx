import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface DatePickerModalProps {
  visible: boolean;
  /** Current value as YYYY-MM-DD, or null/'' when unset. */
  value?: string | null;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
  title?: string;
  /** Earliest selectable year. Defaults to 100 years ago. */
  minYear?: number;
  /** Latest selectable year. Defaults to the current year. */
  maxYear?: number;
}

type Step = 'year' | 'month' | 'day';

/**
 * Pure-JS date picker — no native module, so it needs no rebuild and behaves
 * identically on both platforms. Drills year → month → day, because paging a
 * calendar month-by-month is unusable for dates decades in the past.
 */
export function DatePickerModal({
  visible, value, onCancel, onConfirm, title = 'Select date', minYear, maxYear,
}: DatePickerModalProps) {
  const now = new Date();
  const hiYear = maxYear ?? now.getFullYear();
  const loYear = minYear ?? hiYear - 100;

  const parsed = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
        return { y, m: m - 1, d };
      }
    }
    return null;
  }, [value]);

  const [step, setStep] = useState<Step>('year');
  const [year, setYear] = useState(parsed?.y ?? hiYear - 30);
  const [month, setMonth] = useState(parsed?.m ?? 0);
  const [day, setDay] = useState(parsed?.d ?? 1);
  const yearScroll = useRef<ScrollView>(null);

  // Re-seed each time the sheet opens so a cancelled edit doesn't leak forward.
  useEffect(() => {
    if (!visible) return;
    setYear(parsed?.y ?? hiYear - 30);
    setMonth(parsed?.m ?? 0);
    setDay(parsed?.d ?? 1);
    setStep(parsed ? 'day' : 'year');
  }, [visible, parsed, hiYear]);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = hiYear; y >= loYear; y--) out.push(y);
    return out;
  }, [hiYear, loYear]);

  const grid = useMemo(() => {
    const lead = new Date(year, month, 1).getDay();
    const total = daysInMonth(year, month);
    const cells: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const isFuture = (d: number) => new Date(year, month, d) > now;

  const confirm = () => {
    const clamped = Math.min(day, daysInMonth(year, month));
    onConfirm(toIso(year, month, clamped));
  };

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
          </View>

          <View style={styles.body}>
            {step === 'year' && (
              <ScrollView ref={yearScroll} showsVerticalScrollIndicator={false}>
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
                  const disabled = new Date(year, i, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
                  return (
                    <TouchableOpacity
                      key={m}
                      disabled={disabled}
                      style={[styles.monthCell, i === month && styles.cellSelected, disabled && styles.cellDisabled]}
                      onPress={() => { setMonth(i); setStep('day'); }}
                    >
                      <Text
                        style={[
                          styles.monthText,
                          i === month && styles.cellTextSelected,
                          disabled && styles.cellTextDisabled,
                        ]}
                      >
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
                    const disabled = isFuture(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        disabled={disabled}
                        style={[styles.dayCell, d === day && styles.cellSelected]}
                        onPress={() => setDay(d)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            d === day && styles.cellTextSelected,
                            disabled && styles.cellTextDisabled,
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    maxHeight: '78%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  crumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  crumb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  crumbActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93B4F5',
  },
  crumbText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  crumbTextActive: {
    color: '#1D4ED8',
  },
  body: {
    minHeight: 240,
    maxHeight: 300,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearCell: {
    width: '22.5%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  yearText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthCell: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  monthText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  cellSelected: {
    backgroundColor: '#2563EB',
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cellDisabled: {
    opacity: 0.4,
  },
  cellTextDisabled: {
    color: '#CBD5E1',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
