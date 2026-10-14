/**
 * Manager · Training videos — view assigned videos and discuss them.
 *
 * Creating/editing/deleting videos and browsing all comments is an admin
 * (web panel) job, not a mobile one — this screen is the same "watch + discuss"
 * view every role gets, just reached from the manager's own menu since the
 * manager shell has no stack navigator to push a detail screen onto.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrainingListView, TrainingDetailView } from '../../components/training';
import { trainingService, TrainingVideo, TrainingComment } from '../../services/trainingService';

export function MgrTraining({ setCurrentScreen }: any) {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TrainingVideo | null>(null);
  const [comments, setComments] = useState<TrainingComment[]>([]);
  const [isLoadingComments, setLoadingComments] = useState(false);

  const loadVideos = useCallback(() => {
    setLoading(true);
    trainingService.getVideos().then(setVideos).finally(() => setLoading(false));
  }, []);

  useEffect(loadVideos, [loadVideos]);

  const openVideo = (video: TrainingVideo) => {
    setSelected(video);
    setLoadingComments(true);
    trainingService.getComments(video.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  };

  const onSubmitComment = async (text: string) => {
    if (!selected) return;
    const comment = await trainingService.postComment(selected.id, text);
    setComments((prev) => [comment, ...prev]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (selected ? setSelected(null) : setCurrentScreen('app'))}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Training</Text>
        <View style={{ width: 44 }} />
      </View>

      {selected ? (
        <TrainingDetailView
          video={selected}
          comments={comments}
          isLoadingComments={isLoadingComments}
          onSubmitComment={onSubmitComment}
        />
      ) : (
        <View style={styles.body}>
          <TrainingListView videos={videos} isLoading={isLoading} onRefresh={loadVideos} onSelect={openVideo} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerBack: { fontSize: 14, fontWeight: '700', color: '#2563EB', width: 44 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  body: { flex: 1, padding: 16 },
});
