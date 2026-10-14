import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../theme/colors';
import { initials } from '../../utils/formatters';

const BG_COLORS = ['#004AC6', '#16A34A', '#7B1FA2', '#F97316', '#0097A7', '#BA1A1A'];

interface Props {
  name?: string;
  uri?: string;
  size?: number;
  style?: object;
}

export function Avatar({ name, uri, size = 40, style }: Props) {
  const bg = name
    ? BG_COLORS[name.charCodeAt(0) % BG_COLORS.length]
    : Colors.textLight;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.white, fontWeight: '700' },
});
