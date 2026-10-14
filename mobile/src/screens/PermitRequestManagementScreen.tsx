import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  permitWorkflowService,
  type PermitNextAction,
} from '../services/permitWorkflowService';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  requested:    { label: 'Awaiting your acknowledgement', color: '#F97316', bg: '#FFF7ED' },
  acknowledged: { label: 'Acknowledged — forwarded to Manager', color: '#2563EB', bg: '#EFF6FF' },
  gate_blocked: { label: 'Blocked by the gate engine', color: '#B91C1C', bg: '#FEF2F2' },
  // `approved` is the legacy value; the manager now sets `issued`. Both are
  // stage 05 — granted, controls attached, work not yet started.
  approved:     { label: 'Issued — not yet started', color: '#C2410C', bg: '#FFF7ED' },
  issued:       { label: 'Issued — not yet started', color: '#C2410C', bg: '#FFF7ED' },
  active:       { label: 'Active — work in progress', color: '#16A34A', bg: '#F0FDF4' },
  verified:     { label: 'Active — controls verified on site', color: '#15803D', bg: '#F0FDF4' },
  suspended:    { label: 'Suspended — work stopped', color: '#B91C1C', bg: '#FEF2F2' },
  expired:      { label: 'Work complete — awaiting close-out', color: '#2563EB', bg: '#EFF6FF' },
  closed:       { label: 'Closed', color: '#64748B', bg: '#F1F5F9' },
  cancelled:    { label: 'Cancelled', color: '#64748B', bg: '#F1F5F9' },
  rejected:     { label: 'Rejected', color: '#EF4444', bg: '#FEF2F2' },
};

export function PermitRequestManagementScreen({ navigation, route }: any) {
  const permit = route?.params?.permit;
  const [submitting, setSubmitting] = useState(false);

  if (!permit) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0B1C30" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Permit Request</Text>
        </View>
        <Text style={styles.empty}>No permit selected. Go back and tap a permit from the list.</Text>
      </SafeAreaView>
    );
  }

  // The eight stages ride on workflow_status, so every decision below reads it.
  const [ws, setWs] = useState(String(permit.workflow_status || 'requested').toLowerCase());
  const meta = STATUS_META[ws] || STATUS_META.requested;

  // Where the permit sits and what is owed, from the backend rather than from
  // this screen. The buttons below already matched the server's gates, but
  // nothing told the supervisor whose step it was — so a permit waiting on the
  // auditor's on-site check looked identical to one waiting on them.
  const [next, setNext] = useState<PermitNextAction | null>(null);

  const loadNext = useCallback(() => {
    permitWorkflowService
      .getNextAction(Number(permit.id))
      .then(setNext)
      .catch(() => setNext(null));
  }, [permit.id]);

  useEffect(() => { loadNext(); }, [loadNext, ws]);

  /**
   * Run one transition and take the server's word for the resulting status.
   *
   * Each of these is gated backend-side — activation only from issued, close
   * only once the work is complete — so the screen never predicts where the
   * permit lands, it reads it back.
   */
  const act = async (
    fn: () => Promise<any>,
    successTitle: string,
    successBody: string,
    goBack = false,
  ) => {
    try {
      setSubmitting(true);
      const updated = await fn();
      const next = String(updated?.workflow_status || '').toLowerCase();
      if (next) setWs(next);
      Alert.alert(successTitle, successBody, [
        { text: 'OK', onPress: goBack ? () => navigation.goBack() : undefined },
      ]);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      const msg = typeof d === 'string' ? d : (d?.message || 'The permit could not be updated.');
      Alert.alert('Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledge = () =>
    act(
      () => permitWorkflowService.acknowledge(Number(permit.id)),
      'Acknowledged',
      'Permit acknowledged and forwarded to the Manager for approval.',
      true,
    );

  const activate = () =>
    act(
      () => permitWorkflowService.activate(Number(permit.id)),
      'Permit active',
      'Work has started under this permit. It is now stage 06 — its controls are being relied on.',
    );

  const suspend = () =>
    Alert.prompt
      ? Alert.prompt('Suspend permit', 'Why is work stopping?', (reason?: string) => {
          if (!reason?.trim()) return;
          act(
            () => permitWorkflowService.suspend(Number(permit.id), reason.trim()),
            'Work stopped',
            'The permit is suspended at stage 04 while the cause is established.',
          );
        })
      : // Alert.prompt is iOS-only. On Android a fixed reason is recorded rather
        // than blocking the supervisor from stopping unsafe work.
        act(
          () => permitWorkflowService.suspend(Number(permit.id), 'Suspended from mobile by the supervisor'),
          'Work stopped',
          'The permit is suspended at stage 04 while the cause is established.',
        );

  const resume = () =>
    act(
      () => permitWorkflowService.resume(Number(permit.id)),
      'Work resumed',
      'The permit is live again.',
    );

  const completeWork = () =>
    act(
      () => permitWorkflowService.completeWork(Number(permit.id)),
      'Work complete',
      'The permit is spent and ready for close-out.',
    );

  const closePermit = () =>
    act(
      // The real close payload. This used to pass a bare string, which reached
      // the API as an unparseable body — it only ever appeared to work because
      // a duplicate service declaration hid the mismatch from the compiler.
      () => permitWorkflowService.close(Number(permit.id), {
        deviation_reported: 'No',
        incident_occurred: 'No',
        supervisor_notes: 'Closed out from mobile.',
      }),
      'Permit closed',
      'This permit has been closed out.',
      true,
    );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Permit Request</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.statusBanner, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <View style={styles.card}>
          {next?.next_action ? (
            <View style={styles.nextBox}>
              <Text style={styles.hereLabel}>
                YOU ARE HERE · {String(next.stage_number ?? '').padStart(2, '0')} {next.stage}
              </Text>
              <Text style={styles.nextAction}>{next.next_action.action}</Text>
              <Text style={styles.nextDetail}>{next.next_action.detail}</Text>
              <Text style={styles.waiting}>
                {next.is_mine
                  ? 'Waiting on you'
                  : `Waiting on the ${next.next_action.owner_role.replace(/_/g, ' ')}`}
                {next.next_action.unblocks ? ` → ${next.next_action.unblocks}` : ''}
              </Text>
            </View>
          ) : next ? (
            <Text style={styles.doneNote}>This permit is finished. Nothing is outstanding.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{permit.title || 'Permit to Work'}</Text>
          <Text style={styles.ref}>{permit.permit_ref}</Text>

          <View style={styles.row}><Ionicons name="pin-outline" size={15} color="#737686" /><Text style={styles.meta}>{permit.location || 'Site'}</Text></View>
          <View style={styles.row}><Ionicons name="person-outline" size={15} color="#737686" /><Text style={styles.meta}>Requested by {permit.requestor || '—'}</Text></View>
          <View style={styles.row}><Ionicons name="time-outline" size={15} color="#737686" /><Text style={styles.meta}>Valid till {permit.validity_end || '—'}</Text></View>
          {!!permit.permit_type && (
            <View style={styles.row}><Ionicons name="document-text-outline" size={15} color="#737686" /><Text style={styles.meta}>{permit.permit_type}</Text></View>
          )}
        </View>

        {/* One action per stage, chosen by the status the server last reported.
            The old screen offered only acknowledge and close, so a permit could
            not be activated, stopped or restarted from the app at all. */}
        {submitting ? (
          <ActivityIndicator color="#0B3D91" style={{ marginTop: 20 }} />
        ) : (
          <>
            {ws === 'requested' && (
              <TouchableOpacity style={styles.ackBtn} onPress={acknowledge} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.ackBtnText}>Acknowledge &amp; Forward to Manager</Text>
              </TouchableOpacity>
            )}

            {ws === 'gate_blocked' && (
              <Text style={styles.doneNote}>
                Blocked by the gate engine. Clear the blocking condition — a missing risk
                assessment, an expired competence — then ask the Manager to approve again.
              </Text>
            )}

            {(ws === 'issued' || ws === 'approved') && (
              <TouchableOpacity style={styles.ackBtn} onPress={activate} activeOpacity={0.85}>
                <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                <Text style={styles.ackBtnText}>Activate — Work Starting</Text>
              </TouchableOpacity>
            )}

            {/* `verified` is live work that has passed an on-site audit check —
                same actions as `active`, or a verified permit would strand with
                no way to complete or stop it. */}
            {(ws === 'active' || ws === 'verified') && (
              <>
                <TouchableOpacity style={styles.ackBtn} onPress={completeWork} activeOpacity={0.85}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.ackBtnText}>Work Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ackBtn, styles.dangerBtn]} onPress={suspend} activeOpacity={0.85}>
                  <Ionicons name="hand-left" size={18} color="#FFFFFF" />
                  <Text style={styles.ackBtnText}>Stop Work — Suspend</Text>
                </TouchableOpacity>
              </>
            )}

            {ws === 'suspended' && (
              <TouchableOpacity style={styles.ackBtn} onPress={resume} activeOpacity={0.85}>
                <Ionicons name="refresh-circle" size={18} color="#FFFFFF" />
                <Text style={styles.ackBtnText}>Cause Established — Resume Work</Text>
              </TouchableOpacity>
            )}

            {/* Both states owe a close-out: `work_complete` is a permit whose
                work is done, `expired` one whose window lapsed while still live.
                They reached the same button through one overloaded status until
                backend migration 067 separated them. */}
            {(ws === 'work_complete' || ws === 'expired') && (
              <TouchableOpacity style={[styles.ackBtn, styles.successBtn]} onPress={closePermit} activeOpacity={0.85}>
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                <Text style={styles.ackBtnText}>Close Out Permit</Text>
              </TouchableOpacity>
            )}

            {['closed', 'rejected', 'cancelled'].includes(ws) && (
              <Text style={styles.doneNote}>This permit is closed. No further action.</Text>
            )}
          </>
        )}
        <Text style={styles.hint}>
          As Supervisor you acknowledge that you have reviewed this request. Final approval is done by the HSE Manager.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  nextBox: { backgroundColor: '#F7F9FE', borderRadius: 10, padding: 12, marginTop: 10 },
  hereLabel: {
    fontSize: 10, fontWeight: '800', color: '#0B3D91',
    letterSpacing: 0.6, marginBottom: 4,
  },
  nextAction: { fontSize: 15, fontWeight: '800', color: '#0B1C30', marginBottom: 3 },
  nextDetail: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  waiting: { fontSize: 11, fontWeight: '800', color: '#334155', marginTop: 8 },
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: '#737686', paddingHorizontal: 30 },
  statusBanner: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  title: { fontSize: 17, fontWeight: '800', color: '#0B1C30' },
  ref: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  meta: { fontSize: 13, color: '#434655', flex: 1 },
  ackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#004AC6', borderRadius: 12, paddingVertical: 15, marginBottom: 10 },
  dangerBtn: { backgroundColor: '#B91C1C' },
  successBtn: { backgroundColor: '#059669' },
  ackBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  doneNote: { textAlign: 'center', color: '#64748B', fontSize: 13, paddingVertical: 12 },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 16, lineHeight: 17, textAlign: 'center' },
});
