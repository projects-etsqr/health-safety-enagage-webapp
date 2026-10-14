import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrainingDetailView } from '../../components/training';
import { trainingService, TrainingComment } from '../../services/trainingService';

export default function TrainingDetailScreen({ route, navigation }: any) {
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
    <View style={styles.screen}>
      <TrainingDetailView
        video={video}
        comments={comments}
        isLoadingComments={isLoadingComments}
        onSubmitComment={onSubmitComment}
        onBack={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
});
