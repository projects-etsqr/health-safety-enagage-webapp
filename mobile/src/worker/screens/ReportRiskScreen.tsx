import React, { useEffect, useMemo, useState } from 'react';
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
import { riskService } from '../services/riskService';
import { hazardService } from '../services/hazardService';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { Colors } from '../theme/colors';


const SEVERITIES    = ['Minor', 'Significant', 'Serious', 'Fatal'];
const PROBABILITIES = ['Rare', 'Unlikely', 'Possible', 'Likely'];

type Rating = 'Low' | 'Medium' | 'High' | 'Critical';

// Risk matrix: severity × probability → rating
const RISK_MATRIX: Record<string, Record<string, Rating>> = {
  Fatal:       { Rare: 'Medium', Unlikely: 'High',   Possible: 'Critical', Likely: 'Critical' },
  Serious:     { Rare: 'Low',    Unlikely: 'Medium', Possible: 'High',     Likely: 'Critical' },
  Significant: { Rare: 'Low',    Unlikely: 'Medium', Possible: 'High',     Likely: 'High' },
  Minor:       { Rare: 'Low',    Unlikely: 'Low',    Possible: 'Medium',   Likely: 'Medium' },
};

const RATING_COLOR: Record<Rating, string> = {
  Low:      Colors.success,
  Medium:   Colors.blue,
  High:     Colors.warning,
  Critical: Colors.critical,
};

/**
 * Reporting a risk — one unsafe condition somebody saw, on `risk_reports`.
 *
 * This screen used to be titled "Report a Hazard", which put it in direct
 * competition with LogHazardScreen ("Log a Hazard") for the same words. Two
 * screens announcing themselves as hazards, writing to two different tables
 * with two different lifecycles, is how a worker logs a standing hazard as a
 * one-off observation and a supervisor then cannot find it on the register.
 * That happened.
 *
 * The WF-01 spec draws the line the wording now follows: "A hazard is what
 * exists. A risk is what might happen because of it." This is the second one.
 */
export default function ReportRiskScreen({ navigation }: any) {
  const {
    items: mediaItems, attachments: mediaAttachments,
    launch: launchMedia, remove: removeMedia,
  } = useMediaCapture();

  // Fetched per-org. This list used to be hard-coded as ids 1-10 — another
  // organisation's category rows — and riskService stringified the chosen id
  // into risk_category, so the column held "2" rather than a category name.
  const [categories,  setCategories]  = useState<Array<{ label: string; value: string }>>([]);
  const [category,    setCategory]    = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [severity,    setSeverity]    = useState('');
  const [probability, setProbability] = useState('');
  const [stillPresent, setStillPresent] = useState(true);
  const [mitigation,  setMitigation]  = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  useEffect(() => {
    hazardService
      .categories()
      // The value is the name, not the id: risk_category is a name column.
      .then(rows => setCategories(rows.map(r => ({ label: r.category_name, value: r.category_name }))))
      .catch(() => setCategories([]));
  }, []);

  const rating: Rating | null = useMemo(() => {
    if (severity && probability) return RISK_MATRIX[severity]?.[probability] ?? null;
    return null;
  }, [severity, probability]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!category)            e.category = 'Select a category';
    if (!description.trim())  e.description = 'Describe what you saw';
    if (!severity)            e.severity = 'Select the severity';
    if (!probability)         e.probability = 'Select the likelihood';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await riskService.reportRisk({
        category,
        hazard_name: description.trim(),
        severity,
        probability,
        // Collected by this screen since it was written, and dropped by the
        // service before the request until now.
        location: location.trim() || undefined,
        still_present: stillPresent,
        suggested_controls: mitigation.trim() || undefined,
        photos: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      });
      Alert.alert(
        res.queued ? 'Saved — waiting to send' : 'Risk Reported',
        res.queued
          ? 'Saved on this device. There is no signal right now, so it will be sent automatically as soon as you are back online.'
          : `Your ${rating ?? ''} risk observation has been sent to your supervisor.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Submission Failed', 'Could not submit the risk report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <AppHeader title="Report a Risk" onBack={() => navigation.goBack()} rightIcon="🔔" />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FormSection label="Category" required>
          <Dropdown
            options={categories}
            value={category}
            onChange={v => { setCategory(v); setErrors(e => ({ ...e, category: '' })); }}
            placeholder={categories.length ? 'What kind of risk is it?' : 'Loading categories...'}
          />
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
        </FormSection>

        <FormSection label="What did you see?" required>
          <TextArea
            placeholder="Describe the unsafe condition, e.g. exposed live wiring near the walkway..."
            value={description}
            onChangeText={v => { setDescription(v); setErrors(e => ({ ...e, description: '' })); }}
            minHeight={100}
            maxLength={500}
            error={errors.description}
          />
        </FormSection>

        <FormSection label="Location">
          <Input
            placeholder="Where did you see it? e.g. Bay 4, Loading Dock"
            value={location}
            onChangeText={setLocation}
          />
        </FormSection>

        <FormSection label="Severity (Consequence)" required>
          <ChipSelector
            options={SEVERITIES}
            value={severity}
            onChange={v => { setSeverity(v); setErrors(e => ({ ...e, severity: '' })); }}
          />
          {errors.severity ? <Text style={styles.errorText}>{errors.severity}</Text> : null}
        </FormSection>

        <FormSection label="Likelihood (Probability)" required>
          <ChipSelector
            options={PROBABILITIES}
            value={probability}
            onChange={v => { setProbability(v); setErrors(e => ({ ...e, probability: '' })); }}
          />
          {errors.probability ? <Text style={styles.errorText}>{errors.probability}</Text> : null}
        </FormSection>

        {rating && (
          <View style={[styles.ratingCard, { borderColor: RATING_COLOR[rating] }]}>
            <Text style={styles.ratingLabel}>CALCULATED RISK RATING</Text>
            <View style={[styles.ratingBadge, { backgroundColor: RATING_COLOR[rating] }]}>
              <Text style={styles.ratingBadgeText}>{rating.toUpperCase()}</Text>
            </View>
          </View>
        )}

        <FormSection label="Photo Evidence">
          <MediaUploadBox
            items={mediaItems}
            onAdd={launchMedia}
            onRemove={removeMedia}
            subtitle="Tap to take a photo, record a video, or attach one you already have"
          />
        </FormSection>

        <FormSection label="Immediate Danger">
          <ToggleRow
            title="It is still there"
            subtitle="Is the danger active right now?"
            value={stillPresent}
            onChange={setStillPresent}
          />
        </FormSection>

        <FormSection label="Suggested Control / Mitigation">
          <TextArea
            placeholder="How could this be controlled or removed?"
            value={mitigation}
            onChangeText={setMitigation}
            minHeight={80}
          />
        </FormSection>

        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>SUBMIT RISK REPORT</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 16 },
  errorText: { fontSize: 12, color: Colors.critical, marginTop: 6 },
  ratingCard: {
    borderWidth: 1.5, borderRadius: 14, padding: 16, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card,
  },
  ratingLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.6 },
  ratingBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  ratingBadgeText: { color: Colors.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});
