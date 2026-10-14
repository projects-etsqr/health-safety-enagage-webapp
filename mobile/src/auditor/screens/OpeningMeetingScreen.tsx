/**
 * Step 04 CONDUCT · the opening meeting.
 *
 * "Scope, attendees and sampling approach captured as a structured record on the
 * spot." Three separate required fields rather than one notes box, because the
 * point of the meeting is that there is no dispute afterwards about what was in
 * or out of scope — and free text does not settle that argument.
 *
 * The supervisor attends: scope and approach are agreed jointly. Their absence
 * does not block the audit, but it is recorded, because "agreed jointly" is a
 * claim the report makes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auditService, Audit } from '../services/auditService';
import { useGeoTag } from '../../worker/hooks/useGeoTag';
import {
  Banner, C, Card, PrimaryButton, ScreenHeader, SectionLabel,
} from '../components';

export function OpeningMeetingScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [scope, setScope] = useState('');
  const [method, setMethod] = useState('Physical walk, worker interview, record sampling');
  const [sampling, setSampling] = useState('');
  const [attendee, setAttendee] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [auditeePresent, setAuditeePresent] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const { geo, isLocating } = useGeoTag();

  const load = useCallback(async () => {
    try {
      const a = await auditService.get(auditId);
      setAudit(a);
      if (a.opening_meeting) {
        setScope(a.opening_meeting.scope ?? '');
        setMethod(a.opening_meeting.method ?? '');
        setSampling(a.opening_meeting.sampling_approach ?? '');
        setAttendees(a.opening_meeting.attendees ?? []);
      }
      // Pre-seed the scope from the audit's own subject so the auditor edits a
      // sentence rather than facing an empty box in front of the site manager.
      if (!a.opening_meeting) {
        setScope(`${a.checklist_type || 'Audit'} of ${a.department || a.site_name || 'the site'}.`);
      }
    } catch { /* keep whatever the route gave us */ }
  }, [auditId]);

  useEffect(() => { load(); }, [load]);

  const addAttendee = () => {
    const v = attendee.trim();
    if (!v) return;
    setAttendees((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setAttendee('');
  };

  const held = !!audit?.opening_meeting_at;

  const submit = async () => {
    if (!scope.trim() || !method.trim() || !sampling.trim()) {
      Alert.alert(
        'Three things are required',
        'Scope, method and sampling approach. These are what stop a dispute later about what the audit covered.',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await auditService.openingMeeting(auditId, {
        scope: scope.trim(),
        method: method.trim(),
        sampling_approach: sampling.trim(),
        attendees,
        auditee_present: auditeePresent,
        notes: notes.trim() || undefined,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
      });
      if (res.queued) {
        Alert.alert('Saved offline', 'The opening meeting record will sync when you have signal.');
      }
      navigation.replace('AuditChecklist', { auditId, audit: res.data ?? audit });
    } catch (e: any) {
      Alert.alert('Could not record the meeting', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Opening meeting"
        subtitle={`Step 04 · ${audit?.audit_ref ?? ''}`}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_BEHAVIOR}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {held ? (
            <Banner
              tone="ok"
              title="Opening meeting already recorded"
              text="Scope is agreed and locked into the record. Carry on with the walk."
            />
          ) : (
            <Banner
              tone="info"
              icon="people"
              title="Agree the scope jointly, here and now"
              text="The supervisor attends so there is no dispute later about what was in or out of scope."
            />
          )}

          <SectionLabel>Scope — what is in, and what is out</SectionLabel>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={scope} onChangeText={setScope}
            editable={!held}
            multiline
            placeholder="e.g. Assembly hall fire detection, egress and extinguishers. Paint shop out of scope."
            placeholderTextColor={C.light}
          />

          <SectionLabel>Method — how the audit will be conducted</SectionLabel>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={method} onChangeText={setMethod}
            editable={!held}
            multiline
            placeholder="e.g. Physical walk, worker interview, record sampling"
            placeholderTextColor={C.light}
          />

          <SectionLabel>Sampling approach — what will be sampled, and how much</SectionLabel>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={sampling} onChangeText={setSampling}
            editable={!held}
            multiline
            placeholder="e.g. All 12 extinguishers; 3 of 9 exit routes at random; 5 worker interviews"
            placeholderTextColor={C.light}
          />

          <SectionLabel>Attendees</SectionLabel>
          <Card>
            {!held && (
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={attendee} onChangeText={setAttendee}
                  onSubmitEditing={addAttendee}
                  returnKeyType="done"
                  placeholder="Name and role"
                  placeholderTextColor={C.light}
                />
                <TouchableOpacity style={styles.addBtn} onPress={addAttendee}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
            {attendees.length ? (
              <View style={styles.pills}>
                {attendees.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={styles.pill}
                    onPress={() => !held && setAttendees((p) => p.filter((x) => x !== a))}
                  >
                    <Text style={styles.pillText}>{a}</Text>
                    {!held && <Ionicons name="close" size={12} color={C.mid} />}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Nobody added yet.</Text>
            )}

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => !held && setAuditeePresent((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.check, auditeePresent && styles.checkOn]}>
                {auditeePresent && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkText}>
                The supervisor of the area is present
              </Text>
            </TouchableOpacity>
            {!auditeePresent && (
              <Text style={styles.warnNote}>
                Recorded. The audit is not blocked, but the report cannot claim the scope was agreed jointly.
              </Text>
            )}
          </Card>

          <SectionLabel>Notes (optional)</SectionLabel>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes} onChangeText={setNotes}
            editable={!held}
            multiline
            placeholder="Logistics, access constraints, anything agreed on the spot"
            placeholderTextColor={C.light}
          />

          <View style={styles.gpsRow}>
            <Ionicons name="location" size={13} color={geo.gps_latitude ? '#047857' : C.light} />
            <Text style={styles.gpsText}>
              {isLocating
                ? 'Getting a GPS fix…'
                : geo.gps_latitude
                  ? `Stamped at ${geo.gps_latitude.toFixed(4)}, ${geo.gps_longitude?.toFixed(4)}`
                  : 'No GPS fix — the meeting is still recorded'}
            </Text>
          </View>

          {held ? (
            <PrimaryButton
              label="Continue to the walk"
              icon="walk"
              onPress={() => navigation.replace('AuditChecklist', { auditId, audit })}
            />
          ) : (
            <PrimaryButton
              label="Record meeting & start the walk"
              icon="play"
              onPress={submit}
              loading={busy}
            />
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 20 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink,
    fontWeight: '600', marginBottom: 12,
  },
  multiline: { minHeight: 68, textAlignVertical: 'top', lineHeight: 19 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  addBtn: {
    width: 42, height: 42, borderRadius: 11, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F1F5F9',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
  },
  pillText: { fontSize: 11.5, fontWeight: '700', color: C.mid },
  hint: { fontSize: 11.5, color: C.light, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: C.ink },
  warnNote: { fontSize: 11, color: '#B45309', fontWeight: '600', marginTop: 8, lineHeight: 15 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: 2 },
  gpsText: { fontSize: 11, fontWeight: '600', color: C.muted },
});

export default OpeningMeetingScreen;
