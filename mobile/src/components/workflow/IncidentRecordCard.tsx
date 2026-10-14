/**
 * Everything captured about an incident, in one card.
 *
 * Shared by the supervisor's review screen and the manager's approval screen
 * because both are reviewing the same record and both were showing a fraction
 * of it. The supervisor saw four of the reporter's twenty fields; the manager
 * saw the assessment verdict and a set of empty 5-Why boxes and nothing the
 * worker had actually written. Approving an investigation you cannot see is not
 * a review, so the same three blocks now render for both:
 *
 *   1. What the worker reported   — every field on the form, plus the photos
 *   2. What the engine assessed   — P1-P5, HIPO, recurrence, statutory duty
 *   3. What the supervisor found  — RCA, 5 Whys, and the corrective actions
 *
 * Blocks appear only once they have content, so a freshly reported incident
 * shows one block and grows as the workflow fills it in.
 */
import React, { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from '../../constants/config';
import { Icon } from '../../worker/components/display/Icon';
import { VideoPlayer } from '../../worker/components/display/VideoPlayer';

const isVideoFile = (path: string): boolean => {
  if (typeof path !== 'string') return false;
  const p = path.toLowerCase();
  return p.endsWith('.mp4') || p.endsWith('.mov') || p.endsWith('.webm') || p.endsWith('.3gp') || p.endsWith('.mpeg') || p.endsWith('.avi');
};

// Evidence is stored as a server path (/uploads/...), not a full URL, so it
// survives the host changing. The files are mounted at the server root, outside
// the /api/v1 prefix.
const MEDIA_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const absoluteUrl = (p: string) => `${MEDIA_ORIGIN}${p}`;

const TREATMENT_LABEL: Record<string, string> = {
  none: 'No treatment',
  first_aid: 'First aid only',
  medical_treatment: 'Medical treatment',
  hospitalisation: 'Hospitalised / >3 days lost',
  fatality: 'Fatality',
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

// These arrive as booleans or as 0/1 depending on the column type.
const yesNo = (v: unknown) => (v === null || v === undefined ? null : v ? 'Yes' : 'No');

/** JSON columns arrive as a string from some endpoints and an array from others. */
const asArray = (raw: unknown): any[] => {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(v) ? v : [];
};

const joinList = (raw: unknown) => {
  const a = asArray(raw);
  return a.length ? a.join(', ') : null;
};

const fmtGps = (lat?: any, lng?: any) =>
  lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : null;

/** One field. Renders nothing when blank — an empty row and a "No" differ. */
function Row({ label, value }: { label: string; value?: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export function IncidentRecordCard({ incident }: { incident: any }) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!incident) return null;

  const photos = asArray(incident.evidence_json);
  const whys = asArray(incident.five_why_analysis);
  const capas: any[] = incident.capa_actions ?? [];
  const hasInvestigation =
    incident.root_cause || whys.length || capas.length || incident.severity_classification;

  return (
    <View>
      {/* ── 1. What the worker reported ─────────────────────────────────── */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Reported by the worker</Text>
        <Row label="Description" value={incident.description} />
        <Row label="When" value={fmtDateTime(incident.incident_date_time)} />
        <Row label="Location" value={incident.location_station_name} />
        <Row label="Reported by" value={incident.reported_by_name} />
        <Row label="Reported at" value={fmtDateTime(incident.reported_at)} />
        <Row label="Type" value={incident.incident_type} />
        <Row label="Reporter severity" value={incident.severity} />
        <Row label="Immediate cause" value={incident.immediate_cause} />
        <Row label="People involved" value={incident.number_persons_involved} />
        <Row label="Anyone injured" value={incident.anyone_injured} />
        <Row label="Injured person" value={incident.injured_person_name} />
        <Row label="Body part" value={incident.injured_body_part} />
        <Row
          label="Treatment level"
          value={incident.treatment_level ? TREATMENT_LABEL[incident.treatment_level] ?? incident.treatment_level : null}
        />
        <Row label="Dangerous occurrence" value={yesNo(incident.dangerous_occurrence)} />
        <Row label="Could have been fatal" value={yesNo(incident.worst_case_fatal)} />
        <Row label="Linked hazard" value={incident.hazard_name} />
        <Row label="Permit active" value={incident.permit_active} />
        <Row label="Control failure" value={incident.control_failure} />
        <Row label="Hazard still present" value={incident.hazard_still_present} />
        <Row label="Immediate actions" value={incident.immediate_actions_taken} />
        <Row label="Witnesses" value={joinList(incident.witnesses_json)} />
        <Row label="GPS" value={fmtGps(incident.gps_latitude, incident.gps_longitude)} />

        {photos.length > 0 && (
          <>
            <Text style={styles.subTitle}>Evidence photos/videos</Text>
            <View style={styles.photoRow}>
              {photos.map((p: string, i: number) =>
                // Uploaded evidence is a /uploads/ path. Older records hold a
                // bare filename from when the reporter's photo button was a
                // mock — nothing is behind those, so they stay as a label.
                typeof p === 'string' && p.startsWith('/uploads/') ? (
                  isVideoFile(p) ? (
                    <TouchableOpacity key={i} onPress={() => setPreview(absoluteUrl(p))}>
                      <View style={[styles.thumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }]}>
                        <Icon name="video" size={24} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity key={i} onPress={() => setPreview(absoluteUrl(p))}>
                      <Image source={{ uri: absoluteUrl(p) }} style={styles.thumb} />
                    </TouchableOpacity>
                  )
                ) : (
                  <Text key={i} style={styles.fileTag}>📎 {String(p)}</Text>
                ),
              )}
            </View>
          </>
        )}
      </View>

      {/* ── 2. What the engine assessed ─────────────────────────────────── */}
      {(incident.severity_label || incident.statutory_reportable) && (
        <View style={[styles.block, styles.assessBlock]}>
          <Text style={styles.blockTitle}>Assessment</Text>
          <Row label="Assessed severity" value={incident.severity_label} />
          <Row label="Investigation due" value={fmtDateTime(incident.investigation_due_at)} />
          <Row label="Min investigator" value={incident.min_investigator} />
          {!!incident.is_hipo && <Text style={styles.flag}>HIPO — high potential incident</Text>}
          {!!incident.is_recurring_pattern && (
            <Text style={styles.flag}>Recurring pattern in the last 12 months</Text>
          )}
          {!!incident.requires_systemic_rca && (
            <Text style={styles.flag}>Systemic root cause required</Text>
          )}
          {!!incident.statutory_reportable && (
            <Text style={styles.alert}>
              Statutory notification required
              {incident.statutory_regulator ? ` — ${incident.statutory_regulator}` : ''}
              {incident.statutory_due_at ? ` by ${fmtDateTime(incident.statutory_due_at)}` : ''}
              {incident.statutory_authorised_at ? ' · authorised' : ' · NOT YET AUTHORISED'}
            </Text>
          )}
        </View>
      )}

      {/* ── 3. What the supervisor found ────────────────────────────────── */}
      {hasInvestigation && (
        <View style={[styles.block, styles.investigationBlock]}>
          <Text style={styles.blockTitle}>Supervisor's investigation</Text>
          <Row label="Investigator" value={incident.supervisor_name} />
          <Row label="Classification" value={incident.severity_classification} />
          <Row label="Root cause" value={incident.root_cause} />
          <Row label="Root cause category" value={incident.root_cause_category} />
          <Row label="Days away" value={incident.days_away} />
          <Row label="Completed" value={fmtDateTime(incident.investigation_completed_at)} />
          <Row label="Signed off by" value={incident.supervisor_signature} />

          {whys.length > 0 && (
            <>
              <Text style={styles.subTitle}>5 Whys</Text>
              {whys.map((w: any, i: number) => {
                const answer = typeof w === 'string' ? w : w?.answer;
                if (!answer) return null;
                return (
                  <Text key={i} style={styles.why}>
                    {i + 1}. {answer}
                  </Text>
                );
              })}
            </>
          )}

          {capas.length > 0 && (
            <>
              <Text style={styles.subTitle}>Corrective actions (CAPA)</Text>
              {capas.map((c) => (
                <View key={c.id} style={styles.capa}>
                  <Text style={styles.capaDesc}>{c.description || 'No description'}</Text>
                  <Row label="Owner" value={c.responsible_person_name} />
                  <Row label="Due" value={c.due_date} />
                  <Row label="Priority" value={c.priority_band ?? c.capa_type_label} />
                  <Row label="Status" value={c.status} />
                  <Row label="Evidence required" value={c.evidence_required} />
                  <Row label="Effectiveness" value={c.effectiveness_rating} />
                </View>
              ))}
            </>
          )}
        </View>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPreview(null)}>
          {!!preview && (
            isVideoFile(preview) ? (
              <View style={{ width: '90%', height: '80%', justifyContent: 'center', alignSelf: 'center' }} onStartShouldSetResponder={() => true}onTouchEnd={(e) => e.stopPropagation()}>
                <VideoPlayer uri={preview} />
              </View>
            ) : (
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />
            )
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  assessBlock: { backgroundColor: '#F8FAFC' },
  investigationBlock: { borderColor: '#BFDBFE' },
  blockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B3D91',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subTitle: { fontSize: 11, fontWeight: '800', color: '#475569', marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, alignItems: 'flex-start' },
  rowLabel: { width: 132, fontSize: 12, color: '#64748B', fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 12, color: '#0B1C30', fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  thumb: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#E2E8F0' },
  fileTag: {
    backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 11, color: '#334155', fontWeight: '600',
  },
  why: { fontSize: 12, color: '#0B1C30', marginBottom: 3, lineHeight: 17 },
  capa: {
    borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 8,
  },
  capaDesc: { fontSize: 12, fontWeight: '700', color: '#0B1C30', marginBottom: 4 },
  flag: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#C2410C' },
  alert: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#B91C1C' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: '100%', height: '80%' },
});
