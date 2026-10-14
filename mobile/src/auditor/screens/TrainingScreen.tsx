import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrainingListView } from '../../components/training';
import { trainingService, TrainingVideo } from '../../services/trainingService';

export default function TrainingScreen({ navigation }: any) {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    trainingService.getVideos().then(setVideos).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <View style={styles.screen}>
      <TrainingListView
        videos={videos}
        isLoading={isLoading}
        onRefresh={load}
        onSelect={(video) => navigation.navigate('TrainingDetail', { video })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
});
