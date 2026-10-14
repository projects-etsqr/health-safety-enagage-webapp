import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, ActivityIndicator, Modal, Image,
} from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
// The third copy of this pair lived in this file. One shared version now, in
// utils/cameraPermission — the auditor's checklist screen was broken for months
// precisely because a fourth call site was written without it.
import { ensureCameraPermission, reportPickerError } from '../../utils/cameraPermission';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { DateTimePickerModal } from '../components/inputs/DateTimePickerModal';
import { Colors } from '../theme/colors';
import { useIncidents } from '../hooks/useIncidents';
import { useGeoTag } from '../hooks/useGeoTag';
import { EmployeePickerModal } from '../components/inputs/EmployeePickerModal';
import { lookupService, WorkingStation, HazardOption, EmployeeOption } from '../services/lookupService';
import type { IncidentType, PhotoAttachment, SeverityLevel, YesNo } from '../types';

const INCIDENT_TYPES: IncidentType[] = [
  'Injury',
  'Dangerous Occurrence',
  'Property Damage',
  'Environmental',
];

/** Ordered least → most severe; "Lost Time" and "Fatal" are what drive LTIFR/LTISR/DART/FAR. */
const SEVERITIES: SeverityLevel[] = ['Minor', 'Moderate', 'Severe', 'Lost Time', 'Fatal'];

// WF-03 Q2. These values are the ones the backend decision tree accepts —
// anything else classifies as "unrecognised" and escalates rather than guessing.
const TREATMENT_LEVELS = [
  { value: 'first_aid', label: 'First aid only' },
  { value: 'medical_treatment', label: 'Medical treatment' },
  { value: 'hospitalisation', label: 'Hospitalised / >3 days lost' },
  { value: 'fatality', label: 'Fatality' },
];

/**
 * One witness. `employee_id` is present when they were picked from the register
 * and absent when the name was typed — a contractor or visitor has no staff
 * number. Same shape the near miss form sends.
 */
type Witness = { name: string; employee_id?: number };

export default function ReportIncidentScreen({ navigation }: any) {
  const { reportIncident, isLoading: isSubmitting } = useIncidents();
  const { geo } = useGeoTag();

  const [incidentType, setIncidentType] = useState<IncidentType>('Injury');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [stations, setStations] = useState<WorkingStation[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const [hazards, setHazards] = useState<HazardOption[]>([]);
  const [hazardId, setHazardId] = useState<number | null>(null);
  const [hazardPickerVisible, setHazardPickerVisible] = useState(false);

  const [incidentDateTime, setIncidentDateTime] = useState<Date>(new Date());
  const [dateTimePickerVisible, setDateTimePickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('Minor');
  const [reason, setReason] = useState('');
  const [personsInvolved, setPersonsInvolved] = useState('');
  const [anyoneInjured, setAnyoneInjured] = useState<YesNo>('No');
  // ── WF-03 decision tree inputs ─────────────────────────────────────────────
  // The `severity` picker above is the reporter's impression and drives nothing.
  // These three are what the backend's decision tree reads to assign P1-P5, the
  // investigation SLA and any statutory deadline. Without them an injury
  // reported from the app can never classify at submission time.
  const [treatmentLevel, setTreatmentLevel] = useState('');
  const [dangerousOccurrence, setDangerousOccurrence] = useState<YesNo>('No');
  const [worstCaseFatal, setWorstCaseFatal] = useState<YesNo>('No');
  const [injuredPersonName, setInjuredPersonName] = useState('');
  const [injuredBodyPart, setInjuredBodyPart] = useState('');

  const [controlFailure, setControlFailure] = useState<YesNo>('No');
  const [hazardStillPresent, setHazardStillPresent] = useState<YesNo>('No');
  const [immediateActions, setImmediateActions] = useState('');
  // Structured, so a witness picked from the register keeps their id instead of
  // it being baked into a display string. See EmployeePickerModal.
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [witnessPickerOpen, setWitnessPickerOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  // Real files now, not invented filenames. PhotoAttachment is what
  // incidentService already expects for its multipart upload, so attaching
  // these is what finally uses the upload path the service always had.
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

  useEffect(() => {
    lookupService.workingStations()
      .then(rows => {
        setStations(rows);
        setStationId(prev => prev ?? rows[0]?.id ?? null);
      })
      .catch(() => setStations([]));
    lookupService.hazards().then(setHazards).catch(() => setHazards([]));
    lookupService.employees().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const stationName = useMemo(
    () => stations.find(s => s.id === stationId)?.station_name ?? 'Select a station',
    [stations, stationId],
  );
  const hazardName = useMemo(
    () => hazards.find(h => h.id === hazardId)?.hazard_name ?? 'Select hazard',
    [hazards, hazardId],
  );

  const addWitness = (w: Witness) => {
    setWitnesses(prev => [...prev, w]);
    setWitnessPickerOpen(false);
  };

  /**
   * Take the result of a picker and keep only what the upload needs.
   *
   * This screen used to invent a filename — it picked at random from a list of
   * five hardcoded names like `evidence_spill_01.jpg` and attached that string.
   * No image was ever captured, and the investigator opening the incident got a
   * filename pointing at nothing. These are real files now.
   */
  const addAssets = (assets?: Asset[]) => {
    const picked = (assets ?? [])
      .filter(a => !!a.uri)
      .map((a, i) => {
        const isVideo = a.type?.startsWith('video/') || a.uri?.endsWith('.mp4') || a.uri?.endsWith('.mov');
        const defaultExt = isVideo ? 'mp4' : 'jpg';
        const defaultType = isVideo ? 'video/mp4' : 'image/jpeg';
        return {
          uri: a.uri as string,
          name: a.fileName || `evidence_${Date.now()}_${i}.${defaultExt}`,
          type: a.type || defaultType,
        };
      });
    if (picked.length) setPhotos(prev => [...prev, ...picked]);
  };

  const takePhoto = async () => {
    if (!(await ensureCameraPermission('attach evidence to this report'))) return;
    Alert.alert(
      'Camera Option',
      'Choose whether you want to take a photo or record a video:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const res = await launchCamera({
              mediaType: 'photo',
              quality: 0.7,
              maxWidth: 1600,
              maxHeight: 1600,
              saveToPhotos: false,
            });
            if (res.didCancel) return;
            if (res.errorCode) return reportPickerError('Camera', res.errorCode, res.errorMessage);
            addAssets(res.assets);
          },
        },
        {
          text: 'Record Video',
          onPress: async () => {
            const res = await launchCamera({
              mediaType: 'video',
              videoQuality: 'medium',
              durationLimit: 30,
              saveToPhotos: false,
            });
            if (res.didCancel) return;
            if (res.errorCode) return reportPickerError('Camera', res.errorCode, res.errorMessage);
            addAssets(res.assets);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const pickFromGallery = async () => {
    const res = await launchImageLibrary({
      mediaType: 'mixed',     // allow both photos and videos
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
      selectionLimit: 0,     // 0 = as many as they need
    });
    if (res.didCancel) return;
    if (res.errorCode) return reportPickerError('Gallery', res.errorCode, res.errorMessage);
    addAssets(res.assets);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description of the incident.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter the reason / immediate cause.');
      return;
    }
    if (anyoneInjured === 'Yes' && !injuredPersonName.trim()) {
      Alert.alert('Required', 'Please enter the name of the injured person.');
      return;
    }
    if (!stationId) {
      Alert.alert('Required', 'Please select the location / working station.');
      return;
    }
    if (!hazardId) {
      Alert.alert('Required', 'Please select the hazard associated with this incident.');
      return;
    }

    const ok = await reportIncident({
      incident_date_time: incidentDateTime.toISOString(),
      location_station_id: stationId,
      incident_type: incidentType,
      severity,
      description: description.trim(),
      immediate_cause: reason.trim(),
      number_persons_involved: personsInvolved ? Number(personsInvolved) : undefined,
      anyone_injured: anyoneInjured,
      injured_person_name: anyoneInjured === 'Yes' ? injuredPersonName.trim() : undefined,
      injured_body_part: anyoneInjured === 'Yes' ? injuredBodyPart.trim() || undefined : undefined,
      // WF-03 Q2-Q4. Treatment level only applies when someone was hurt; the
      // other two stand alone (a near miss can still be a dangerous occurrence
      // or a high-potential event).
      treatment_level: anyoneInjured === 'Yes' ? treatmentLevel || undefined : undefined,
      dangerous_occurrence: dangerousOccurrence === 'Yes',
      worst_case_fatal: worstCaseFatal === 'Yes',
      hazard_id: hazardId,
      permit_active: 'No',
      control_failure: controlFailure,
      hazard_still_present: hazardStillPresent,
      immediate_actions_taken: immediateActions.trim() || undefined,
      witnesses,
      ...geo,
      // `photos` — not `mockPhotos`. This is what switches the request to the
      // multipart path in incidentService, so the files are actually uploaded
      // and, offline, replayed from disk when the connection returns.
      photos,
    } as any);

    if (ok.ok) {
      Alert.alert(
        ok.queued ? 'Saved — waiting to send' : 'Success',
        ok.queued
          ? 'Saved on this device. There is no signal right now, so it will be sent automatically as soon as you are back online.'
          : 'Incident report submitted successfully to the safety team.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert('Submission Failed', 'Failed to report the incident. Please try again.');
    }
  };

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Keyboard avoidance is ScreenLayout's job now — see KeyboardAvoider. */}
      <View style={{ flex: 1 }}>
        {/* Top Header */}
      <View style={styles.header}>
        {/* The action is goBack(), so the icon is a back arrow. It was a
            hamburger, which promises a menu and delivers a navigation pop. */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={Colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon emoji="🔔" style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Incident Details</Text>
        <Text style={styles.sectionSub}>Provide the initial classification and description.</Text>

        {/* Incident Type Dropdown */}
        <Text style={styles.inputLabel}>Incident Type</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setPickerVisible(true)}>
          <Text style={styles.dropdownValue}>{incidentType}</Text>
          <Text style={styles.chevronIcon}>▼</Text>
        </TouchableOpacity>

        {/* Location Dropdown — resolves to a working_stations FK */}
        <Text style={styles.inputLabel}>Location / Station</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setLocationPickerVisible(true)}>
          <Text style={styles.dropdownValue}>{stationName}</Text>
          <Text style={styles.chevronIcon}>▼</Text>
        </TouchableOpacity>

        {/* Incident Date & Time
            Was a free-text box the worker had to type "YYYY-MM-DD HH:MM" into.
            Anything it could not parse was silently discarded and the report
            went in stamped with the time the form was opened — which is the one
            field the investigation SLA and the statutory clock both count from. */}
        <Text style={styles.inputLabel}>Incident Date &amp; Time</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setDateTimePickerVisible(true)}>
          <Text style={styles.dropdownValue}>{formatDateTime(incidentDateTime)}</Text>
          <Text style={styles.chevronIcon}>▼</Text>
        </TouchableOpacity>

        {/* Description Input */}
        <Text style={styles.inputLabel}>Description</Text>
        <View style={styles.textAreaContainer}>
          <TextInput
            style={styles.textArea}
            placeholder="Describe what happened in detail..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Severity Level — spec enum, matched verbatim by the KPI engine */}
        <Text style={styles.inputLabel}>Severity Level</Text>
        <View style={styles.severityRow}>
          {SEVERITIES.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.severityChip, severity === level && styles.severityBtnActive]}
              onPress={() => setSeverity(level)}
            >
              <Text
                style={[styles.severityChipText, severity === level && styles.severityBtnTextActive]}
                numberOfLines={1}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.severityLimitsRow}>
          <Text style={styles.limitText}>MINOR</Text>
          <Text style={styles.limitText}>FATAL</Text>
        </View>

        {/* Incident Reason */}
        <Text style={styles.inputLabel}>Reason / Immediate Cause</Text>
        <View style={styles.textAreaContainer}>
          <TextInput
            style={[styles.textArea, { height: 75 }]}
            placeholder="Explain why the incident occurred..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={reason}
            onChangeText={setReason}
          />
        </View>

        {/* Number of Persons Involved */}
        <Text style={styles.inputLabel}>Number of Persons Involved</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="0"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            value={personsInvolved}
            onChangeText={t => setPersonsInvolved(t.replace(/[^0-9]/g, ''))}
          />
        </View>

        {/* Was anyone injured toggle */}
        <YesNoRow label="Was anyone injured?" value={anyoneInjured} onChange={setAnyoneInjured} />

        {/* Injury detail */}
        {anyoneInjured === 'Yes' && (
          <View>
            <Text style={styles.inputLabel}>Injured Person Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter full name of the injured person..."
                placeholderTextColor="#94A3B8"
                value={injuredPersonName}
                onChangeText={setInjuredPersonName}
              />
            </View>

            <Text style={styles.inputLabel}>Body Part Injured</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Left hand, Lower back..."
                placeholderTextColor="#94A3B8"
                value={injuredBodyPart}
                onChangeText={setInjuredBodyPart}
              />
            </View>

            {/* WF-03 Q2 — sets the severity, the investigation deadline and any
                regulator notification. Optional here on purpose: a worker in the
                field may not know yet, and the supervisor confirms it during the
                investigation. Left blank the incident stays unclassified rather
                than being guessed. */}
            <Text style={styles.inputLabel}>Level of treatment (if known)</Text>
            <View style={styles.wfChipRow}>
              {TREATMENT_LEVELS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.wfChip, treatmentLevel === t.value && styles.wfChipOn]}
                  onPress={() => setTreatmentLevel(treatmentLevel === t.value ? '' : t.value)}
                >
                  <Text style={[styles.wfChipText, treatmentLevel === t.value && styles.wfChipTextOn]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* WF-03 Q3 and Q4 — asked for every report, injury or not. A near miss
            that could have killed someone is a high-potential incident and gets
            the P2 investigation protocol. */}
        <YesNoRow
          label="Dangerous occurrence? (collapse, explosion, major release)"
          value={dangerousOccurrence}
          onChange={setDangerousOccurrence}
        />
        <YesNoRow
          label="Could this have killed or seriously injured someone?"
          value={worstCaseFatal}
          onChange={setWorstCaseFatal}
        />

        {/* Linked Hazard */}
        <Text style={styles.inputLabel}>Linked Hazard</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setHazardPickerVisible(true)}>
          <Text style={styles.dropdownValue}>{hazardName}</Text>
          <Text style={styles.chevronIcon}>▼</Text>
        </TouchableOpacity>

        {/* Control context — these three feed the risk / close-out analytics */}

        <YesNoRow label="Control failure?" value={controlFailure} onChange={setControlFailure} />
        <YesNoRow label="Hazard still present?" value={hazardStillPresent} onChange={setHazardStillPresent} />

        {/* Immediate Actions Taken */}
        <Text style={styles.inputLabel}>Immediate Actions Taken</Text>
        <View style={styles.textAreaContainer}>
          <TextInput
            style={[styles.textArea, { height: 75 }]}
            placeholder="What was done right away to make the area safe?"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={immediateActions}
            onChangeText={setImmediateActions}
          />
        </View>

        {/* Witnesses */}
        <Text style={styles.inputLabel}>Witnesses</Text>
        <TouchableOpacity
          style={styles.addWitnessBtn}
          onPress={() => setWitnessPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Icon name="user-plus" size={17} color="#2563EB" />
          <Text style={styles.addWitnessLabel}>Add a witness</Text>
        </TouchableOpacity>

        {witnesses.length > 0 && (
          <View style={styles.witnessList}>
            {witnesses.map((w, idx) => (
              <View key={`${w.name}-${w.employee_id ?? 'x'}-${idx}`} style={styles.witnessItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.witnessName}>{w.name}</Text>
                  <Text style={styles.witnessCode}>
                    {w.employee_id ? `EMP-${w.employee_id}` : 'Not an employee'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setWitnesses(prev => prev.filter((_, i) => i !== idx))}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={`Remove ${w.name}`}
                >
                  <Icon name="x" size={17} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Photos & Videos Upload Section */}
        <Text style={styles.inputLabel}>Photos / Videos / Evidence</Text>
        <View style={styles.photoContainer}>
          <View style={styles.photoBtnRow}>
            <TouchableOpacity style={[styles.photoAddBtn, styles.photoAddRow]} onPress={takePhoto}>
              <Icon name="camera" size={15} color="#2563EB" style={styles.photoAddIcon} />
              <Text style={styles.photoAddText}>Take Photo/Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoAddBtn, styles.photoAddRow]} onPress={pickFromGallery}>
              <Icon name="image" size={15} color="#2563EB" style={styles.photoAddIcon} />
              <Text style={styles.photoAddText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Thumbnails, not filenames. The reporter can see what they actually
              attached before they submit — the old chips showed a made-up name
              and there was nothing behind them to look at. */}
          <View style={styles.thumbWrapper}>
            {photos.map((item, idx) => (
              <View key={`${item.uri}-${idx}`} style={styles.thumb}>
                {item.type?.startsWith('video/') ? (
                  <View style={[styles.thumbImg, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }]}>
                    <Icon name="video" size={24} color="#FFFFFF" />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.thumbImg} />
                )}
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => handleRemovePhoto(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon emoji="✕" style={styles.thumbRemoveIcon} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {photos.length > 0 && (
            <Text style={styles.photoCount}>
              {photos.length} media file{photos.length === 1 ? '' : 's'} attached
            </Text>
          )}
        </View>

        {/* GPS is auto-captured, so surface what will be attached */}
        <View style={styles.gpsRow}>
          <Icon name="map-pin" size={13} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.gpsText}>
            {geo.gps_latitude != null
              ? `GPS ${geo.gps_latitude.toFixed(5)}, ${geo.gps_longitude?.toFixed(5)}`
              : 'GPS unavailable — report will be submitted without coordinates'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer Action
          One button, and it says what it does. "Next" implied a second step
          that never existed — this submits the report. The "Draft" button beside
          it had no onPress at all, so tapping it did nothing; a control that
          looks like it saves your work and silently discards it is worse than
          no control. */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.footerBtnRow}>
              <Icon name="check-circle" size={16} color="#FFFFFF" style={styles.footerBtnIcon} />
              <Text style={styles.submitBtnText}>Submit Report</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Incident Type</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Icon emoji="✕" style={styles.pickerCloseBtn} />
              </TouchableOpacity>
            </View>
            
            {INCIDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pickerItem, incidentType === type && styles.pickerItemActive]}
                onPress={() => {
                  setIncidentType(type);
                  setPickerVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, incidentType === type && styles.pickerItemTextActive]}>
                  {type}
                </Text>
                {incidentType === type && (
                  <Icon emoji="✓" style={styles.checkmarkIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={locationPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLocationPickerVisible(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setLocationPickerVisible(false)}>
                <Icon emoji="✕" style={styles.pickerCloseBtn} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {stations.length === 0 && (
                <Text style={styles.pickerEmpty}>No working stations configured.</Text>
              )}
              {stations.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.pickerItem, stationId === st.id && styles.pickerItemActive]}
                  onPress={() => {
                    setStationId(st.id);
                    setLocationPickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, stationId === st.id && styles.pickerItemTextActive]}>
                    {st.station_name}
                  </Text>
                  {stationId === st.id && (
                    <Icon emoji="✓" style={styles.checkmarkIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Linked Hazard Picker Modal */}
      <Modal
        visible={hazardPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setHazardPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHazardPickerVisible(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Link a Hazard</Text>
              <TouchableOpacity onPress={() => setHazardPickerVisible(false)}>
                <Icon emoji="✕" style={styles.pickerCloseBtn} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {hazards.map((hz) => (
                <TouchableOpacity
                  key={hz.id}
                  style={[styles.pickerItem, hazardId === hz.id && styles.pickerItemActive]}
                  onPress={() => { setHazardId(hz.id); setHazardPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, hazardId === hz.id && styles.pickerItemTextActive]}>
                    {hz.hazard_name}
                  </Text>
                  {hazardId === hz.id && <Icon emoji="✓" style={styles.checkmarkIcon} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>



      {/* Incident date & time.
          minToday is off and maxToday on: an incident has already happened, so
          the picker offers the last two years and refuses anything in the
          future. A future date here would push the investigation deadline and
          the regulator's clock out with it. */}
      <DateTimePickerModal
        visible={dateTimePickerVisible}
        value={formatDateTime(incidentDateTime)}
        title="When did it happen?"
        minToday={false}
        maxToday
        pastYears={2}
        onCancel={() => setDateTimePickerVisible(false)}
        onConfirm={(val) => {
          const parsed = new Date(val.replace(' ', 'T'));
          if (!isNaN(parsed.getTime())) setIncidentDateTime(parsed);
          setDateTimePickerVisible(false);
        }}
      />
      </View>

      <EmployeePickerModal
        visible={witnessPickerOpen}
        employees={employees}
        chosenIds={witnesses.map(w => w.employee_id).filter((n): n is number => n != null)}
        onPick={(e) => addWitness({ name: e.full_name, employee_id: e.id })}
        onAddFreeText={(name) => addWitness({ name })}
        onClose={() => setWitnessPickerOpen(false)}
      />
    </ScreenLayout>
  );
}

function YesNoRow({
  label, value, onChange,
}: { label: string; value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.toggleGroup}>
        {(['Yes', 'No'] as YesNo[]).map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.toggleOption, value === opt && styles.toggleOptionActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.toggleOptionText, value === opt && styles.toggleOptionTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** `YYYY-MM-DD HH:MM` in local time — ISO-parseable once the space becomes a `T`. */
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  wfChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  wfChip: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFFFFF',
  },
  wfChipOn: { borderColor: '#0B3D91', backgroundColor: '#EFF6FF' },
  wfChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  wfChipTextOn: { color: '#0B3D91' },
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
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  segmentsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 16,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  segmentActive: {
    backgroundColor: '#2563EB',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
  },
  dropdownValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  chevronIcon: {
    fontSize: 10,
    color: '#64748B',
  },
  textAreaContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  textArea: {
    height: 120,
    fontSize: 14,
    color: '#0F172A',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  severityBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChip: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  severityChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gpsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  pickerScroll: {
    maxHeight: 320,
  },
  pickerEmpty: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    paddingVertical: 16,
    textAlign: 'center',
  },
  severityBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  severityBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  severityBtnTextActive: {
    color: '#FFFFFF',
  },
  severityLimitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  limitText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    paddingBottom: 24,
  },
  footerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnIcon: {
    marginRight: 6,
  },
  photoAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddIcon: {
    marginRight: 6,
  },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerCloseBtn: {
    fontSize: 18,
    color: '#64748B',
    paddingHorizontal: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  pickerItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  checkmarkIcon: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '800',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggleOption: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleOptionTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
  },
  photoContainer: {
    marginBottom: 20,
  },
  // Camera and Gallery share the row, so each takes half the width.
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoAddBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  thumbWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveIcon: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  photoCount: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  photoAddText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  photoWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  photoLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  photoRemoveBtn: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  addWitnessBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    borderStyle: 'dashed', backgroundColor: '#F8FAFC', marginBottom: 10,
  },
  addWitnessLabel: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  witnessList: { gap: 8, marginBottom: 16 },
  witnessItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  witnessName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  witnessCode: { fontSize: 11.5, color: '#64748B', marginTop: 1, fontVariant: ['tabular-nums'] },
});
