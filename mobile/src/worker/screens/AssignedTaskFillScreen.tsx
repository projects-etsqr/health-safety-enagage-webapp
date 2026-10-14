import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/display/Icon';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import {
  assignedTaskService, AssignedTaskDetail,
} from '../services/assignedTaskService';

type Answer = 'Yes' | 'No' | null;

const PRIORITY_COLORS: Record<string, string> = {
  low: '#2E7D32', medium: '#B7791F', high: '#C62828',
};

export default function AssignedTaskFillScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const taskId: number = route?.params?.taskId;

  const [task, setTask] = useState<AssignedTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    assignedTaskService
      .getTask(taskId)
      .then((t) => {
        setTask(t);
        // Prefill from any earlier answers.
        const a: Record<number, Answer> = {};
        const r: Record<number, string> = {};
        Object.entries(t.my_responses || {}).forEach(([itemId, v]) => {
          a[Number(itemId)] = (v.answer as Answer) ?? null;
          r[Number(itemId)] = v.description || '';
        });
        setAnswers(a);
        setRemarks(r);
      })
      .catch(() => Alert.alert('Error', 'Could not load this task.'))
      .finally(() => setLoading(false));
  }, [taskId]);

  const setAnswer = (itemId: number, val: Answer) =>
    setAnswers((prev) => ({ ...prev, [itemId]: val }));
  const setRemark = (itemId: number, text: string) =>
    setRemarks((prev) => ({ ...prev, [itemId]: text }));

  const submit = async () => {
    if (!task) return;
    const missing = task.items.filter((it) => it.is_required && !answers[it.id]);
    if (missing.length > 0) {
      Alert.alert('Incomplete', `Please answer all required items (${missing.length} remaining).`);
      return;
    }
    try {
      setSubmitting(true);
      await assignedTaskService.fill(
        task.id,
        task.items.map((it) => ({
          item_id: it.id,
          answer: answers[it.id] ?? null,
          description: remarks[it.id] || '',
        })),
      );
      Alert.alert('Submitted', 'Your checklist has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout bg="#F8FAFC">
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </ScreenLayout>
    );
  }
  if (!task) {
    return (
      <ScreenLayout bg="#F8FAFC">
        <Text style={{ textAlign: 'center', marginTop: 60, color: '#64748B' }}>Task not found.</Text>
      </ScreenLayout>
    );
  }

  const pColor = PRIORITY_COLORS[task.priority] || '#64748B';

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Task Checklist</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Keyboard avoidance is ScreenLayout's job now — see KeyboardAvoider. */}
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Task summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: pColor + '22' }]}>
                <Text style={[styles.priorityText, { color: pColor }]}>{task.priority.toUpperCase()}</Text>
              </View>
            </View>
            {!!task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
            <View style={styles.metaRow}>
              <Icon name="user" size={13} color="#64748B" />
              <Text style={styles.metaText}>Assigned by {task.assigned_by_name}</Text>
            </View>
            {!!task.location && (
              <View style={styles.metaRow}>
                <Icon name="map-pin" size={13} color="#64748B" />
                <Text style={styles.metaText}>{task.location}</Text>
              </View>
            )}
            {task.my_status === 'filled' && (
              <View style={styles.filledBadge}>
                <Icon name="check-circle" size={13} color="#2E7D32" />
                <Text style={styles.filledText}>Already submitted — you can update and resubmit.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Checklist</Text>

          {task.items.map((it) => {
            const ans = answers[it.id] ?? null;
            return (
              <View key={it.id} style={styles.itemCard}>
                <Text style={styles.itemText}>
                  {it.item_no}. {it.item_text}
                  {it.is_required ? <Text style={{ color: '#C62828' }}> *</Text> : null}
                </Text>
                <View style={styles.yesNoRow}>
                  <TouchableOpacity
                    style={[styles.ynBtn, ans === 'Yes' && styles.ynYesActive]}
                    onPress={() => setAnswer(it.id, 'Yes')}>
                    <Text style={[styles.ynText, ans === 'Yes' && styles.ynTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ynBtn, ans === 'No' && styles.ynNoActive]}
                    onPress={() => setAnswer(it.id, 'No')}>
                    <Text style={[styles.ynText, ans === 'No' && styles.ynTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.remarkInput}
                  placeholder="Description / remark (optional)"
                  placeholderTextColor="#94A3B8"
                  value={remarks[it.id] || ''}
                  onChangeText={(t) => setRemark(it.id, t)}
                  multiline
                />
              </View>
            );
          })}

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Checklist</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1,
    borderColor: '#E2E8F0', marginBottom: 16,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0F172A', marginRight: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: '800' },
  taskDesc: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontSize: 12, color: '#64748B' },
  filledBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    backgroundColor: '#E8F5E9', borderRadius: 8, padding: 8,
  },
  filledText: { fontSize: 12, color: '#2E7D32', fontWeight: '600', flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  itemCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: '#E2E8F0', marginBottom: 12,
  },
  itemText: { fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 20 },
  yesNoRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ynBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  ynYesActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  ynNoActive: { backgroundColor: '#FFEBEE', borderColor: '#C62828' },
  ynText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  ynTextActive: { color: '#0F172A' },
  remarkInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 13, color: '#0F172A', marginTop: 10, minHeight: 44,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 6,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
