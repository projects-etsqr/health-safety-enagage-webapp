import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { Card } from '../components/cards/Card';
import { ProgressBar } from '../components/display/ProgressBar';
import { StepDots } from '../components/display/StepDots';
import { Icon } from '../components/display/Icon';
import { Colors } from '../theme/colors';

const STEPS = [
  { num: 1, title: 'Initial Safety Check', desc: 'Verify all safety equipment is in place. Check PPE requirements for the area.' },
  { num: 2, title: 'Isolate Energy Sources', desc: 'Follow LOTO procedure. Tag all isolation points and verify zero energy state.' },
  { num: 3, title: 'Internal Pressure Verification',
    desc: 'Slowly open bypass valve V-102 and monitor gauge G-45 until pressure stabilizes at 12.5 bar.',
    safetyNote: 'Wear hearing protection. High pressure release risk.',
    highlight: ['V-102', 'G-45'] },
  { num: 4, title: 'Calibration Measurement',   desc: 'Record gauge readings at 5-minute intervals for 30 minutes.' },
  { num: 5, title: 'Close-out & Documentation', desc: 'Complete checklist, restore energy sources, and submit report.' },
];

function HighlightText({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <Text style={styles.stepDesc}>{text}</Text>;
  const parts = text.split(new RegExp(`(${terms.join('|')})`));
  return (
    <Text style={styles.stepDesc}>
      {parts.map((p, i) =>
        terms.includes(p) ? <Text key={i} style={styles.highlight}>{p}</Text> : p
      )}
    </Text>
  );
}

export default function PerformTaskScreen({ route, navigation }: any) {
  const task = route?.params?.task ?? { title: 'Pressure Valve Calibration', location: 'Unit 4 - Distillation Tower' };
  const [current, setCurrent] = useState(2);
  const step = STEPS[current];
  const progress = Math.round(((current) / STEPS.length) * 100);

  const completeStep = () => {
    if (current < STEPS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      Alert.alert('Task Complete', 'All steps completed!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  };

  return (
    <ScreenLayout>
      <AppHeader
        title="Perform Task"
        subtitle="HOUSTON REFINERY"
        onBack={() => navigation.goBack()}
        rightIcon="⊞"
      />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.taskSub}>{task.location}</Text>

        <Card style={styles.progressCard} elevation={2}>
          <ProgressBar
            progress={progress}
            label={`Progress: ${progress}%`}
            rightLabel={`Step ${current + 1} of ${STEPS.length}`}
            height={8}
          />
        </Card>

        <Card style={styles.stepCard} elevation={2}>
          <View style={styles.stepNumBadge}>
            <Text style={styles.stepNumText}>{step.num}</Text>
          </View>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <HighlightText text={step.desc} terms={step.highlight} />
          {step.safetyNote && (
            <View style={styles.safetyNote}>
              <View style={styles.safetyLabelRow}>
                <Icon name="alert-triangle" size={12} color={Colors.critical} style={{ marginRight: 4 }} />
                <Text style={styles.safetyLabel}>SAFETY NOTE</Text>
              </View>
              <Text style={styles.safetyText}>{step.safetyNote}</Text>
            </View>
          )}
        </Card>

        <StepDots total={STEPS.length} current={current} onPress={setCurrent} style={styles.dots} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.completeBtn} onPress={completeStep}>
          <Text style={styles.completeBtnText}>
            {current < STEPS.length - 1 ? 'Complete Step' : 'Finish Task'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 16 },
  taskTitle: { fontSize: 22, fontWeight: '800', color: Colors.textDark, marginBottom: 4, marginTop: 8 },
  taskSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 18 },

  progressCard: { marginBottom: 16 },

  stepCard: { marginBottom: 16, borderColor: Colors.blue, borderWidth: 2 },
  stepNumBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  stepNumText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  stepTitle: { fontSize: 17, fontWeight: '700', color: Colors.textDark, marginBottom: 10 },
  stepDesc: { fontSize: 15, lineHeight: 22, color: Colors.textMid },
  highlight: {
    backgroundColor: '#E3F2FD', color: Colors.blue,
    fontWeight: '700', paddingHorizontal: 4, borderRadius: 4,
  },
  safetyNote: {
    marginTop: 16, backgroundColor: Colors.criticalBg,
    borderLeftWidth: 4, borderLeftColor: Colors.critical,
    padding: 12, borderRadius: 8,
  },
  safetyLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  safetyLabel: { fontSize: 11, fontWeight: '700', color: Colors.critical, letterSpacing: 0.5 },
  safetyText: { fontSize: 14, color: '#B71C1C', fontWeight: '500' },

  dots: { marginBottom: 24 },

  footer: {
    padding: 16, backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  completeBtn: {
    backgroundColor: Colors.textMid, borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  completeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
