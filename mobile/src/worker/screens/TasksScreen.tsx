import React, { useCallback, useState, useEffect } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { Colors } from '../theme/colors';
import { useTasks } from '../hooks/useTasks';
import { useMySubmissions } from '../hooks/useMySubmissions';
import { assignedTaskService, AssignedTaskListItem } from '../services/assignedTaskService';

const CHECKLIST_LABELS: Record<string, string> = {
  worker_pre_shift: 'Pre-Shift Safety Check',
  worker_post_shift: 'Post-Shift Safety Check',
  worker_vehicle_pre_start: 'Vehicle Pre-Start Check',
};

const SUBMISSION_STATUS = {
  draft:     { bg: '#F1F5F9', text: '#475569', label: 'Draft' },
  submitted: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Submitted' },
  validated: { bg: '#E8F5E9', text: '#2E7D32', label: 'Validated' },
  rejected:  { bg: '#FFEBEE', text: '#C62828', label: 'Rejected' },
} as const;

export default function TasksScreen({ navigation }: any) {
  const { tasks, isLoading, refetch } = useTasks();
  const {
    submissions,
    isLoading: loadingSubs,
    error: subsError,
    refetch: refetchSubs,
  } = useMySubmissions();
  const [search, setSearch] = useState('');

  // Tasks the supervisor assigned to this worker (with a custom checklist to fill).
  const [assignedTasks, setAssignedTasks] = useState<AssignedTaskListItem[]>([]);
  const loadAssigned = useCallback(() => {
    assignedTaskService.list().then(setAssignedTasks).catch(() => {});
  }, []);
  useEffect(() => { loadAssigned(); }, [loadAssigned]);

  const onRefresh = useCallback(() => {
    refetch();
    refetchSubs();
    loadAssigned();
  }, [refetch, refetchSubs, loadAssigned]);

  // Mock checklist details for custom UI presentation
  const getSubText = (title: string) => {
    if (title.includes('Excavator') || title.includes('Braking')) {
      return { text: 'Requires specialized pressure gauge kit.', icon: '🔧' };
    }
    if (title.includes('Perimeter') || title.includes('Tyres')) {
      return { text: 'Verify structural integrity of the temporary flood barriers.', icon: '🛡️' };
    }
    if (title.includes('First Aid') || title.includes('Lights')) {
      return { text: 'Restock antiseptic wipes and burn gel as needed.', icon: '🩹' };
    }
    return { text: 'Check for secondary containment leaks in drum zone.', icon: '🔬' };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'critical':
        return { bg: '#FFEBEE', text: '#C62828', label: 'High' };
      case 'med':
      case 'medium':
        return { bg: '#F3E5F5', text: '#7B1FA2', label: 'Med' };
      default:
        return { bg: '#E8F5E9', text: '#2E7D32', label: 'Low' };
    }
  };

  // Filter tasks based on search
  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.location.toLowerCase().includes(search.toLowerCase())
  );

  const checklistLabel = (type: string) =>
    CHECKLIST_LABELS[type] ??
    type.replace(/^worker_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const filteredSubmissions = submissions.filter(s =>
    checklistLabel(s.checklist_type).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>Ehsera</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon emoji="🔔" style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Icon emoji="🔍" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tasks, equipment, or sites..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <Text style={styles.filterLabel}>Filters:</Text>
          <TouchableOpacity style={styles.filterPill}>
            <Text style={styles.filterPillText}>Priority</Text>
            <Icon name="chevron-down" size={13} color={Colors.textMuted} style={styles.filterPillIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill}>
            <Text style={styles.filterPillText}>Due Date</Text>
            <Icon name="calendar" size={13} color={Colors.textMuted} style={styles.filterPillIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill}>
            <Text style={styles.filterPillText}>Status</Text>
            <Icon name="check" size={13} color={Colors.textMuted} style={styles.filterPillIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* Tasks assigned by supervisor (with checklist to fill) */}
        {assignedTasks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Assigned by Supervisor</Text>
              <Text style={styles.sectionCount}>{assignedTasks.length}</Text>
            </View>
            <View style={styles.assignedList}>
              {assignedTasks.map((t) => {
                const filled = t.my_status === 'filled';
                const pc = getPriorityColor(t.priority);
                return (
                  <TouchableOpacity
                    key={`at-${t.id}`}
                    style={styles.assignedCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('AssignedTaskFill', { taskId: t.id })}
                  >
                    <View style={styles.assignedTop}>
                      <Text style={styles.assignedTitle} numberOfLines={1}>{t.title}</Text>
                      <View style={[styles.priorityBadge, { backgroundColor: pc.bg }]}>
                        <Text style={[styles.priorityText, { color: pc.text }]}>{pc.label}</Text>
                      </View>
                    </View>
                    <View style={styles.assignedMeta}>
                      <Icon name="user" size={12} color={Colors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.metaText}>By {t.assigned_by_name}</Text>
                      {!!t.location && (
                        <>
                          <Icon name="map-pin" size={12} color={Colors.textMuted} style={{ marginLeft: 10, marginRight: 4 }} />
                          <Text style={styles.metaText} numberOfLines={1}>{t.location}</Text>
                        </>
                      )}
                    </View>
                    <View style={styles.assignedFooter}>
                      <View style={[styles.statusPill, filled ? styles.statusFilled : styles.statusPending]}>
                        <Text style={[styles.statusPillText, { color: filled ? '#2E7D32' : '#B7791F' }]}>
                          {filled ? '✓ Filled' : 'Pending — tap to fill'}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* My Submitted Checklists */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Checklists</Text>
          {filteredSubmissions.length > 0 && (
            <Text style={styles.sectionCount}>{filteredSubmissions.length}</Text>
          )}
        </View>

        {loadingSubs && submissions.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : subsError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Couldn't load your checklists.</Text>
            <TouchableOpacity onPress={refetchSubs}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredSubmissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {search ? 'No checklists match your search.' : "You haven't submitted any checklists yet."}
            </Text>
          </View>
        ) : (
          <View style={styles.submissionsList}>
            {filteredSubmissions.map((s) => {
              const sColors = SUBMISSION_STATUS[s.status] ?? SUBMISSION_STATUS.draft;
              return (
                <View key={s.submission_uuid} style={styles.submissionCard}>
                  <View style={styles.submissionTop}>
                    <Text style={styles.submissionTitle} numberOfLines={1}>
                      {checklistLabel(s.checklist_type)}
                    </Text>
                    <View style={[styles.priorityBadge, { backgroundColor: sColors.bg }]}>
                      <Text style={[styles.priorityText, { color: sColors.text }]}>{sColors.label}</Text>
                    </View>
                  </View>
                  <View style={styles.submissionMeta}>
                    <Icon name="calendar" size={13} color={Colors.textMuted} style={styles.metaItemIcon} />
                    <Text style={styles.metaText}>{s.checklist_date}</Text>
                    {!!s.submit_sla_breached && (
                      <>
                        <Icon name="alert-triangle" size={13} color="#C62828" style={styles.slaIcon} />
                        <Text style={styles.slaText}>SLA breached</Text>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Assigned Tasks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Tasks</Text>
        </View>

        {isLoading && filteredTasks.length === 0 ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.tasksList}>
            {filteredTasks.map((t) => {
              const subInfo = getSubText(t.title);
              const pColors = getPriorityColor(t.priority);

              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.taskCard}
                  onPress={() => navigation.navigate('PerformTask', { task: t })}
                >
                  <View style={styles.cardHeader}>
                    {/* Checkbox */}
                    <View style={styles.checkbox} />
                    <View style={styles.headerMiddle}>
                      <Text style={styles.taskTitle}>{t.title}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: pColors.bg }]}>
                      <Text style={[styles.priorityText, { color: pColors.text }]}>{pColors.label}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Icon name="calendar" size={13} color={Colors.textMuted} style={styles.metaItemIcon} />
                      <Text style={styles.metaText}>Today, 4:00 PM</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Icon name="map-pin" size={13} color={Colors.textMuted} style={styles.metaItemIcon} />
                      <Text style={styles.metaText}>{t.location}</Text>
                    </View>
                  </View>

                  {/* Sub Instruction Nested Card */}
                  <View style={styles.instructionCard}>
                    <Icon emoji={subInfo.icon} style={styles.instructionIcon} />
                    <Text style={styles.instructionText}>{subInfo.text}</Text>
                    <Icon emoji="❯" style={styles.arrowIcon} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerIcon: {
    fontSize: 22,
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 16,
    color: '#64748B',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  newBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterPillText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  filterPillIcon: {
    marginLeft: 4,
  },
  clearAllText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 8,
  },
  assignedList: { gap: 10, marginBottom: 24 },
  assignedCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#DBEAFE',
  },
  assignedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  assignedTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A', marginRight: 8 },
  assignedMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  assignedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusFilled: { backgroundColor: '#E8F5E9' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  submissionsList: {
    gap: 10,
    marginBottom: 24,
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  submissionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  submissionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  submissionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slaIcon: {
    marginLeft: 12,
    marginRight: 4,
  },
  slaText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '700',
  },
  tasksList: {
    gap: 14,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
    marginTop: 2,
  },
  headerMiddle: {
    flex: 1,
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingLeft: 32,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItemIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginLeft: 32,
  },
  instructionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  arrowIcon: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '500',
    marginTop: -2,
  },
});
