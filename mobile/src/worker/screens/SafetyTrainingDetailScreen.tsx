import React, { useEffect, useState } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Linking, ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { useTraining } from '../hooks/useTraining';
import { TrainingCourse } from '../types';

export default function SafetyTrainingDetailScreen({ route, navigation }: any) {
  const course: TrainingCourse = route.params?.course;
  const { comments, isLoadingComments, fetchComments, postComment } = useTraining();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => { fetchComments(course.id); }, [course.id]);

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await postComment(course.id, text);
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <ScreenLayout bg="#F8FAFC">
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon emoji="←" style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ehsera</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon emoji="🔔" style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.titleText}>{course.title}</Text>
        {course.description ? <Text style={styles.descText}>{course.description}</Text> : null}

        <TouchableOpacity style={styles.watchBtn} onPress={() => Linking.openURL(course.video_url)}>
          <Icon emoji="▶" style={styles.watchIcon} />
          <Text style={styles.watchBtnText}>Watch Video</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Comments ({comments.length})</Text>

          {isLoadingComments ? (
            <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>Be the first to comment.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Text style={styles.commentAuthor}>{c.author_name ?? 'Anonymous'}</Text>
                <Text style={styles.commentText}>{c.comment_text}</Text>
                <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString()}</Text>
              </View>
            ))
          )}

          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              placeholder="Write a comment…"
              placeholderTextColor="#94A3B8"
              value={draft}
              onChangeText={setDraft}
              multiline
              editable={!posting}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || posting) && styles.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!draft.trim() || posting}
            >
              {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  scroll: {
    flex: 1,
    padding: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  descText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
    fontWeight: '500',
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    gap: 8,
    marginBottom: 20,
  },
  watchIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  watchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  noComments: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  commentRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commentAuthor: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  commentText: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0F172A',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
