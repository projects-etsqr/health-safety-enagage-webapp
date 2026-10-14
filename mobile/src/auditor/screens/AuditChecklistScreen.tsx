/**
 * Steps 05-07 · the walk. One item per screen, swipe to move.
 *
 *   05 FIELD INSPECTION   score the item where you are standing
 *   06 EVIDENCE           photo, scan, interview or note, tied to this line
 *   07 CLASSIFY           the classification the auditor assigns
 *
 * All three happen on the same card because they happen at the same moment. The
 * spec is explicit that observations are "logged live on the app — no paper, no
 * writing up afterwards", and splitting scoring from evidence from
 * classification would recreate the writing-up step in the interface.
 *
 * Offline: every answer is held locally the instant it is tapped. When there is
 * signal the answer also goes up immediately, because that is what returns the
 * running score and fires the critical-item alert while work can still be
 * suspended. When there is not, the answer stays marked unsent and the whole set
 * is carried up by the classify call at the end — which is queued, so the walk
 * completes with no signal at all.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Image, Modal, KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { ensureCameraPermission, reportPickerError } from '../../utils/cameraPermission';
import {
  auditService, Audit, ChecklistItem, Classification, CLASSIFICATION_META,
  defaultClassification, Evidence, ItemResponse, bandFor,
} from '../services/auditService';
import { useGeoTag } from '../../worker/hooks/useGeoTag';
import {
  Banner, C, ClassificationChip, PrimaryButton, ResponseSelector, ScreenHeader,
} from '../components';

const { width: SCREEN_W } = Dimensions.get('window');

type LocalItem = ChecklistItem & { unsent?: boolean; isRepeat?: boolean };

const CLASSES: Classification[] = ['conformance', 'observation', 'minor_nc', 'major_nc', 'critical'];

export function AuditChecklistScreen({ route, navigation }: any) {
  const auditId: number = route.params?.auditId ?? route.params?.audit?.id;
  const [audit, setAudit] = useState<Audit | null>(route.params?.audit ?? null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<{ score: number; band: string } | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<LocalItem | null>(null);
  const [scanFor, setScanFor] = useState<LocalItem | null>(null);
  const [scanRef, setScanRef] = useState('');
  const [busy, setBusy] = useState(false);

  const scroller = useRef<ScrollView>(null);
  const { geo } = useGeoTag();

  const load = useCallback(async () => {
    try {
      const [a, ev] = await Promise.all([
        auditService.get(auditId),
        auditService.listEvidence(auditId).catch(() => [] as Evidence[]),
      ]);
      setAudit(a);
      setItems(a.findings as LocalItem[]);
      setEvidence(ev);
      if (a.compliance_score != null) {
        setRunning({ score: a.compliance_score, band: bandFor(a.compliance_score) });
      }
      // Open on the first unanswered item — resuming a walk should not make the
      // auditor swipe back through everything they already did.
      const firstOpen = a.findings.findIndex((i) => !i.response);
      if (firstOpen > 0) {
        setIndex(firstOpen);
        requestAnimationFrame(() => scroller.current?.scrollTo({ x: firstOpen * SCREEN_W, animated: false }));
      }
    } catch (e: any) {
      Alert.alert('Could not load the checklist', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => { load(); auditService.loadReference(); }, [load]);

  const answered = items.filter((i) => !!i.response).length;
  const unsent = items.filter((i) => i.unsent).length;
  const locked = !!audit?.findings_locked;

  const patch = (id: number, next: Partial<LocalItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));

  // ── Step 05 · answer ──────────────────────────────────────────────────────
  const answer = async (item: LocalItem, response: ItemResponse) => {
    const suggested = defaultClassification(response, item.is_critical);
    // Applied locally first, so the card responds to the tap even with no signal.
    patch(item.id, { response, classification: suggested, unsent: true });

    try {
      const res = await auditService.respond(auditId, item.id, {
        response,
        remarks: item.remarks ?? undefined,
        classification: suggested ?? undefined,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
      });
      patch(item.id, {
        ...res.item, unsent: false, isRepeat: res.is_repeat,
      });
      setRunning({ score: res.running_score, band: res.running_band });
      if (res.alert) setAlertText(res.alert);
    } catch (e: any) {
      // A 4xx is a real refusal and must not be silently kept as unsent.
      if (e?.response) {
        patch(item.id, { response: item.response, classification: item.classification, unsent: false });
        Alert.alert('Not accepted', e.response.data?.detail ?? 'The server refused this answer.');
      }
      // Anything else is "no signal": the answer stays, marked unsent, and the
      // classify call at the end carries it up.
    }
  };

  const setClassification = (item: LocalItem, c: Classification) => {
    // A critical item that scored zero cannot be softened below Major NC — that
    // is the whole reason the item is marked critical. The auditor may escalate.
    if (item.is_critical && item.response === 'none' &&
        CLASSIFICATION_META[c].severity < CLASSIFICATION_META.major_nc.severity) {
      Alert.alert(
        'This is a critical item',
        'A critical item scoring zero is a Major non-conformance at minimum. You can escalate it to Critical, but not below.',
      );
      return;
    }
    patch(item.id, { classification: c, unsent: true });
  };

  // ── Step 06 · evidence in situ ────────────────────────────────────────────
  /**
   * A photo or a video, from the camera or the library.
   *
   * Video was the missing half. Some findings cannot be photographed — a guard
   * that rattles, an alarm that does not sound, a task performed the wrong way —
   * and the auditor's only options were a still image or a written note that
   * asks the reader to take their word for it. The backend has accepted the
   * video content types all along and the upload path allows them; what was
   * missing was a button and a `kind` that says which it is.
   */
  const attachMedia = async (
    item: LocalItem, from: 'camera' | 'gallery', mediaType: 'photo' | 'video',
  ) => {
    // Without this the camera silently did nothing. The app declares CAMERA in
    // its manifest, which makes requesting it the caller's job — see
    // utils/cameraPermission for the whole story.
    if (from === 'camera' && !(await ensureCameraPermission('attach audit evidence'))) return;

    const res = from === 'camera'
      ? await launchCamera({
          mediaType,
          saveToPhotos: false,
          ...(mediaType === 'video'
            // A minute is enough to show a control failing, and keeps the upload
            // inside the 100 MB the server accepts on a site connection.
            // 'medium' rather than 'high' for the same reason — a 4K minute is
            // not more evidential than a 720p one, it is just slower to send.
            ? { videoQuality: 'medium' as const, durationLimit: 60 }
            : { quality: 0.8 as const }),
        })
      // 'mixed', so a clip already filmed on this walk can be attached. Asking
      // the library for 'photo' meant the video the auditor had just recorded
      // was not even offered.
      : await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1 });
    if (res.didCancel) return;
    // Was `if (res.didCancel || res.errorCode) return;` — a refusal and a
    // deliberate cancel took the same silent path, so a denied permission was
    // indistinguishable from a dead button.
    if (res.errorCode) {
      return reportPickerError(
        from === 'camera' ? 'Camera' : 'Gallery',
        res.errorCode,
        res.errorMessage,
      );
    }
    const asset: Asset | undefined = res.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Nothing captured', 'No file came back. Please try again.');
      return;
    }

    // Read from what actually came back, not from what was asked for: the
    // gallery is 'mixed' and hands back whichever the auditor picked. Some
    // Android providers return no `type` at all, hence the extension fallback.
    const isVideo = Boolean(
      asset.type?.startsWith('video/')
      || /\.(mp4|mov|3gp|webm)$/i.test(asset.uri)
      || (!asset.type && mediaType === 'video'),
    );

    const photo = {
      uri: asset.uri,
      name: asset.fileName
        || `audit_${auditId}_${item.id}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      type: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    };

    setBusy(true);
    try {
      // Online: upload the file, then attach the URL. Offline: the whole thing
      // is queued as multipart and the file is rebuilt from the device at flush.
      let fileUrl: string | undefined;
      try {
        fileUrl = await auditService.uploadEvidenceFile(auditId, photo);
      } catch { fileUrl = undefined; }

      const out = await auditService.addEvidence(auditId, {
        checklist_item_id: item.id,
        kind: isVideo ? 'video' : 'photo',
        file_url: fileUrl,
        caption: item.title,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
        captured_at: new Date().toISOString(),
      }, fileUrl ? undefined : photo);

      if (out.queued) {
        Alert.alert(
          'Saved offline',
          `The ${isVideo ? 'video' : 'photo'} is on the device and will upload when you have signal.`,
        );
      } else if (out.data) {
        setEvidence((prev) => [...prev, out.data as Evidence]);
      }
      patch(item.id, { evidence_count: (item.evidence_count || 0) + 1 });
    } catch (e: any) {
      Alert.alert(
        `Could not attach the ${isVideo ? 'video' : 'photo'}`,
        e?.response?.data?.detail ?? 'Please try again.',
      );
    } finally {
      setBusy(false);
      setEvidenceFor(null);
    }
  };

  const attachSimple = async (
    item: LocalItem, kind: Evidence['kind'], body: Partial<Evidence> & { caption?: string },
  ) => {
    setBusy(true);
    try {
      const out = await auditService.addEvidence(auditId, {
        checklist_item_id: item.id,
        kind,
        caption: body.caption,
        scanned_ref: body.scanned_ref ?? undefined,
        subject_name: body.subject_name ?? undefined,
        interview_prompt: body.interview_prompt ?? undefined,
        competence_verified: body.competence_verified ?? undefined,
        gps_latitude: geo.gps_latitude,
        gps_longitude: geo.gps_longitude,
        captured_at: new Date().toISOString(),
      });
      if (out.queued) Alert.alert('Saved offline', 'It will sync when you have signal.');
      else if (out.data) setEvidence((prev) => [...prev, out.data as Evidence]);
      patch(item.id, { evidence_count: (item.evidence_count || 0) + 1 });
    } catch (e: any) {
      Alert.alert('Could not attach', e?.response?.data?.detail ?? 'Please try again.');
    } finally {
      setBusy(false);
      setEvidenceFor(null);
    }
  };

  const evidenceOf = (itemId: number) => evidence.filter((e) => e.checklist_item_id === itemId);

  // ── Step 07 · hand over to the review ─────────────────────────────────────
  const toReview = () => {
    const missing = items.filter((i) => !i.response);
    if (missing.length) {
      Alert.alert(
        `${missing.length} item${missing.length > 1 ? 's' : ''} unanswered`,
        `Every item needs a score or Not Applicable. The first is "${missing[0].title}".`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to it',
            onPress: () => {
              const at = items.findIndex((i) => i.id === missing[0].id);
              setIndex(at);
              scroller.current?.scrollTo({ x: at * SCREEN_W, animated: true });
            },
          },
        ],
      );
      return;
    }
    navigation.navigate('ReviewFindings', {
      auditId,
      audit,
      // Carried across so the review can post the whole set in one go — this is
      // the path that lets a walk done entirely offline reach the server.
      pendingItems: items.map((i) => ({
        id: i.id, response: i.response, remarks: i.remarks, classification: i.classification,
        gps_latitude: i.gps_latitude, gps_longitude: i.gps_longitude,
      })),
    });
  };

  const goTo = (n: number) => {
    const at = Math.max(0, Math.min(items.length - 1, n));
    setIndex(at);
    scroller.current?.scrollTo({ x: at * SCREEN_W, animated: true });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Field inspection" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Field inspection"
        subtitle={`Step 05 · ${audit?.site_name ?? ''}`}
        onBack={() => navigation.goBack()}
        right={
          running ? (
            <View style={styles.runningPill}>
              <Text style={styles.runningScore}>{Math.round(running.score)}%</Text>
              <Text style={styles.runningBand}>{running.band}</Text>
            </View>
          ) : null
        }
      />

      {/* Progress across the checklist */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${items.length ? (answered / items.length) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {answered} of {items.length} answered
          {unsent > 0 ? ` · ${unsent} waiting to sync` : ''}
        </Text>
      </View>

      {locked && (
        <View style={{ paddingHorizontal: 16 }}>
          <Banner
            tone="warn" icon="lock-closed"
            title="Findings are locked"
            text="The closing meeting is done. Answers can only change through a formal amendment."
          />
        </View>
      )}

      {/* One item per screen */}
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => {
          const ev = evidenceOf(item.id);
          const owesEvidence = (item.response === 'none' || item.response === 'partial') && ev.length === 0;
          return (
            <KeyboardAvoidingView
              key={item.id}
              style={{ width: SCREEN_W }}
              behavior={KEYBOARD_BEHAVIOR}
            >
              <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.itemHead}>
                  <Text style={styles.section}>{item.section || 'General'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {item.is_critical && (
                      <View style={styles.criticalTag}>
                        <Ionicons name="alert" size={10} color="#FFFFFF" />
                        <Text style={styles.criticalTagText}>CRITICAL ITEM</Text>
                      </View>
                    )}
                    {!!item.clause && (
                      <View style={styles.clauseTag}><Text style={styles.clauseTagText}>{item.clause}</Text></View>
                    )}
                  </View>
                </View>

                <Text style={styles.title}>{item.title}</Text>
                {!!item.question && <Text style={styles.question}>{item.question}</Text>}

                {item.is_critical && (
                  <Text style={styles.criticalNote}>
                    Scoring zero here is an automatic Major non-conformance and alerts the Safety
                    Manager immediately. Work may be suspended on the spot.
                  </Text>
                )}

                {/* 05 · score */}
                <Text style={styles.label}>Score</Text>
                <ResponseSelector
                  value={item.response}
                  onChange={(r) => answer(item, r)}
                  disabled={locked}
                />

                {/* 07 · classification */}
                {!!item.response && item.response !== 'na' && (
                  <>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Classification</Text>
                      {item.isRepeat && (
                        <View style={styles.repeatFlag}>
                          <Ionicons name="repeat" size={10} color="#7C2D12" />
                          <Text style={styles.repeatFlagText}>REPEAT FINDING</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.classRow}>
                      {CLASSES.map((c) => {
                        const m = CLASSIFICATION_META[c];
                        const on = item.classification === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.classBtn, on && { backgroundColor: m.bg, borderColor: m.color }]}
                            onPress={() => !locked && setClassification(item, c)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.classBtnText, on && { color: m.color }]}>{m.short}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.classHint}>
                      {item.classification
                        ? CLASSIFICATION_META[item.classification].label + ' — the app suggests, you decide.'
                        : 'Pick the classification.'}
                    </Text>
                  </>
                )}

                {/* Observation text */}
                <Text style={styles.label}>Observation</Text>
                <TextInput
                  style={styles.remarks}
                  value={item.remarks ?? ''}
                  onChangeText={(t) => patch(item.id, { remarks: t, unsent: true })}
                  editable={!locked}
                  multiline
                  placeholder="What you actually saw — not what the procedure says."
                  placeholderTextColor={C.light}
                />
                <Text style={styles.dictHint}>
                  Tip: use your keyboard's dictation key — hands are often gloved or occupied.
                </Text>

                {/* 06 · evidence */}
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Evidence ({ev.length})</Text>
                  {owesEvidence && <Text style={styles.owed}>Evidence owed</Text>}
                </View>

                {ev.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} keyboardShouldPersistTaps="handled">
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {ev.map((e) => (
                        <View key={e.id} style={styles.evCard}>
                          {e.kind === 'photo' && e.file_url ? (
                            <Image source={{ uri: e.file_url }} style={styles.evThumb} />
                          ) : (
                            <View style={styles.evIcon}>
                              <Ionicons
                                name={
                                  e.kind === 'video' ? 'videocam'
                                    : e.kind === 'scan' ? 'qr-code'
                                      : e.kind === 'interview' ? 'chatbubbles'
                                        : e.kind === 'document' ? 'document-text' : 'create'
                                }
                                size={18}
                                color={C.brand}
                              />
                            </View>
                          )}
                          <Text style={styles.evKind}>{e.kind}</Text>
                          {!!e.scanned_ref && <Text style={styles.evRef} numberOfLines={1}>{e.scanned_ref}</Text>}
                          {!!e.subject_name && <Text style={styles.evRef} numberOfLines={1}>{e.subject_name}</Text>}
                          {e.gps_latitude != null && (
                            <View style={styles.evGps}>
                              <Ionicons name="location" size={8} color="#047857" />
                              <Text style={styles.evGpsText}>GPS</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}

                {!locked && (
                  <TouchableOpacity
                    style={[styles.addEvidence, owesEvidence && styles.addEvidenceOwed]}
                    onPress={() => setEvidenceFor(item)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera" size={17} color={owesEvidence ? '#B45309' : C.brand} />
                    <Text style={[styles.addEvidenceText, owesEvidence && { color: '#B45309' }]}>
                      Capture evidence
                    </Text>
                  </TouchableOpacity>
                )}

                {geo.gps_latitude != null && (
                  <View style={styles.gpsRow}>
                    <Ionicons name="location" size={12} color="#047857" />
                    <Text style={styles.gpsText}>
                      Every answer on this walk is stamped at {geo.gps_latitude.toFixed(4)}, {geo.gps_longitude?.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={{ height: 90 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          );
        })}
      </ScrollView>

      {/* Swipe navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => goTo(index - 1)} disabled={index === 0}>
          <Ionicons name="chevron-back" size={20} color={index === 0 ? '#CBD5E1' : C.ink} />
        </TouchableOpacity>

        <View style={styles.dots}>
          {items.map((i, n) => (
            <TouchableOpacity
              key={i.id}
              onPress={() => goTo(n)}
              style={[
                styles.dot,
                n === index && styles.dotActive,
                !!i.response && n !== index && styles.dotDone,
                i.unsent && styles.dotUnsent,
              ]}
            />
          ))}
        </View>

        {index === items.length - 1 ? (
          <TouchableOpacity style={styles.reviewBtn} onPress={toReview}>
            <Text style={styles.reviewBtnText}>Review</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={() => goTo(index + 1)}>
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
        )}
      </View>

      {/* Critical item alert — the escalation has already gone out */}
      <Modal visible={!!alertText} transparent animationType="fade" onRequestClose={() => setAlertText(null)}>
        <View style={styles.modalBg}>
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Ionicons name="alert" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.alertTitle}>Critical finding</Text>
            <Text style={styles.alertText}>{alertText}</Text>
            <PrimaryButton
              label="Understood — the unsafe act is contained"
              tone="danger"
              onPress={async () => {
                setAlertText(null);
                try {
                  const a = await auditService.resume(auditId);
                  setAudit(a);
                } catch { /* the walk continues either way */ }
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Evidence sheet */}
      <Modal visible={!!evidenceFor} transparent animationType="slide" onRequestClose={() => setEvidenceFor(null)}>
        <View style={styles.sheetBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Evidence for “{evidenceFor?.title}”</Text>
            <Text style={styles.sheetSub}>Attached to this checklist line, not to a general folder.</Text>

            {busy ? (
              <ActivityIndicator color={C.brand} style={{ marginVertical: 26 }} />
            ) : (
              <>
                <SheetRow
                  icon="camera" title="Take a photo"
                  sub="GPS-stamped, linked to this item"
                  onPress={() => evidenceFor && attachMedia(evidenceFor, 'camera', 'photo')}
                />
                <SheetRow
                  icon="videocam" title="Record a video"
                  sub="For what a still cannot show — a guard rattling, an alarm not sounding"
                  onPress={() => evidenceFor && attachMedia(evidenceFor, 'camera', 'video')}
                />
                <SheetRow
                  icon="images" title="Choose from gallery"
                  sub="A photo or video already taken on this walk"
                  onPress={() => evidenceFor && attachMedia(evidenceFor, 'gallery', 'photo')}
                />
                <SheetRow
                  icon="qr-code" title="Asset, permit or vehicle reference"
                  sub="Identify equipment without typing a description"
                  onPress={() => {
                    // Not Alert.prompt — that is iOS-only, and on Android it
                    // silently does nothing, which is the worst of both.
                    setScanFor(evidenceFor);
                    setEvidenceFor(null);
                  }}
                />
                <SheetRow
                  icon="chatbubbles" title="Worker interview"
                  sub="What the worker actually does is the evidence"
                  onPress={() => {
                    const item = evidenceFor;
                    if (!item) return;
                    setEvidenceFor(null);
                    navigation.navigate('WorkerInterview', { auditId, item });
                  }}
                />
                <SheetRow
                  icon="create" title="Written note"
                  sub="An observation with no attachment"
                  onPress={() => {
                    const item = evidenceFor;
                    if (!item) return;
                    attachSimple(item, 'note', { caption: item.remarks || item.title });
                  }}
                />
              </>
            )}

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setEvidenceFor(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Asset / permit / vehicle reference.
          Typed rather than scanned: no barcode scanner is installed in this
          project, and shipping a button that pretends to scan would be worse
          than one that plainly asks for the reference. Adding a scanner is a
          dependency decision, not a screen decision. */}
      <Modal visible={!!scanFor} transparent animationType="slide" onRequestClose={() => setScanFor(null)}>
        <View style={styles.sheetBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Asset, permit or vehicle reference</Text>
            <Text style={styles.sheetSub}>
              Identifies the equipment on “{scanFor?.title}” without typing a description.
            </Text>
            <TextInput
              style={styles.remarks}
              value={scanRef}
              onChangeText={setScanRef}
              autoCapitalize="characters"
              autoFocus
              placeholder="e.g. AST-EXT-0442 or PTW-0119"
              placeholderTextColor={C.light}
            />
            <View style={{ height: 12 }} />
            <PrimaryButton
              label="Attach reference"
              icon="qr-code"
              disabled={!scanRef.trim()}
              onPress={() => {
                const item = scanFor;
                const ref = scanRef.trim();
                if (!item || !ref) return;
                setScanFor(null);
                setScanRef('');
                attachSimple(item, 'scan', { scanned_ref: ref, caption: item.title });
              }}
            />
            <TouchableOpacity style={styles.sheetCancel} onPress={() => { setScanFor(null); setScanRef(''); }}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SheetRow({ icon, title, sub, onPress }: any) {
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.sheetRowIcon}><Ionicons name={icon} size={18} color={C.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sheetRowTitle}>{title}</Text>
        <Text style={styles.sheetRowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.light} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  runningPill: { alignItems: 'flex-end' },
  runningScore: { fontSize: 17, fontWeight: '900', color: C.brand },
  runningBand: { fontSize: 8.5, fontWeight: '800', color: C.muted, textTransform: 'uppercase', marginTop: -2 },

  progressWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  progressBar: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.brand, borderRadius: 3 },
  progressText: { fontSize: 10.5, fontWeight: '700', color: C.muted, marginTop: 6 },

  page: { paddingHorizontal: 16, paddingTop: 16 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  section: { fontSize: 10, fontWeight: '900', color: C.light, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
  criticalTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DC2626',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3,
  },
  criticalTagText: { fontSize: 8.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  clauseTag: { backgroundColor: '#F1F5F9', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  clauseTagText: { fontSize: 9, fontWeight: '800', color: C.mid },

  title: { fontSize: 19, fontWeight: '800', color: C.ink, lineHeight: 25 },
  question: { fontSize: 13, color: C.mid, lineHeight: 19, fontWeight: '600', marginTop: 7 },
  criticalNote: {
    fontSize: 11.5, color: '#B91C1C', lineHeight: 16, fontWeight: '700',
    backgroundColor: '#FEF2F2', borderRadius: 9, padding: 10, marginTop: 11,
  },

  label: { fontSize: 11, fontWeight: '900', color: C.light, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 20, marginBottom: 9 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  classRow: { flexDirection: 'row', gap: 5 },
  classBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  classBtnText: { fontSize: 9.5, fontWeight: '900', color: C.mid },
  classHint: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 7, lineHeight: 15 },

  repeatFlag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFEDD5',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, marginTop: 20, marginBottom: 9,
  },
  repeatFlagText: { fontSize: 8.5, fontWeight: '900', color: '#7C2D12' },

  remarks: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: C.ink,
    fontWeight: '600', minHeight: 76, textAlignVertical: 'top', lineHeight: 19,
  },
  dictHint: { fontSize: 10.5, color: C.light, fontWeight: '600', marginTop: 6 },

  owed: { fontSize: 10, fontWeight: '900', color: '#B45309', marginTop: 20, marginBottom: 9 },
  evCard: {
    width: 84, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1,
    borderColor: C.border, padding: 7, alignItems: 'center', gap: 3,
  },
  evThumb: { width: 60, height: 46, borderRadius: 6, backgroundColor: '#F1F5F9' },
  evIcon: {
    width: 60, height: 46, borderRadius: 6, backgroundColor: C.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  evKind: { fontSize: 9, fontWeight: '800', color: C.mid, textTransform: 'uppercase' },
  evRef: { fontSize: 8.5, fontWeight: '600', color: C.light, maxWidth: 70 },
  evGps: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  evGpsText: { fontSize: 7.5, fontWeight: '800', color: '#047857' },

  addEvidence: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed', borderRadius: 11,
    paddingVertical: 13, backgroundColor: '#FFFFFF',
  },
  addEvidenceOwed: { borderColor: '#FDE68A', backgroundColor: '#FFFDF7' },
  addEvidenceText: { fontSize: 12.5, fontWeight: '800', color: C.brand },

  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  gpsText: { fontSize: 10.5, fontWeight: '600', color: C.muted, flex: 1 },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#EEF2F6', gap: 10,
  },
  navBtn: {
    width: 42, height: 42, borderRadius: 11, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 4, flex: 1, justifyContent: 'center', flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E2E8F0' },
  dotDone: { backgroundColor: '#A7F3D0' },
  dotActive: { backgroundColor: C.brand, width: 18 },
  dotUnsent: { backgroundColor: '#FDE68A' },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.brand,
    borderRadius: 11, paddingHorizontal: 15, height: 42,
  },
  reviewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, width: '100%', alignItems: 'center' },
  alertIcon: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  alertTitle: { fontSize: 18, fontWeight: '900', color: '#B91C1C', marginBottom: 8 },
  alertText: { fontSize: 13, color: C.mid, lineHeight: 19, textAlign: 'center', fontWeight: '600', marginBottom: 20 },

  sheetBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
  sheetGrip: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  sheetSub: { fontSize: 11.5, fontWeight: '600', color: C.muted, marginTop: 3, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  sheetRowIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: C.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetRowTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  sheetRowSub: { fontSize: 11, fontWeight: '600', color: C.muted, marginTop: 2 },
  sheetCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  sheetCancelText: { fontSize: 13, fontWeight: '800', color: C.muted },
});
