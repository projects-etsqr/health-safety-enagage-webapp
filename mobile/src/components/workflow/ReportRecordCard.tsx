/**
 * Everything captured about a near miss, unsafe act or risk report, in one card.
 *
 * The third sibling of IncidentRecordCard and HazardRecordCard, and the reason
 * it is one component rather than three: these families run on the same eight
 * stages, the same table shape and the same factory-built endpoints. Only the
 * handful of columns each declares in `detail_fields` differs, and those render
 * from the `details` dict rather than from three hand-written blocks — so a
 * column added there appears here without another edit.
 *
 * Eight blocks, in the order the record is filled in. Each renders only once it
 * has content, so a risk reported this morning shows two and grows from there.
 */
import React, { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from '../../constants/config';
import { Icon } from '../../worker/components/display/Icon';
import { VideoPlayer } from '../../worker/components/display/VideoPlayer';
import type { ReportDetail } from '../../services/reportWorkflowService';

// Evidence is stored as a server path (/uploads/...), not a full URL, so it
// survives the host changing. Files are mounted at the root, outside /api/v1.
const MEDIA_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const absoluteUrl = (p: string) => `${MEDIA_ORIGIN}${p}`;

const isVideoFile = (path: string): boolean => {
  if (typeof path !== 'string') return false;
  const p = path.toLowerCase();
  return ['.mp4', '.mov', '.webm', '.3gp', '.mpeg', '.avi'].some(e => p.endsWith(e));
};

/** JSON columns arrive as a string from some endpoints and an array from others. */
const asArray = (raw: unknown): any[] => {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(v) ? v : [];
};

/** The 5 Whys are stored two ways: the investigate form posts
 *  {"whys": [...]} and older rows hold a bare list. Both mean the same five
 *  lines, so both are read rather than one of them rendering as nothing. */
const asWhys = (raw: unknown): any[] => {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const inner = (v as any).whys;
    if (Array.isArray(inner)) return inner;
    // {"why_1": "...", "why_2": "..."} — ordered by key so the chain reads
    // in the order it was asked.
    return Object.keys(v as any).sort().map(k => (v as any)[k]);
  }
  return [];
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

/** Column names reach this screen as they sit in the database. A supervisor
 *  should read "Potential consequence", not "potential_consequence". */
const humanise = (key: string) => {
  const w = key.replace(/_/g, ' ').trim();
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/** Values arrive as snake_case enums, 0/1 flags and MySQL 'Yes'/'No' strings. */
function prettyValue(value: any, key = ''): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // The column type cannot tell a flag from a count — uplift_total is an
  // integer too — so the name decides which 0/1 reads as a yes or no.
  if ((value === 0 || value === 1) && /^(blocks|is|has|requires|was|uplift_)/.test(key)) {
    return value === 1 ? 'Yes' : 'No';
  }
  const t = String(value).replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const witnessName = (w: any) =>
  typeof w === 'string' ? w : w?.name || (w?.employee_id ? `EMP-${w.employee_id}` : null);

/** One field. Renders nothing when blank — an absent answer and a "No" differ. */
function Row({ label, value }: { label: string; value?: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export function ReportRecordCard({ report }: { report: ReportDetail | any }) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!report) return null;

  const r = report;
  // The family's own columns. Ids are dropped — the reader wants the hazard,
  // not hazard_id, and the resolved name is rendered elsewhere when there is
  // one. Empty values are dropped so a sparse family shows a short block
  // rather than a column of dashes.
  const own = Object.entries(r.details ?? {}).filter(
    ([k, v]) => v !== null && v !== undefined && v !== '' && !k.endsWith('_id'),
  );
  const evidence = asArray(r.evidence);
  const witnesses = asArray(r.witnesses).map(witnessName).filter(Boolean);
  const whys = asWhys(r.five_why_analysis);

  const hasAssessment = r.assessed_priority || r.assessed_label || r.is_hipo;
  const hasInvestigation =
    r.root_cause || r.immediate_actions_taken || whys.length || r.investigation_started_at;
  const hasEscalation = r.escalated_at || r.escalation_reason || r.escalated_to_manager_name;
  const hasClosure = r.closure_notes || r.lessons_learned || r.closed_at || r.approved_at;
  const hasVerification =
    r.capa_verified_at || r.auditor_verified_at || r.verification_result || r.verification_notes;

  return (
    <View>
      {/* ── 0. The record itself ──────────────────────────────────────────── */}
      <View style={[styles.block, styles.quietBlock]}>
        <Text style={styles.blockTitle}>Record</Text>
        <Row
          label="Stage"
          value={
            r.stage_label
              ? `${r.stage_number ?? '?'} of ${r.total_stages ?? 8} — ${r.stage_label}`
              : null
          }
        />
        <Row label="Status" value={prettyValue(r.workflow_status)} />
        <Row label="Report date" value={r.report_date} />
        <Row label="Created" value={fmtDateTime(r.created_at)} />
        <Row label="Last updated" value={fmtDateTime(r.updated_at)} />
      </View>

      {/* ── 1. Reported ───────────────────────────────────────────────────── */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Reported by the worker</Text>
        <Row label="Description" value={r.description} />
        <Row label="Reported by" value={r.reported_by_name} />
        <Row label="When it happened" value={fmtDateTime(r.observed_at)} />
        <Row label="Reported at" value={fmtDateTime(r.reported_at)} />
        {/* One or the other, never both: the free text is kept only when what
            the worker typed matched no station on record. */}
        <Row label="Where" value={r.station_name} />
        <Row label="Reporter severity" value={prettyValue(r.severity)} />
        <Row label="Still there now" value={r.hazard_still_present} />
        <Row label="Witnesses" value={witnesses.length ? witnesses.join(', ') : null} />
        <Row
          label="GPS"
          value={
            r.gps_latitude != null && r.gps_longitude != null
              ? `${Number(r.gps_latitude).toFixed(5)}, ${Number(r.gps_longitude).toFixed(5)}`
              : null
          }
        />
        {own.map(([k, v]) => (
          <Row key={k} label={humanise(k)} value={prettyValue(v, k)} />
        ))}

        {evidence.length > 0 && (
          <>
            <Text style={styles.subTitle}>Photos and video</Text>
            <View style={styles.photoRow}>
              {evidence.map((p: string, i: number) =>
                // Uploaded evidence is a /uploads/ path. Older records hold a
                // bare filename from when the photo button was a mock —
                // nothing is behind those, so they stay as a label.
                typeof p === 'string' && p.startsWith('/uploads/') ? (
                  <TouchableOpacity key={i} onPress={() => setPreview(absoluteUrl(p))}>
                    {isVideoFile(p) ? (
                      <View style={[styles.thumb, styles.videoThumb]}>
                        <Icon name="video" size={24} color="#FFFFFF" />
                      </View>
                    ) : (
                      <Image source={{ uri: absoluteUrl(p) }} style={styles.thumb} />
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text key={i} style={styles.fileTag}>📎 {String(p)}</Text>
                ),
              )}
            </View>
          </>
        )}
      </View>

      {/* ── 2. Assessment ─────────────────────────────────────────────────── */}
      {!!hasAssessment && (
        <View style={[styles.block, styles.quietBlock]}>
          <Text style={styles.blockTitle}>Assessment</Text>
          <Row label="Priority" value={r.assessed_priority} />
          <Row label="Assessed as" value={r.assessed_label} />
          <Row label="Assessed at" value={fmtDateTime(r.assessed_at)} />
          <Row label="Response due" value={fmtDateTime(r.response_due_at)} />
          <Row label="Min investigator" value={r.min_investigator} />
          <Row label="How it was scored" value={r.assessment_trace} />
          {!!r.is_hipo && <Text style={styles.flag}>HIPO — high potential event</Text>}
          {!!r.is_recurring_pattern && (
            <Text style={styles.flag}>Recurring — this has happened here before</Text>
          )}
          {!!r.requires_systemic_rca && (
            <Text style={styles.alert}>Systemic root cause analysis required</Text>
          )}
        </View>
      )}

      {/* ── 3. Investigation ──────────────────────────────────────────────── */}
      {!!hasInvestigation && (
        <View style={[styles.block, styles.investigationBlock]}>
          <Text style={styles.blockTitle}>Investigation</Text>
          <Row label="Investigator" value={r.assigned_supervisor_name} />
          <Row label="Acknowledged" value={fmtDateTime(r.acknowledged_at)} />
          <Row label="Started" value={fmtDateTime(r.investigation_started_at)} />
          <Row label="Root cause" value={r.root_cause} />
          <Row label="Done straight away" value={r.immediate_actions_taken} />
          {whys.length > 0 && (
            <>
              <Text style={styles.subTitle}>5 Whys</Text>
              {whys.map((w: any, i: number) => (
                <Text key={i} style={styles.why}>
                  {i + 1}. {typeof w === 'string' ? w : w?.answer ?? JSON.stringify(w)}
                </Text>
              ))}
            </>
          )}
          <Row label="Completed" value={fmtDateTime(r.investigation_completed_at)} />
          <Row label="Signed off by" value={r.supervisor_signature} />
        </View>
      )}

      {/* ── 4. Escalation ─────────────────────────────────────────────────── */}
      {!!hasEscalation && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Escalation</Text>
          <Row label="Escalated to" value={r.escalated_to_manager_name} />
          <Row label="Escalated at" value={fmtDateTime(r.escalated_at)} />
          <Row label="Reason" value={r.escalation_reason} />
        </View>
      )}

      {/* ── 5. Approval and closure ───────────────────────────────────────── */}
      {!!hasClosure && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Approval and closure</Text>
          <Row label="Approved at" value={fmtDateTime(r.approved_at)} />
          <Row label="Lesson learned" value={r.lessons_learned} />
          <Row label="Closure notes" value={r.closure_notes} />
          <Row label="Closed at" value={fmtDateTime(r.closed_at)} />
          <Row label="Signed off by" value={r.manager_signature} />
        </View>
      )}

      {/* ── 6. Verification ───────────────────────────────────────────────── */}
      {!!hasVerification && (
        <View style={[styles.block, styles.quietBlock]}>
          <Text style={styles.blockTitle}>Verification</Text>
          <Row label="Actions verified by" value={r.capa_verified_by_name} />
          <Row label="Verified at" value={fmtDateTime(r.capa_verified_at)} />
          <Row label="Notes" value={r.capa_verification_notes} />
          {/* A failed verification sent the record back a stage. The count is
              the honest record of that, in front of whoever signs next. */}
          {!!r.capa_verification_failures && (
            <Text style={styles.alert}>
              Failed verification {r.capa_verification_failures}{' '}
              {r.capa_verification_failures === 1 ? 'time' : 'times'}
            </Text>
          )}
          <Row label="Auditor" value={r.auditor_verified_by_name} />
          <Row label="Auditor checked" value={fmtDateTime(r.auditor_verified_at)} />
          <Row label="Result" value={prettyValue(r.verification_result)} />
          <Row label="Auditor notes" value={r.verification_notes} />
        </View>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPreview(null)}>
          {!!preview &&
            (isVideoFile(preview) ? (
              <View
                style={styles.videoWrap}
                onStartShouldSetResponder={() => true}
                onTouchEnd={e => e.stopPropagation()}
              >
                <VideoPlayer uri={preview} />
              </View>
            ) : (
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />
            ))}
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
  quietBlock: { backgroundColor: '#F8FAFC' },
  investigationBlock: { borderColor: '#BFDBFE' },
  blockTitle: {
    fontSize: 12, fontWeight: '800', color: '#0B3D91',
    letterSpacing: 0.3, marginBottom: 8,
  },
  subTitle: { fontSize: 11, fontWeight: '800', color: '#475569', marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, alignItems: 'flex-start' },
  rowLabel: { width: 132, fontSize: 12, color: '#64748B', fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 12, color: '#0B1C30', fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  thumb: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#E2E8F0' },
  videoThumb: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  fileTag: {
    backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 11, color: '#334155', fontWeight: '600',
  },
  why: { fontSize: 12, color: '#0B1C30', marginBottom: 3, lineHeight: 17 },
  flag: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#C2410C' },
  alert: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#B91C1C' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  videoWrap: { width: '90%', height: '80%', justifyContent: 'center', alignSelf: 'center' },
  previewImg: { width: '100%', height: '80%' },
});
