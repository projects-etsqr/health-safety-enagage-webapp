import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, StatusBar } from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { DateTimePickerModal } from '../worker/components/inputs/DateTimePickerModal';
import {
  assignedTaskService, AssignableWorker, ChecklistItemInput,
} from '../services/assignedTaskService';

const PRIORITIES = [
  { key: 'low', label: 'Low', color: '#2E7D32' },
  { key: 'medium', label: 'Medium', color: '#B7791F' },
  { key: 'high', label: 'High', color: '#C62828' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-07-25 09:00" -> "25 Jul 2026, 09:00" */
function fmtDue(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return value;
  const [, y, mo, d, hh, mm] = m;
  return `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]} ${y}, ${hh}:${mm}`;
}

const WORKER_LIMIT = 10;

export default function AssignTaskScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueAt, setDueAt] = useState('');
  const [showDuePicker, setShowDuePicker] = useState(false);

  const [items, setItems] = useState<ChecklistItemInput[]>([{ item_text: '' }]);

  const [workers, setWorkers] = useState<AssignableWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    assignedTaskService
      .getAssignableWorkers()
      .then(setWorkers)
      .catch(() => Alert.alert('Error', 'Could not load workers.'))
      .finally(() => setLoadingWorkers(false));
  }, []);

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.department || '').toLowerCase().includes(q) ||
        String(w.employee_id).includes(q),
    );
  }, [workers, search]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[Number(k)]).map(Number),
    [selected],
  );

  // Select-all applies to the currently filtered workers.
  const allFilteredSelected =
    filteredWorkers.length > 0 && filteredWorkers.every((w) => selected[w.employee_id]);
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = { ...prev };
      const turnOn = !allFilteredSelected;
      filteredWorkers.forEach((w) => { next[w.employee_id] = turnOn; });
      return next;
    });
  };

  const setItemText = (idx: number, text: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, item_text: text } : it)));
  const addItem = () => setItems((prev) => [...prev, { item_text: '' }]);
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  const toggleWorker = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const submit = async () => {
    const cleanItems = items.map((it) => ({ item_text: it.item_text.trim() })).filter((it) => it.item_text);
    if (!title.trim()) return Alert.alert('Missing', 'Enter a task title.');
    if (cleanItems.length === 0) return Alert.alert('Missing', 'Add at least one checklist item.');
    if (selectedIds.length === 0) return Alert.alert('Missing', 'Select at least one worker.');

    try {
      setSubmitting(true);
      await assignedTaskService.createTask({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        priority,
        due_at: dueAt.trim() || undefined,
        items: cleanItems,
        worker_ids: selectedIds,
      });
      Alert.alert('Task Assigned', `"${title.trim()}" assigned to ${selectedIds.length} worker(s).`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not assign the task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6FA' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_BEHAVIOR}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Task</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Task details */}
        <Text style={styles.section}>Task Details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Task Title *</Text>
          <TextInput style={styles.input} placeholder="e.g. Clean Tank B-4" placeholderTextColor="#94A3B8"
            value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder="What needs to be done…"
            placeholderTextColor="#94A3B8" value={description} onChangeText={setDescription} multiline />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} placeholder="e.g. Zone B - Sector 4" placeholderTextColor="#94A3B8"
            value={location} onChangeText={setLocation} />

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.key;
              return (
                <TouchableOpacity key={p.key}
                  style={[styles.priorityPill, active && { backgroundColor: p.color, borderColor: p.color }]}
                  onPress={() => setPriority(p.key)}>
                  <Text style={[styles.priorityText, active && { color: '#fff' }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Due Date &amp; Time (optional)</Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setShowDuePicker(true)} activeOpacity={0.7}>
            <Text style={[styles.pickerValue, !dueAt && styles.pickerPlaceholder]} numberOfLines={1}>
              {dueAt ? fmtDue(dueAt) : 'Select due date & time'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Checklist */}
        <Text style={styles.section}>Checklist  (worker fills Yes/No + description)</Text>
        <View style={styles.card}>
          {items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemNo}>{idx + 1}</Text>
              <TextInput style={[styles.input, styles.itemInput]} placeholder="e.g. Gloves worn"
                placeholderTextColor="#94A3B8" value={it.item_text} onChangeText={(t) => setItemText(idx, t)} />
              <TouchableOpacity onPress={() => removeItem(idx)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={22} color={items.length === 1 ? '#CBD5E1' : '#EF4444'} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addItemText}>Add checklist item</Text>
          </TouchableOpacity>
        </View>

        {/* Workers */}
        <Text style={styles.section}>
          Assign To Workers {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ''}
        </Text>
        <View style={styles.card}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#64748B" />
            <TextInput style={styles.searchInput} placeholder="Search by name or ID…" placeholderTextColor="#94A3B8"
              value={search} onChangeText={setSearch} />
          </View>

          {!loadingWorkers && filteredWorkers.length > 0 && (
            <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
              <Ionicons
                name={allFilteredSelected ? 'checkbox' : 'square-outline'}
                size={22} color={allFilteredSelected ? Colors.primary : '#94A3B8'} />
              <Text style={styles.selectAllText}>
                {allFilteredSelected ? 'Deselect all' : `Select all${search.trim() ? ' matching' : ''}`}
                {`  (${filteredWorkers.length})`}
              </Text>
            </TouchableOpacity>
          )}

          {loadingWorkers ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.workerList}>
              {filteredWorkers.slice(0, WORKER_LIMIT).map((w) => {
                const on = !!selected[w.employee_id];
                return (
                  <TouchableOpacity key={w.employee_id} style={styles.workerRow} onPress={() => toggleWorker(w.employee_id)}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? Colors.primary : '#94A3B8'} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.workerName}>{w.name}</Text>
                      <Text style={styles.workerDept}>ID {w.employee_id}{w.department ? ` · ${w.department}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredWorkers.length > WORKER_LIMIT && (
                <Text style={styles.moreHint}>
                  Showing {WORKER_LIMIT} of {filteredWorkers.length} — search by name or ID to narrow, or use Select all.
                </Text>
              )}
              {filteredWorkers.length === 0 && <Text style={styles.moreHint}>No workers match.</Text>}
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Assign Task</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <DateTimePickerModal
        visible={showDuePicker}
        value={dueAt}
        title="Due date & time"
        onCancel={() => setShowDuePicker(false)}
        onConfirm={(val) => { setDueAt(val); setShowDuePicker(false); }}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16, paddingBottom: 120 },
  section: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#fff',
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff',
  },
  pickerValue: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' },
  pickerPlaceholder: { color: '#94A3B8', fontWeight: '400' },
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 2,
  },
  selectAllText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityPill: {
    flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  priorityText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  itemNo: { width: 20, fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  itemInput: { flex: 1, marginHorizontal: 6 },
  removeBtn: { padding: 2 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
  addItemText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  workerList: {},
  workerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  workerName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  workerDept: { fontSize: 11, color: '#64748B', marginTop: 1 },
  moreHint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 10 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
