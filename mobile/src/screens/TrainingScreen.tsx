import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrainingListView } from '../components/training';
import { trainingService, TrainingVideo } from '../services/trainingService';

export function TrainingScreen({ navigation }: any) {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    trainingService.getVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.body}>
        <TrainingListView
          videos={videos}
          isLoading={isLoading}
          onRefresh={load}
          onSelect={(video) => navigation.navigate('TrainingDetail', { video })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { flex: 1, padding: 16 },
});
