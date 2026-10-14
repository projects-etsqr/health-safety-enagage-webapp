import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { FormSection } from '../components/layout/FormSection';
import { Dropdown } from '../components/form/Dropdown';
import { Input } from '../components/form/Input';
import { TextArea } from '../components/form/TextArea';
import { ChipSelector } from '../components/form/ChipSelector';
import { ToggleRow } from '../components/form/ToggleRow';
import { MediaUploadBox } from '../components/form/PhotoUploadBox';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { hazardService } from '../services/hazardService';
import { Colors } from '../theme/colors';

/**
 * Log an unsafe act into the standing register (flow 5).
 *
 * Distinct from ReportRiskScreen, which writes a one-off observation to
 * `risk_reports`. A register entry is a standing condition that gets assessed,
 * contained, controlled, verified and closed — the same eight stages an
 * incident runs — and the worker can follow it the whole way on My Unsafe Acts.
 *
 * The severity words here are the register's own four-point scale
 * (Low/Medium/High/Critical), not the 5x5 consequence scale the risk form uses.
 * They are what the backend's hazard assessor resolves, so changing them here
 * without changing `_HAZARD_SEVERITY` would silently leave hazards unscored.
 */

// Ids match the backend hazard_categories seed order 1-10.

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const PROBABILITIES = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];

export default function LogHazardScreen({ navigation }: any) {
  // Fetched, not hard-coded. The list used to be ids 1-10 in this file, which
  // are organisation 1's category rows — so a worker in any other org picked a
  // label here and the hazard was filed against a different org's category.
  const {
    items: mediaItems, attachments: mediaAttachments,
    launch: launchMedia, remove: removeMedia,
  } = useMediaCapture();

  const [categories, setCategories] = useState<Array<{ label: string; value: string }>>([]);
  const [category, setCategory] = useState('');
  const [hazardName, setHazardName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState('');
  const [probability, setProbability] = useState('');
  const [personsExposed, setPersonsExposed] = useState('');
  const [existingControls, setExistingControls] = useState('');
  const [stillPresent, setStillPresent] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    hazardService
      .categories()
      .then(rows =>
        setCategories(rows.map(r => ({ label: r.category_name, value: String(r.id) }))),
      )
      // An empty dropdown is honest here: the alternative is guessing ids
      // again, and a wrong category is worse than an unset one — the backend
      // fills in a default rather than rejecting the log.
      .catch(() => setCategories([]));
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!hazardName.trim()) e.hazardName = 'Name the unsafe act';
    if (!category) e.category = 'Select an unsafe act category';
    if (!severity) e.severity = 'Select how bad it could be';
    if (!probability) e.probability = 'Select how likely it is';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await hazardService.logHazard({
        hazard_name: hazardName.trim(),
        category_id: Number(category),
        description: description.trim() || undefined,
        severity,
        probability,
        location: location.trim() || undefined,
        controls: existingControls.trim() || undefined,
        persons_exposed: personsExposed ? Number(personsExposed) : undefined,
        still_present: stillPresent,
        photos: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      });
      Alert.alert(
        res.queued ? 'Saved — waiting to send' : 'Unsafe Act Logged',
        res.queued
          ? 'Saved on this device. There is no signal right now, so it will be sent automatically as soon as you are back online.'
          : 'Added to the unsafe act register. Your supervisor will assess it — you can follow it on My Unsafe Acts.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Submission Failed', 'Could not log the unsafe act. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <AppHeader title="Log an Unsafe Act" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.introBox}>
          <Text style={styles.introText}>
            An unsafe act is a condition or behaviour that could hurt someone — not an
            event that already happened. It stays on the register until the control is
            verified.
          </Text>
        </View>

        <FormSection label="What is the unsafe act?" required>
          <Input
            placeholder="e.g. Unguarded conveyor pinch point"
            value={hazardName}
            onChangeText={(v: string) => { setHazardName(v); setErrors(e => ({ ...e, hazardName: '' })); }}
          />
          {errors.hazardName ? <Text style={styles.errorText}>{errors.hazardName}</Text> : null}
        </FormSection>

        <FormSection label="Unsafe Act Category" required>
          <Dropdown
            options={categories}
            value={category}
            onChange={(v: string) => { setCategory(v); setErrors(e => ({ ...e, category: '' })); }}
            placeholder={categories.length ? 'Select unsafe act type...' : 'Loading categories...'}
          />
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
        </FormSection>

        <FormSection label="Description">
          <TextArea
            placeholder="Where is it, and who could be hurt by it?"
            value={description}
            onChangeText={setDescription}
          />
        </FormSection>

        <FormSection label="Photo / Video Evidence">
          <MediaUploadBox
            items={mediaItems}
            onAdd={launchMedia}
            onRemove={removeMedia}
            subtitle="Tap to take a photo, record a video, or attach one you already have"
          />
        </FormSection>

        <FormSection label="Location">
          <Input
            placeholder="e.g. Line 3, east walkway"
            value={location}
            onChangeText={setLocation}
          />
        </FormSection>

        <FormSection label="How bad could it be?" required>
          <ChipSelector options={SEVERITIES} value={severity} onChange={(v: string) => {
            setSeverity(v); setErrors(e => ({ ...e, severity: '' }));
          }} />
          {errors.severity ? <Text style={styles.errorText}>{errors.severity}</Text> : null}
        </FormSection>

        <FormSection label="How likely is it?" required>
          <ChipSelector options={PROBABILITIES} value={probability} onChange={(v: string) => {
            setProbability(v); setErrors(e => ({ ...e, probability: '' }));
          }} />
          {errors.probability ? <Text style={styles.errorText}>{errors.probability}</Text> : null}
        </FormSection>

        <FormSection label="How many people are exposed?">
          {/* Numbers exposed is a multiplier the severity x likelihood matrix
              does not carry, so the backend raises the priority a band at five
              or more. Leaving it blank simply skips that rule. */}
          <Input
            placeholder="e.g. 6"
            keyboardType="number-pad"
            value={personsExposed}
            onChangeText={setPersonsExposed}
          />
        </FormSection>

        <FormSection label="Anything already in place?">
          <TextArea
            placeholder="Existing controls, if any"
            value={existingControls}
            onChangeText={setExistingControls}
          />
        </FormSection>

        <ToggleRow
          title="The unsafe act is still there right now"
          subtitle="Logging it starts the record — it does not make the area safe."
          value={stillPresent}
          onChange={setStillPresent}
        />
        {stillPresent ? (
          <Text style={styles.urgentNote}>
            Tell your supervisor directly as well. Logging it here starts the record;
            it does not make the area safe.
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.submitText}>Add to Unsafe Act Register</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 16 },
  introBox: {
    backgroundColor: '#EEF2FB', borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 4,
  },
  introText: { fontSize: 12.5, color: '#334155', lineHeight: 18 },
  errorText: { fontSize: 11.5, color: Colors.critical, marginTop: 6, fontWeight: '600' },
  urgentNote: {
    fontSize: 12, color: '#B45309', lineHeight: 17, marginTop: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
  },
  submitBtn: {
    height: 52, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
