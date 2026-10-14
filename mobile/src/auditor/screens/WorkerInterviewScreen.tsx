/**
 * Step 06 · worker interview, captured as evidence against a checklist line.
 *
 * "Interviewed directly. Asked to explain the hazards of their task, demonstrate
 * the procedure, and show their competence card. What the worker actually does
 * is the evidence — not what the procedure says."
 *
 * So this records what the worker did, not whether a procedure exists. The three
 * prompts are the spec's three, offered as presets because an auditor mid-walk
 * should be picking a prompt, not composing one. The competence card check is a
 * separate answer: an expired safety-critical qualification is a finding in its
 * own right under WF-07, whatever the worker said.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auditService, ChecklistItem } from '../services/auditService';
import { useGeoTag } from '../../worker/hooks/useGeoTag';
import { Banner, C, Card, PrimaryButton, ScreenHeader, SectionLabel } from '../components';

const PROMPTS = [
  { key: 'hazards', label: 'Explain the hazards of this task', icon: 'warning' },
  { key: 'procedure', label: 'Demonstrate the procedure', icon: 'play-circle' },
  { key: 'competence', label: 'Show your competence card', icon: 'card' },
  { key: 'permit', label: 'Show the permit covering this work', icon: 'document-text' },
  { key: 'ppe', label: 'Show PPE condition and training record', icon: 'shield' },
];

export function WorkerInterviewScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId;
  const item: ChecklistItem | undefined = route.params?.item;

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState<string>(PROMPTS[0].label);
  const [answer, setAnswer] = useState('');
  const [competence, setCompetence] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const { geo } = useGeoTag();

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Who was interviewed?', 'The answer is recorded against the person who gave it.');
      return;
    }
    if (!answer.trim()) {
      Alert.alert('What did they actually do?', 'Record what you observed, not whether a procedure exists.');
      return;
    }
    setBusy(true);
    try {
      const res = await auditService.addEvidence(auditId, {
        checklist_item_id: item?.id,
        kind: 'interview',
        subject_name: name.trim(),
        interview_prompt: prompt,
        caption: answer.trim(),
        competence_verified: competence ?? undefined,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
        captured_at: new Date().toISOString(),
      });
      if (res.queued) {
        Alert.alert('Saved offline', 'The interview will sync when you have signal.');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Worker interview"
        subtitle={item ? item.title : 'Step 06 · evidence'}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Banner
            tone="info" icon="chatbubbles"
            title="What the worker does is the evidence"
            text="Not what the procedure says. Record the demonstration, not the existence of a document."
          />

          <SectionLabel>Who was interviewed</SectionLabel>
          <TextInput
            style={styles.input}
            value={name} onChangeText={setName}
            placeholder="Name, and their role on this task"
            placeholderTextColor={C.light}
          />

          <SectionLabel>What they were asked to do</SectionLabel>
          <View style={styles.prompts}>
            {PROMPTS.map((p) => {
              const on = prompt === p.label;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.prompt, on && styles.promptOn]}
                  onPress={() => setPrompt(p.label)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={p.icon as any} size={15} color={on ? C.brand : C.muted} />
                  <Text style={[styles.promptText, on && { color: C.brand }]}>{p.label}</Text>
                  {on && <Ionicons name="checkmark-circle" size={15} color={C.brand} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <SectionLabel>What actually happened</SectionLabel>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={answer} onChangeText={setAnswer}
            multiline
            placeholder="e.g. Named exit 3 — the blocked one. Could not name the alternate route."
            placeholderTextColor={C.light}
          />
          <Text style={styles.hint}>
            Use your keyboard's dictation key — hands are often gloved or occupied.
          </Text>

          <SectionLabel>Competence card</SectionLabel>
          <Card>
            <Text style={styles.cardNote}>
              Checked against the competence matrix. An expired safety-critical qualification is a
              finding under WF-07 whatever the worker demonstrated.
            </Text>
            <View style={styles.yesNo}>
              {[
                { v: true, label: 'Valid', icon: 'checkmark-circle', color: '#047857', bg: '#D1FAE5' },
                { v: false, label: 'Expired or missing', icon: 'close-circle', color: '#B91C1C', bg: '#FEE2E2' },
                { v: null, label: 'Not checked', icon: 'remove-circle', color: C.muted, bg: '#F1F5F9' },
              ].map((o) => {
                const on = competence === o.v;
                return (
                  <TouchableOpacity
                    key={String(o.v)}
                    style={[styles.yesNoBtn, on && { backgroundColor: o.bg, borderColor: o.color }]}
                    onPress={() => setCompetence(o.v as boolean | null)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={o.icon as any} size={16} color={on ? o.color : C.light} />
                    <Text style={[styles.yesNoText, on && { color: o.color }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {competence === false && (
              <Text style={styles.warn}>
                Any permit naming this worker is hard-blocked by the gate engine. This is a finding,
                not a warning.
              </Text>
            )}
          </Card>

          {geo.gps_latitude != null && (
            <View style={styles.gpsRow}>
              <Ionicons name="location" size={12} color="#047857" />
              <Text style={styles.gpsText}>
                Stamped at {geo.gps_latitude.toFixed(4)}, {geo.gps_longitude?.toFixed(4)}
              </Text>
            </View>
          )}

          <PrimaryButton label="Attach interview" icon="save" onPress={save} loading={busy} />
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
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink, fontWeight: '600',
  },
  multiline: { minHeight: 92, textAlignVertical: 'top', lineHeight: 19 },
  hint: { fontSize: 10.5, color: C.light, fontWeight: '600', marginTop: 6 },
  prompts: { gap: 7 },
  prompt: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 12,
  },
  promptOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  promptText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: C.mid },
  cardNote: { fontSize: 11.5, color: C.muted, fontWeight: '600', lineHeight: 16, marginBottom: 11 },
  yesNo: { gap: 7 },
  yesNoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#FFFFFF',
  },
  yesNoText: { fontSize: 12.5, fontWeight: '700', color: C.mid },
  warn: { fontSize: 11, color: '#B91C1C', fontWeight: '700', lineHeight: 15.5, marginTop: 10 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, marginBottom: 14 },
  gpsText: { fontSize: 10.5, fontWeight: '600', color: C.muted },
});

export default WorkerInterviewScreen;
