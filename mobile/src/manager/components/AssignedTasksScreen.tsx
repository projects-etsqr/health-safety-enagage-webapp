import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaScreen } from '../../components/layout/KeyboardAvoider';
import {
  ArrowLeft, Users, User, MapPin, CheckCircle2, Clock,
  Edit3, Plus, X, Save,
} from 'lucide-react-native';
import type { ScreenProps } from './types';
import { assignedTaskService } from '../../services/assignedTaskService';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#2E7D32', medium: '#B7791F', high: '#C62828',
};

interface EditItem { id?: number; item_text: string; is_required: boolean; }

export function AssignedTasksScreenView({ setCurrentScreen }: ScreenProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(() => {
    setLoading(true);
    assignedTaskService.listTasks().then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  const openTask = (id: number) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setEditing(false);
    assignedTaskService
      .getResponses(id)
      .then(setDetail)
      .catch(() => Alert.alert('Error', 'Could not load task.'))
      .finally(() => setLoadingDetail(false));
  };

  const backToList = () => { setSelectedId(null); setDetail(null); loadList(); };

  const startEdit = () => {
    setEditItems((detail?.items || []).map((it: any) => ({
      id: it.id, item_text: it.item_text, is_required: it.is_required,
    })));
    setEditing(true);
  };
  const setEditText = (idx: number, t: string) =>
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, item_text: t } : it)));
  const addEditItem = () => setEditItems((prev) => [...prev, { item_text: '', is_required: true }]);
  const removeEditItem = (idx: number) =>
    setEditItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const saveEdit = async () => {
    const clean = editItems.map((i) => ({ ...i, item_text: i.item_text.trim() })).filter((i) => i.item_text);
    if (clean.length === 0) return Alert.alert('Missing', 'Add at least one checklist item.');
    try {
      setSaving(true);
      await assignedTaskService.editItems(selectedId!, clean);
      setEditing(false);
      openTask(selectedId!);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (selectedId === null) {
    return (
      <SafeAreaScreen style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentScreen('app')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assigned Tasks</Text>
          <View style={{ width: 22 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <Text style={styles.empty}>No tasks have been assigned yet.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {tasks.map((t) => {
              const pColor = PRIORITY_COLORS[t.priority] || '#64748B';
              const allDone = t.worker_count > 0 && t.filled_count === t.worker_count;
              return (
                <TouchableOpacity key={t.id} style={styles.card} activeOpacity={0.85} onPress={() => openTask(t.id)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                    <View style={[styles.badge, { backgroundColor: pColor + '22' }]}>
                      <Text style={[styles.badgeText, { color: pColor }]}>{t.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <User size={13} color="#64748B" />
                    <Text style={styles.metaText}>By {t.assigned_by_name}</Text>
                    {!!t.location && (<><MapPin size={13} color="#64748B" style={{ marginLeft: 10 }} /><Text style={styles.metaText}>{t.location}</Text></>)}
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.progressPill}>
                      <Users size={13} color={allDone ? '#2E7D32' : '#B7791F'} />
                      <Text style={[styles.progressText, { color: allDone ? '#2E7D32' : '#B7791F' }]}>
                        {t.filled_count}/{t.worker_count} filled
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        )}
      </SafeAreaScreen>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaScreen style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={backToList} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Task Details</Text>
        <View style={{ width: 22 }} />
      </View>

      {loadingDetail || !detail ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Summary */}
          <View style={styles.card}>
            <Text style={styles.detailTitle}>{detail.title}</Text>
            {!!detail.description && <Text style={styles.detailDesc}>{detail.description}</Text>}
            <View style={styles.metaRow}><User size={13} color="#64748B" /><Text style={styles.metaText}>Assigned by {detail.assigned_by_name}</Text></View>
            {!!detail.location && <View style={styles.metaRow}><MapPin size={13} color="#64748B" /><Text style={styles.metaText}>{detail.location}</Text></View>}
          </View>

          {/* Checklist (with edit) */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            {!editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                <Edit3 size={14} color="#2563EB" /><Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(false)}>
                  <X size={14} color="#64748B" /><Text style={[styles.editBtnText, { color: '#64748B' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#2563EB' }]} onPress={saveEdit} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Save size={14} color="#fff" /><Text style={[styles.editBtnText, { color: '#fff' }]}>Save</Text></>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.card}>
            {!editing ? (
              detail.items.map((it: any) => (
                <View key={it.id} style={styles.itemRead}>
                  <Text style={styles.itemReadText}>{it.item_no}. {it.item_text}{it.is_required ? <Text style={{ color: '#C62828' }}> *</Text> : null}</Text>
                </View>
              ))
            ) : (
              <>
                {editItems.map((it, idx) => (
                  <View key={idx} style={styles.editRow}>
                    <Text style={styles.itemNo}>{idx + 1}</Text>
                    <TextInput style={styles.editInput} value={it.item_text} placeholder="Checklist item"
                      placeholderTextColor="#94A3B8" onChangeText={(t) => setEditText(idx, t)} />
                    <TouchableOpacity onPress={() => removeEditItem(idx)}>
                      <X size={18} color={editItems.length === 1 ? '#CBD5E1' : '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addRow} onPress={addEditItem}>
                  <Plus size={16} color="#2563EB" /><Text style={styles.addText}>Add item</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Worker responses */}
          <Text style={styles.sectionTitle}>
            Worker Responses ({detail.workers.filter((w: any) => w.status === 'filled').length}/{detail.workers.length} filled)
          </Text>
          {detail.workers.map((w: any) => {
            const filled = w.status === 'filled';
            return (
              <View key={w.employee_id} style={styles.card}>
                <View style={styles.workerHead}>
                  <Text style={styles.workerName}>{w.name}</Text>
                  <View style={[styles.statusPill, filled ? styles.pillFilled : styles.pillPending]}>
                    {filled ? <CheckCircle2 size={13} color="#2E7D32" /> : <Clock size={13} color="#B7791F" />}
                    <Text style={[styles.statusText, { color: filled ? '#2E7D32' : '#B7791F' }]}>
                      {filled ? 'Filled' : 'Pending'}
                    </Text>
                  </View>
                </View>
                {filled && detail.items.map((it: any) => {
                  const r = w.responses[it.id] || w.responses[String(it.id)] || {};
                  const ans = r.answer;
                  return (
                    <View key={it.id} style={styles.respRow}>
                      <Text style={styles.respItem}>{it.item_no}. {it.item_text}</Text>
                      <View style={styles.respAnsRow}>
                        <View style={[styles.ansBadge, { backgroundColor: ans === 'Yes' ? '#E8F5E9' : ans === 'No' ? '#FFEBEE' : '#F1F5F9' }]}>
                          <Text style={[styles.ansText, { color: ans === 'Yes' ? '#2E7D32' : ans === 'No' ? '#C62828' : '#64748B' }]}>{ans || '—'}</Text>
                        </View>
                        {!!r.description && <Text style={styles.respDesc}>{r.description}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 50, color: '#64748B', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A', marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 12, color: '#64748B' },
  cardFooter: { flexDirection: 'row', marginTop: 10 },
  progressPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  progressText: { fontSize: 12, fontWeight: '700' },
  detailTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  detailDesc: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8, marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  itemRead: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemReadText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemNo: { width: 18, fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  editInput: { flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  workerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pillFilled: { backgroundColor: '#E8F5E9' },
  pillPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: '700' },
  respRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  respItem: { fontSize: 13, fontWeight: '600', color: '#334155' },
  respAnsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  ansBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  ansText: { fontSize: 12, fontWeight: '800' },
  respDesc: { fontSize: 12, color: '#64748B', flex: 1 },
});
