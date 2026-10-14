import React from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';

export interface Hotspot {
  x: number;      // X coordinate in original image pixels
  y: number;      // Y coordinate in original image pixels
  w: number;      // Width in original image pixels
  h: number;      // Height in original image pixels
  target: string | (() => void); // Navigation target route name or callback
  params?: any;   // Navigation params
}

interface Props {
  source: any;
  originalWidth: number;
  originalHeight: number;
  hotspots?: Hotspot[];
  showBack?: boolean;
}

export function FigmaScreenWrapper({
  source,
  originalWidth,
  originalHeight,
  hotspots = [],
  showBack = false,
}: Props) {
  const navigation = useNavigation<any>();
  const { width: windowWidth } = useWindowDimensions();

  // Compute scaled height based on aspect ratio
  const scale = windowWidth / originalWidth;
  const scaledHeight = originalHeight * scale;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: windowWidth, height: scaledHeight }}
      >
        <Image
          source={source}
          style={{ width: windowWidth, height: scaledHeight }}
          resizeMode="stretch"
        />

        {hotspots.map((hs, index) => {
          const left = hs.x * scale;
          const top = hs.y * scale;
          const width = hs.w * scale;
          const height = hs.h * scale;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.hotspot,
                {
                  left,
                  top,
                  width,
                  height,
                },
              ]}
              onPress={() => {
                if (typeof hs.target === 'function') {
                  hs.target();
                } else if (hs.target === 'BACK') {
                  navigation.goBack();
                } else {
                  navigation.navigate(hs.target, hs.params);
                }
              }}
              activeOpacity={0.65}
            />
          );
        })}
      </ScrollView>

      {showBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  hotspot: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 74, 198, 0.0)', // fully transparent
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(11, 28, 48, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  backText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
