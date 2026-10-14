import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrainingDetailView } from '../components/training';
import { trainingService, TrainingComment } from '../services/trainingService';

export function TrainingDetailScreen({ route, navigation }: any) {
  const video = route.params?.video;
  const [comments, setComments] = useState<TrainingComment[]>([]);
  const [isLoadingComments, setLoadingComments] = useState(false);

  const load = useCallback(() => {
    setLoadingComments(true);
    trainingService.getComments(video.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [video.id]);

  useEffect(load, [load]);

  const onSubmitComment = async (text: string) => {
    const comment = await trainingService.postComment(video.id, text);
    setComments((prev) => [comment, ...prev]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <TrainingDetailView
          video={video}
          comments={comments}
          isLoadingComments={isLoadingComments}
          onSubmitComment={onSubmitComment}
          onBack={() => navigation.goBack()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { flex: 1 },
});
