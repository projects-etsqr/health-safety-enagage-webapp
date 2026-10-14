import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { permitWorkflowService, type PermitListItem } from '../services/permitWorkflowService';
import type { Permit } from '../types/permit.types';
import { KeyboardAvoider, SafeAreaScreen } from '../components/layout/KeyboardAvoider';

interface Props {
  navigation: any;
}

// Map a permit-workflow record to the local display shape used by this screen.
function toDisplayPermit(p: PermitListItem): Permit {
  const ws = p.workflow_status || 'requested';
  const status = ws === 'approved' ? 'approved' : ws === 'rejected' ? 'rejected' : 'pending';
  const out: any = {
    id: String(p.id),
    permit_ref: p.permit_ref || `PTW-${p.id}`,
    permit_type: p.work_description ? 'Permit to Work' : 'Permit to Work',
    title: p.work_description || 'Permit to Work',
    location: p.location_station_id ? `Station ${p.location_station_id}` : 'Site',
    requestor: p.requested_by ? `Emp ${p.requested_by}` : '—',
    status: status as Permit['status'],
    workflow_status: ws,
    risk_level: 'medium',
    validity_end: p.validity_end ? new Date(p.validity_end).toLocaleString() : 'Awaiting Authorization',
  };
  return out as Permit;
}

export function PermitsScreen({ navigation }: Props) {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // ── Close-out ────────────────────────────────────────────────────────────
  const [closing, setClosing] = useState<Permit | null>(null);
  const [deviation, setDeviation] = useState<'Yes' | 'No'>('No');
  const [incidentOccurred, setIncidentOccurred] = useState<'Yes' | 'No'>('No');
  const [closeNotes, setCloseNotes] = useState('');
  const [savingClose, setSavingClose] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Supervisor sees permits awaiting review + the active ones on site.
      const [pending, active] = await Promise.all([
        permitWorkflowService.pendingReview(),
        permitWorkflowService.active(),
      ]);
      setPermits([...pending, ...active].map(toDisplayPermit));
    } catch {
      setPermits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const submitClose = async () => {
    if (!closing) return;
    setSavingClose(true);
    try {
      await permitWorkflowService.close(Number(closing.id), {
        deviation_reported: deviation,
        incident_occurred: incidentOccurred,
        work_end_actual: new Date().toISOString(),
        supervisor_notes: closeNotes.trim() || undefined,
      });
      setClosing(null);
      setDeviation('No');
      setIncidentOccurred('No');
      setCloseNotes('');
      loadData();
    } catch (e: any) {
      Alert.alert('Close Failed', e?.response?.data?.detail || 'Could not close this permit.');
    } finally {
      setSavingClose(false);
    }
  };

  const permitsList = permits.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.permit_type.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = permits.filter(p => p.status === 'approved' || p.status === 'active').length;
  const pendingCount = permits.filter(p => p.status === 'pending' || p.status === 'ready_for_review').length;

  return (
    <SafeAreaScreen style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Permit Monitoring</Text>
        <Text style={styles.headerSubtitle}>Validate and audit real-time work permits</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Today's Activity Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: '#16A34A' }]}
            onPress={() => navigation.navigate('PermitRequestManagement')}
            activeOpacity={0.85}
          >
            <Text style={styles.statVal}>{activeCount}</Text>
            <Text style={styles.statLbl}>Active Permits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: '#F97316' }]}
            onPress={() => navigation.navigate('PermitRequestManagement')}
            activeOpacity={0.85}
          >
            <Text style={styles.statVal}>{pendingCount}</Text>
            <Text style={styles.statLbl}>Pending Review</Text>
          </TouchableOpacity>
        </View>

        {/* Validation CTA Button */}
        <TouchableOpacity
          style={styles.validateBtn}
          onPress={() => navigation.navigate('PermitRequestManagement')}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
          <Text style={styles.validateBtnText}>Approve & Validate Requests</Text>
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textLight} />
          <TextInput
            placeholder="Search permits by name or type..."
            placeholderTextColor={Colors.textLight}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Permits List Title */}
        <Text style={styles.listTitle}>Permit List</Text>

        {/* List */}
        <View style={styles.list}>
          {!loading && permitsList.length === 0 && (
            <Text style={styles.metaText}>No permits to review right now.</Text>
          )}
          {permitsList.map((p) => {
            const isApproved = p.status === 'approved' || p.status === 'active';
            const isPending = p.status === 'pending' || p.status === 'ready_for_review' || p.status === 'awaiting_signature';
            const statusColor = isApproved ? '#16A34A' : isPending ? '#F97316' : '#EF4444';
            const statusBg = isApproved ? '#F0FDF4' : isPending ? '#FFF7ED' : '#FEF2F2';

            return (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                onPress={() => navigation.navigate('PermitRequestManagement', { permit: p })}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{p.title}</Text>
                    <Text style={styles.cardType}>{p.permit_type}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {p.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{p.requestor}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="pin-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{p.location}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.timeBox}>
                    <Ionicons name="time-outline" size={13} color={statusColor} />
                    <Text style={[styles.timeText, { color: statusColor }]}>{p.validity_end ?? 'No Expiry'}</Text>
                  </View>
                  {isApproved ? (
                    <TouchableOpacity
                      style={styles.closeOutBtn}
                      onPress={() => setClosing(p)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.closeOutBtnText}>Close Out</Text>
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="arrow-forward" size={16} color={Colors.textLight} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={closing != null} transparent animationType="slide" onRequestClose={() => setClosing(null)}>
        <KeyboardAvoider style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Close Out Permit</Text>
              <TouchableOpacity onPress={() => setClosing(null)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>{closing?.title}</Text>

            <Text style={styles.fieldLabel}>WAS THERE ANY DEVIATION FROM THE PERMIT?</Text>
            <View style={styles.pillRow}>
              {(['No', 'Yes'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.pill, deviation === v && styles.pillActive]}
                  onPress={() => setDeviation(v)}
                >
                  <Text style={[styles.pillText, deviation === v && styles.pillTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hintText}>
              Drives LOTO Compliance % and Permit Deviation Rate.
            </Text>

            <Text style={styles.fieldLabel}>DID AN INCIDENT OCCUR DURING THIS WORK?</Text>
            <View style={styles.pillRow}>
              {(['No', 'Yes'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.pill, incidentOccurred === v && styles.pillActive]}
                  onPress={() => setIncidentOccurred(v)}
                >
                  <Text style={[styles.pillText, incidentOccurred === v && styles.pillTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>SUPERVISOR NOTES</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Anything worth recording about this close-out..."
              placeholderTextColor={Colors.textLight}
              multiline
              value={closeNotes}
              onChangeText={setCloseNotes}
            />

            <TouchableOpacity style={styles.confirmCloseBtn} onPress={submitClose} disabled={savingClose}>
              {savingClose
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.confirmCloseText}>Close Permit</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoider>
      </Modal>
    </SafeAreaScreen>
  );
}

const styles = StyleSheet.create({
  closeOutBtn: {
    backgroundColor: '#0B3D91', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  closeOutBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0B1C30' },
  sheetSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  pillActive: { backgroundColor: '#0B3D91', borderColor: '#0B3D91' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#0B1C30' },
  pillTextActive: { color: '#FFFFFF' },
  hintText: { fontSize: 11, color: Colors.textLight, marginTop: 6 },
  notesInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, minHeight: 72, fontSize: 14, color: '#0B1C30', textAlignVertical: 'top',
  },
  confirmCloseBtn: {
    backgroundColor: '#0B3D91', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  confirmCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  root: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1C30',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#737686',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B1C30',
  },
  statLbl: {
    fontSize: 11,
    color: '#737686',
    marginTop: 4,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#004AC6',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0B1C30',
    padding: 0,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1C30',
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1C30',
  },
  cardType: {
    fontSize: 11,
    color: '#737686',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#434655',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
