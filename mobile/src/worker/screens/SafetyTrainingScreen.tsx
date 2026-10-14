import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { AppHeader } from '../components/layout/AppHeader';
import { Card } from '../components/cards/Card';
import { Icon } from '../components/display/Icon';
import { EmptyState } from '../components/feedback/EmptyState';
import { Colors } from '../theme/colors';
import { useTraining } from '../hooks/useTraining';
import { TrainingCourse } from '../types';

function CourseCard({ course, onPress }: { course: TrainingCourse; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={styles.card} elevation={1}>
        <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>

        {course.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{course.description}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Icon name="video" size={12} color={Colors.textMuted} style={styles.metaChipIcon} />
            <Text style={styles.metaChipText}>Video</Text>
          </View>
          <View style={styles.cardArrow}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function SafetyTrainingScreen({ navigation }: any) {
  const { courses, isLoading, fetchCourses } = useTraining();

  useEffect(() => { fetchCourses(); }, []);
  const onRefresh = useCallback(() => { fetchCourses(); }, []);

  return (
    <ScreenLayout>
      <AppHeader title="Safety Training" onBack={() => navigation.goBack()} rightIcon="🎓" />

      {isLoading && courses.length === 0 ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No Training Videos"
          subtitle="Training videos assigned to your role will appear here."
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {courses.map(c => (
            <CourseCard
              key={c.id}
              course={c}
              onPress={() => navigation.navigate('SafetyTrainingDetail', { course: c })}
            />
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 16 },
  card:          { marginBottom: 12 },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: Colors.textDark, lineHeight: 20, marginBottom: 6 },
  cardDesc:      { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 8 },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaChip:      { flexDirection: 'row', alignItems: 'center' },
  metaChipIcon:  { marginRight: 4 },
  metaChipText:  { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  cardArrow:     { marginLeft: 'auto' },
  arrowIcon:     { fontSize: 22, color: Colors.textLight },
});
