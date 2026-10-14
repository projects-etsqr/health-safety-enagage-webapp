import React, { useState } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { SectionCard } from '../components/cards/SectionCard';
import { Input } from '../components/form/Input';
import { CheckboxGroup } from '../components/form/Checkbox';
import { TextArea } from '../components/form/TextArea';
import { AttachBox } from '../components/form/PhotoUploadBox';
import { DateTimePickerModal } from '../components/inputs/DateTimePickerModal';
import { Colors } from '../theme/colors';
import { usePermits } from '../hooks/usePermits';
import { PermitType, SafetyGear } from '../types';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { ensureCameraPermission, reportPickerError } from '../../utils/cameraPermission';

const PERMIT_TYPES: { id: PermitType; icon: string; title: string; desc: string }[] = [
  { id: 'hot_work',          icon: '🔥', title: 'Hot Work Permit',       desc: 'Welding, grinding, open flame' },
  { id: 'confined_space',    icon: '⬜', title: 'Confined Space Entry',   desc: 'Tanks, pits, restricted access' },
  { id: 'working_at_height', icon: '🧗', title: 'Working at Height',      desc: 'Scaffolding, MEWPs, ladders' },
  { id: 'electrical',        icon: '⚡', title: 'Electrical Work',         desc: 'Live systems, switch gear' },
  { id: 'excavation',        icon: '⛏️', title: 'Excavation',             desc: 'Digging, trenching, ground works' },
];

const SAFETY_GEAR_OPTIONS = ['Hard Hat', 'Gloves', 'Eye Pro', 'Respirator', 'Safety Harness', 'Hearing Protection'];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-06-11 08:00" → "11 Jun 2026, 08:00" for display. */
function fmtDisplay(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return value;
  const [, y, mo, d, hh, mm] = m;
  return `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]} ${y}, ${hh}:${mm}`;
}

function gearArrayToObject(selected: string[]): SafetyGear {
  return {
    hard_hat:            selected.includes('Hard Hat'),
    gloves:              selected.includes('Gloves'),
    eye_protection:      selected.includes('Eye Pro'),
    respirator:          selected.includes('Respirator'),
    safety_harness:      selected.includes('Safety Harness'),
    hearing_protection:  selected.includes('Hearing Protection'),
  };
}

export default function RaisePermitScreen({ navigation }: any) {
  const { createPermit, isLoading } = usePermits();

  const [selectedPermit, setSelectedPermit] = useState<PermitType>('hot_work');
  const [workDescription, setWorkDescription] = useState('');
  const [location, setLocation]     = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [gear, setGear]             = useState<string[]>(['Hard Hat', 'Gloves']);
  const [riskText, setRiskText]     = useState('');
  /** The JSA the worker attached. One file — a permit has one assessment. */
  const [jsa, setJsa] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  // Which date-time picker is open, if any.
  const [picker, setPicker]         = useState<null | 'start' | 'end'>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!workDescription.trim())  e.workDescription = 'Work description is required';
    if (!location.trim())         e.location        = 'Work location is required';
    if (!startDate.trim())        e.startDate       = 'Start date is required';
    if (!endDate.trim())          e.endDate         = 'End date is required';
    if (!riskText.trim())         e.riskText        = 'Risk assessment summary is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /**
   * Attach the risk assessment.
   *
   * The box rendered with no `onPress` at all, so tapping it did nothing —
   * there was no picker, no upload, and no column on the permit to put one in.
   * All three are wired now.
   */
  const attachJsa = () => {
    Alert.alert('Attach Risk Assessment', 'Where is the JSA?', [
      {
        text: 'Photograph it',
        onPress: async () => {
          if (!(await ensureCameraPermission('photograph the risk assessment'))) return;
          const res = await launchCamera({
            mediaType: 'photo', quality: 0.8, maxWidth: 2000, maxHeight: 2000, saveToPhotos: false,
          });
          takeAsset(res.assets?.[0], res.didCancel, res.errorCode, res.errorMessage, 'Camera');
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
          takeAsset(res.assets?.[0], res.didCancel, res.errorCode, res.errorMessage, 'Gallery');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takeAsset = (
    asset: Asset | undefined, cancelled?: boolean,
    code?: string, message?: string, label = 'Camera',
  ) => {
    if (cancelled) return;
    if (code) return reportPickerError(label, code, message);
    if (!asset?.uri) return;
    // Mirrors media_storage.MAX_BYTES, so the worker learns it is too big
    // before spending the upload rather than after.
    if (asset.fileSize && asset.fileSize > 100 * 1024 * 1024) {
      Alert.alert('File too large', 'The attachment has to be under 100 MB.');
      return;
    }
    setJsa({
      uri: asset.uri,
      name: asset.fileName || `jsa_${Date.now()}.jpg`,
      type: asset.type || 'image/jpeg',
    });
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields before submitting.');
      return;
    }

    const result = await createPermit({
      permit_type:          selectedPermit,
      work_location:        location.trim(),
      start_datetime:       startDate.trim(),
      end_datetime:         endDate.trim(),
      work_description:     workDescription.trim(),
      safety_gear:          gearArrayToObject(gear),
      risk_assessment_text: riskText.trim(),
    }, jsa ?? undefined);

    if (result) {
      Alert.alert(
        '✅ Permit Submitted',
        `Permit ${result.permit_ref} has been submitted for approval.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert('Submission Failed', 'Could not submit the permit. Please try again.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Permit',
      'Are you sure you want to discard this permit request?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  };

  return (
    <ScreenLayout>
      <AppHeader title="Request Permit" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Request Permit</Text>
        <Text style={styles.pageSub}>Submit a new digital work permit for approval.</Text>

        {/* Step 1 — Classification */}
        <SectionCard label="Permit Classification" stepNum={1} style={styles.card}>
          {PERMIT_TYPES.map(pt => (
            <TouchableOpacity
              key={pt.id}
              style={[styles.permitRow, selectedPermit === pt.id && styles.permitRowSelected]}
              onPress={() => setSelectedPermit(pt.id)}
              activeOpacity={0.8}
            >
              <Icon emoji={pt.icon} style={styles.permitIcon} color={Colors.primary} />
              <View style={styles.permitInfo}>
                <Text style={styles.permitTitle}>{pt.title}</Text>
                <Text style={styles.permitDesc}>{pt.desc}</Text>
              </View>
              {selectedPermit === pt.id && <Icon emoji="✅" style={styles.checkMark} />}
            </TouchableOpacity>
          ))}

          <TextArea
            label="Work Description *"
            placeholder="Describe the work to be performed..."
            value={workDescription}
            onChangeText={t => { setWorkDescription(t); setErrors(e => ({ ...e, workDescription: '' })); }}
            minHeight={80}
          />
          {errors.workDescription ? <Text style={styles.errorText}>{errors.workDescription}</Text> : null}
        </SectionCard>

        {/* Step 2 — Site & Schedule */}
        <SectionCard label="Site & Schedule" stepNum={2} style={styles.card}>
          <Input
            label="Work Location *"
            placeholder="e.g. North Sector Depot - Block A"
            value={location}
            onChangeText={t => { setLocation(t); setErrors(e => ({ ...e, location: '' })); }}
            rightIcon="📍"
          />
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}

          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Start Date & Time *</Text>
              <TouchableOpacity
                style={[styles.pickerField, errors.startDate ? styles.pickerFieldError : null]}
                onPress={() => setPicker('start')}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerValue, !startDate && styles.pickerPlaceholder]} numberOfLines={1}>
                  {startDate ? fmtDisplay(startDate) : 'Select start'}
                </Text>
                <Icon emoji="📅" style={styles.pickerIcon} />
              </TouchableOpacity>
              {errors.startDate ? <Text style={styles.errorText}>{errors.startDate}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End Date & Time *</Text>
              <TouchableOpacity
                style={[styles.pickerField, errors.endDate ? styles.pickerFieldError : null]}
                onPress={() => setPicker('end')}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerValue, !endDate && styles.pickerPlaceholder]} numberOfLines={1}>
                  {endDate ? fmtDisplay(endDate) : 'Select end'}
                </Text>
                <Icon emoji="📅" style={styles.pickerIcon} />
              </TouchableOpacity>
              {errors.endDate ? <Text style={styles.errorText}>{errors.endDate}</Text> : null}
            </View>
          </View>
        </SectionCard>

        {/* Step 3 — Safety Gear */}
        <SectionCard label="Mandatory Safety Gear" stepNum={3} style={styles.card}>
          <CheckboxGroup
            options={SAFETY_GEAR_OPTIONS}
            selected={gear}
            onChange={setGear}
            columns={2}
          />
        </SectionCard>

        {/* Step 4 — Risk Assessment */}
        <SectionCard label="Risk Assessment" stepNum={4} style={styles.card}>
          <TextArea
            label="Hazards & Mitigations *"
            placeholder="Summarize potential hazards and mitigation steps..."
            value={riskText}
            onChangeText={t => { setRiskText(t); setErrors(e => ({ ...e, riskText: '' })); }}
            minHeight={100}
          />
          {errors.riskText ? <Text style={styles.errorText}>{errors.riskText}</Text> : null}
          {/* Photographs, not PDFs. The box promised "PDF, JPG, or PNG" and
              delivered none of them — and no document picker is installed in
              this project, so offering PDF would be the same promise again.
              A photographed JSA is what a worker at the job actually has. */}
          <AttachBox
            icon={jsa ? '📄' : '☁️'}
            title={jsa ? `Attached: ${jsa.name}` : 'Attach Risk Assessment (JSA)'}
            subtitle={jsa ? 'Tap to replace' : 'Photograph the JSA, or pick it from your gallery'}
            onPress={attachJsa}
          />
        </SectionCard>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>▶ Submit Request</Text>
          }
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={() => Alert.alert('Draft Saved', 'Draft saving will be available in a future update.')}
          >
            <Text style={styles.draftText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <DateTimePickerModal
        visible={picker !== null}
        value={picker === 'start' ? startDate : picker === 'end' ? endDate : ''}
        title={picker === 'start' ? 'Start date & time' : 'End date & time'}
        onCancel={() => setPicker(null)}
        onConfirm={(val) => {
          if (picker === 'start') {
            setStartDate(val);
            setErrors(e => ({ ...e, startDate: '' }));
          } else if (picker === 'end') {
            setEndDate(val);
            setErrors(e => ({ ...e, endDate: '' }));
          }
          setPicker(null);
        }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll:    { flex: 1, padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.textDark, marginBottom: 4, marginTop: 8 },
  pageSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  card:      { marginBottom: 14 },

  permitRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 10,
  },
  permitRowSelected: { borderColor: Colors.blue, backgroundColor: '#EFF5FF' },
  permitIcon:  { fontSize: 24, marginRight: 12 },
  permitInfo:  { flex: 1 },
  permitTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  permitDesc:  { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  checkMark:   { fontSize: 18 },

  dateRow:   { flexDirection: 'row', gap: 10 },
  errorText: { fontSize: 12, color: Colors.critical, marginTop: -6, marginBottom: 8, marginLeft: 2 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textDark, marginBottom: 6 },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 13, marginBottom: 12, minHeight: 48,
  },
  pickerFieldError: { borderColor: Colors.critical },
  pickerValue: { flex: 1, fontSize: 14, color: Colors.textDark, fontWeight: '600' },
  pickerPlaceholder: { color: Colors.textMuted, fontWeight: '400' },
  pickerIcon: { fontSize: 16, marginLeft: 8 },

  submitBtn:         { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: Colors.textMuted },
  submitText:        { color: Colors.white, fontWeight: '700', fontSize: 16 },

  secondaryRow: { flexDirection: 'row', gap: 12 },
  draftBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  draftText:  { fontWeight: '600', color: Colors.textDark },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.criticalBg,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  cancelText: { fontWeight: '600', color: Colors.critical },
});
