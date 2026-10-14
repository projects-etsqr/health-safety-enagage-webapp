/**
 * WF-06 · Fatigue Declaration (AI-ISMS class C7).
 *
 * "Shift hours, consecutive days, night shifts → live F index shown before
 *  permit request. Non-medical proxies only."
 *
 * The index is recomputed locally as the worker types so they can see how each
 * factor moves it, but the value that counts is always the one the server
 * returns — the formula lives in one place and it is not this screen.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Card, PrimaryButton, ScoreTile, bandColor, HSE_COLORS } from '../../components/hseiq';
import { fatigueService, FatigueIndex } from '../../services/hseiqService';

const BAND_TEXT: Record<string, string> = {
  acceptable: 'Within acceptable limits. No action needed.',
  amber: 'Amber — your supervisor must acknowledge this before work proceeds.',
  signoff: 'Supervisor sign-off is required before any high-risk permit.',
  block: 'Hard block. 8 hours rest is required. Only a Safety Manager can authorise an exception.',
};

const INTENSITY = ['light', 'moderate', 'heavy'];

export default function FatigueDeclarationScreen({ navigation }: any) {
  const [shiftHours, setShiftHours] = useState('8');
  const [consecutiveDays, setConsecutiveDays] = useState('1');
  const [nightShifts, setNightShifts] = useState('0');
  const [intensity, setIntensity] = useState('moderate');

  const [live, setLive] = useState<FatigueIndex | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nums = useMemo(
    () => ({
      h: Math.max(0, Math.min(24, parseFloat(shiftHours) || 0)),
      d: Math.max(0, Math.min(60, parseInt(consecutiveDays, 10) || 0)),
      n: Math.max(0, Math.min(7, parseInt(nightShifts, 10) || 0)),
    }),
    [shiftHours, consecutiveDays, nightShifts],
  );

  // Ask the server for the banded index — the formula is authoritative there,
  // and a debounce keeps this to one call per pause in typing.
  useEffect(() => {
    const t = setTimeout(() => {
      fatigueService
        .index(nums.h, nums.d, nums.n)
        .then(setLive)
        .catch(() => setLive(null));
    }, 350);
    return () => clearTimeout(t);
  }, [nums]);

  const submit = useCallback(() => {
    setSubmitting(true);
    fatigueService
      .declare({
        shift_hours: nums.h,
        consecutive_days: nums.d,
        night_shifts_7d: nums.n,
        task_intensity: intensity,
      })
      .then(res => {
        const msg =
          res.band === 'block'
            ? 'Declared. You are over the fatigue limit — do not start high-risk work. Your Safety Manager has to authorise any exception.'
            : res.band === 'signoff'
            ? 'Declared. Your supervisor must sign this off before a high-risk permit.'
            : res.band === 'amber'
            ? 'Declared. Your supervisor will be asked to acknowledge it.'
            : 'Declared. You are within acceptable limits.';
        Alert.alert(`Fatigue index ${res.fatigue_index}`, msg, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      })
      .catch(err =>
        Alert.alert(
          'Could not declare',
          err?.response?.data?.detail ?? 'Please try again when you have signal.',
        ),
      )
      .finally(() => setSubmitting(false));
  }, [nums, intensity, navigation]);

  const band = live?.band ?? 'acceptable';

  return (
    <ScreenLayout>
      <AppHeader title="Fatigue Declaration" onBack={() => navigation.goBack()} light />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.privacy}>
          <Text style={styles.privacyText}>
            Non-medical only. This records shift pattern, not health information.
          </Text>
        </View>

        <Card title="Live fatigue index">
          <View style={{ flexDirection: 'row' }}>
            <ScoreTile
              value={live ? live.fatigue_index : '—'}
              band={band}
              label="F index"
            />
            <View style={styles.breakdown}>
              <Row label="Shift length" value={live?.shift_component} />
              <Row label="Consecutive days" value={live?.consecutive_component} />
              <Row label="Night shifts" value={live?.night_component} />
            </View>
          </View>
          <Text style={[styles.bandText, { color: bandColor(band) }]}>{BAND_TEXT[band]}</Text>
        </Card>

        <Card title="Your shift">
          <Field
            label="Hours on this shift"
            value={shiftHours}
            onChange={setShiftHours}
            hint="Anything over 8 adds to the index"
          />
          <Field
            label="Consecutive days worked"
            value={consecutiveDays}
            onChange={setConsecutiveDays}
            hint="Anything over 5 adds to the index"
          />
          <Field
            label="Night shifts in the last 7 days"
            value={nightShifts}
            onChange={setNightShifts}
            hint="Each one adds 3"
          />

          <Text style={styles.label}>Task intensity</Text>
          <View style={styles.intensityRow}>
            {INTENSITY.map(v => (
              <Text
                key={v}
                onPress={() => setIntensity(v)}
                style={[styles.intensity, intensity === v && styles.intensityActive]}
              >
                {v}
              </Text>
            ))}
          </View>
        </Card>

        <View style={{ paddingHorizontal: 16 }}>
          <PrimaryButton
            label="Declare fatigue"
            onPress={submit}
            busy={submitting}
            tone={band === 'block' ? 'danger' : 'primary'}
          />
          <Text style={styles.footNote}>
            Declaring honestly is what makes the permit gate work. An accurate high
            number protects you — a low one does not.
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.bRow}>
      <Text style={styles.bLabel}>{label}</Text>
      <Text style={styles.bValue}>+{(value ?? 0).toFixed(1)}</Text>
    </View>
  );
}

function Field({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor="#94A3B8"
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  privacy: {
    marginHorizontal: 16, marginTop: 12, padding: 10,
    backgroundColor: '#EFF6FF', borderRadius: 8,
  },
  privacyText: { fontSize: 11, color: '#1E40AF' },

  breakdown: { flex: 1.2, justifyContent: 'center', paddingLeft: 8 },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  bLabel: { fontSize: 12, color: HSE_COLORS.textMuted },
  bValue: { fontSize: 12, fontWeight: '700', color: HSE_COLORS.textDark },

  bandText: { fontSize: 12, marginTop: 10, lineHeight: 18, fontWeight: '600' },

  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: HSE_COLORS.textDark,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },

  intensityRow: { flexDirection: 'row', gap: 8 },
  intensity: {
    flex: 1, textAlign: 'center', paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#F1F5F9', color: HSE_COLORS.textMid, fontSize: 13,
    textTransform: 'capitalize', overflow: 'hidden',
  },
  intensityActive: { backgroundColor: '#2563EB', color: '#fff', fontWeight: '700' },

  footNote: {
    fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 12,
    lineHeight: 16, textAlign: 'center',
  },
});
