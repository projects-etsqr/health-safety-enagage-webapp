import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, AlertTriangle, Info, Plus, Send, Search, MoreVertical } from 'lucide-react-native';
import { DateTimePickerModal } from '../../worker/components/inputs/DateTimePickerModal';
import type { ScreenProps } from './types';
import { apiClient } from '../../api/client';
import { incidentWorkflowService, type CapaOwner } from '../../services/incidentWorkflowService';

const PRIORITIES = [
  { key: 'Critical', color: '#DC2626', bg: '#FEE2E2' },
  { key: 'High', color: '#0B1C30', bg: '#FFFFFF' },
  { key: 'Medium', color: '#0B1C30', bg: '#FFFFFF' },
];

interface Queued {
  description: string; priority: string; due: string; assigneeId: number; assigneeName: string;
  rootCause?: string;
}

export function MgrAssignActions({ setCurrentScreen, selectedIncident, showToast }: ScreenProps) {
  const inc: any = selectedIncident || {};
  // Supervisors, not workers. A corrective action changes a control — refit a
  // guard, rewrite a procedure, retrain a crew — and the accountable owner is
  // the supervisor for that area. This screen previously listed `operator`
  // logins, so every CAPA was assigned to the wrong role.
  const [owners, setOwners] = useState<CapaOwner[]>([]);
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('Critical');
  const [due, setDue] = useState('');
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assigneeName, setAssigneeName] = useState('');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [compliance, setCompliance] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => { incidentWorkflowService.getCapaAssignableOwners().then(setOwners).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return owners.slice(0, 8);
    return owners.filter((w) => w.name.toLowerCase().includes(q) || String(w.employee_id).includes(q)).slice(0, 8);
  }, [owners, search]);

  const queueAction = () => {
    if (!desc.trim()) return Alert.alert('Missing', 'Enter an action description.');
    if (!assigneeId) return Alert.alert('Missing', 'Select a supervisor to own this action.');
    setQueue((p) => [...p, { description: desc.trim(), priority, due: due.trim(), assigneeId, assigneeName, rootCause: rootCause.trim() }]);
    setDesc(''); setDue(''); setAssigneeId(null); setAssigneeName(''); setSearch(''); setPriority('Critical'); setCompliance(false); setRootCause('');
  };

  const finalize = async () => {
    if (queue.length === 0) return Alert.alert('Nothing to issue', 'Queue at least one action.');
    try {
      setIssuing(true);
      for (const q of queue) {
        await apiClient.post('/capa-actions/', {
          action_type: 'Corrective',
          description: q.priority !== 'Critical' ? `[${q.priority}] ${q.description}` : q.description,
          responsible_person_id: q.assigneeId,
          due_date: q.due || undefined,
          status: 'Open',
          // Which root cause this action closes out — drives CAPA-to-cause traceability.
          root_cause_addressed: q.rootCause || inc.root_cause || undefined,
          incident_id: inc.id && /^\d+$/.test(String(inc.id)) ? Number(inc.id) : undefined,
        });
      }
      showToast?.(`${queue.length} corrective action(s) issued`);
      setCurrentScreen('app');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.detail || 'Could not issue actions.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('investigation')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Actions</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Source */}
          <View style={styles.sourceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceLabel}>SOURCE INVESTIGATION</Text>
              <Text style={styles.sourceId}>{inc.ref || `INC-${inc.id ?? '—'}`}</Text>
              <Text style={styles.sourceTitle} numberOfLines={1}>{inc.title || inc.message || 'Incident'}</Text>
            </View>
            <TouchableOpacity style={styles.viewBtn} onPress={() => setCurrentScreen('investigation')}>
              <Text style={styles.viewBtnText}>View Details</Text>
            </TouchableOpacity>
          </View>

          {/* New action form */}
          <Text style={styles.section}>New Corrective Action</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Action Description</Text>
            <TextInput style={styles.textarea} placeholder="Describe the specific corrective measure..."
              placeholderTextColor="#94A3B8" value={desc} onChangeText={setDesc} multiline />

            <Text style={styles.label}>Root Cause Addressed</Text>
            <TextInput style={styles.input} placeholder="Which root cause does this action close out?"
              placeholderTextColor="#94A3B8" value={rootCause} onChangeText={setRootCause} />

            <Text style={styles.label}>Priority Level</Text>
            <View style={styles.prioRow}>
              {PRIORITIES.map((p) => {
                const on = priority === p.key;
                return (
                  <TouchableOpacity key={p.key} style={[styles.prioBtn, on && { borderColor: p.color, backgroundColor: p.key === 'Critical' ? '#FFF' : '#EAF0FB' }]} onPress={() => setPriority(p.key)}>
                    {p.key === 'Critical' ? <AlertTriangle size={15} color="#DC2626" /> : <Info size={15} color="#63739B" />}
                    <Text style={[styles.prioText, on && { color: p.key === 'Critical' ? '#DC2626' : '#0B3D91', fontWeight: '800' }]}>{p.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center', height: 44 }]}
                  onPress={() => setDueDatePickerVisible(true)}
                >
                  <Text style={{ fontSize: 14, color: due ? '#0B1C30' : '#94A3B8' }}>
                    {due || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Assignee</Text>
                <TouchableOpacity style={styles.assignField} onPress={() => setShowList((s) => !s)}>
                  <Text style={[styles.assignText, !assigneeName && { color: '#94A3B8' }]} numberOfLines={1}>
                    {assigneeName || 'Select worker...'}
                  </Text>
                  <Search size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {showList && (
              <View style={styles.dropdown}>
                <TextInput style={styles.searchInput} placeholder="Search name or ID..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
                {filtered.map((w) => (
                  <TouchableOpacity key={w.employee_id} style={styles.wRow} onPress={() => { setAssigneeId(w.employee_id); setAssigneeName(w.name); setShowList(false); setSearch(''); }}>
                    <Text style={styles.wName}>{w.name}</Text>
                    <Text style={styles.wId}>ID {w.employee_id}</Text>
                  </TouchableOpacity>
                ))}
                {filtered.length === 0 && <Text style={styles.wEmpty}>No supervisors match.</Text>}
              </View>
            )}

            <TouchableOpacity style={styles.complRow} onPress={() => setCompliance((c) => !c)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.complTitle}>Compliance Required</Text>
                <Text style={styles.complSub}>ISO 45001 / Site Safety Standard</Text>
              </View>
              <View style={[styles.toggle, compliance && styles.toggleOn]}><View style={[styles.knob, compliance && styles.knobOn]} /></View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.queueBtn} onPress={queueAction}>
              <Plus size={18} color="#FFFFFF" /><Text style={styles.queueText}>Queue Action</Text>
            </TouchableOpacity>
          </View>

          {/* Queue */}
          <Text style={styles.section}>Queued Actions ({queue.length})</Text>
          {queue.length === 0 ? (
            <Text style={styles.empty}>No actions queued yet.</Text>
          ) : (
            queue.map((q, i) => {
              const crit = q.priority === 'Critical';
              return (
                <View key={i} style={[styles.qCard, { borderLeftColor: crit ? '#DC2626' : '#2563EB' }]}>
                  <View style={styles.qTop}>
                    <View style={[styles.qBadge, { backgroundColor: crit ? '#FEE2E2' : '#EAF0FB' }]}>
                      <Text style={[styles.qBadgeText, { color: crit ? '#DC2626' : '#0B3D91' }]}>PENDING</Text>
                    </View>
                    <MoreVertical size={16} color="#A0AEC0" />
                  </View>
                  <Text style={styles.qDesc}>{q.description}</Text>
                  <View style={styles.qFoot}>
                    <Text style={styles.qAssignee}>👤 {q.assigneeName}</Text>
                    {!!q.due && <Text style={[styles.qDue, { color: crit ? '#DC2626' : '#63739B' }]}>Due: {q.due}</Text>}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 12 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.finalizeBtn, (issuing || queue.length === 0) && { opacity: 0.6 }]} onPress={finalize} disabled={issuing || queue.length === 0}>
            {issuing ? <ActivityIndicator color="#fff" /> : <><Send size={18} color="#FFFFFF" /><Text style={styles.finalizeText}>Finalize & Issue Actions</Text></>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <DateTimePickerModal
        visible={dueDatePickerVisible}
        value={due ? `${due} 00:00` : null}
        title="CAPA Due Date"
        minToday={true}
        onCancel={() => setDueDatePickerVisible(false)}
        onConfirm={(val) => {
          const datePart = val.split(' ')[0]; // Extract "YYYY-MM-DD"
          setDue(datePart);
          setDueDatePickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B3D91' },
  scroll: { padding: 20, paddingBottom: 20 },
  sourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF0FB', borderRadius: 14, padding: 16, marginBottom: 20 },
  sourceLabel: { fontSize: 10, fontWeight: '700', color: '#63739B', letterSpacing: 0.5 },
  sourceId: { fontSize: 20, fontWeight: '800', color: '#0B1C30', marginVertical: 2 },
  sourceTitle: { fontSize: 12, color: '#63739B' },
  viewBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  viewBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '800', color: '#0B1C30', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#63739B', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  textarea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0B1C30', minHeight: 70, textAlignVertical: 'top' },
  prioRow: { flexDirection: 'row', gap: 8 },
  prioBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 12 },
  prioText: { fontSize: 13, fontWeight: '700', color: '#63739B' },
  row2: { flexDirection: 'row', gap: 12 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#0B1C30' },
  assignField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  assignText: { fontSize: 14, color: '#0B1C30', flex: 1, marginRight: 6 },
  dropdown: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 8, marginTop: 8 },
  searchInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 6 },
  wRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  wName: { fontSize: 13, fontWeight: '600', color: '#0B1C30' },
  wId: { fontSize: 11, color: '#94A3B8' },
  wEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  complRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF0FB', borderRadius: 10, padding: 12, marginTop: 14 },
  complTitle: { fontSize: 13, fontWeight: '700', color: '#0B1C30' },
  complSub: { fontSize: 11, color: '#63739B', marginTop: 1 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#CBD5E1', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#2563EB' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  knobOn: { alignSelf: 'flex-end' },
  queueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0B3D91', borderRadius: 12, paddingVertical: 15, marginTop: 16 },
  queueText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  empty: { color: '#737686', textAlign: 'center', marginTop: 10 },
  qCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F7', borderLeftWidth: 4 },
  qTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  qBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  qBadgeText: { fontSize: 10, fontWeight: '800' },
  qDesc: { fontSize: 14, color: '#0B1C30', lineHeight: 20, marginBottom: 10 },
  qFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  qAssignee: { fontSize: 12, color: '#63739B', fontWeight: '600' },
  qDue: { fontSize: 12, fontWeight: '700' },
  footer: { backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  finalizeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16 },
  finalizeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
