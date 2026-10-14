import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { initials } from '../../utils/formatters';

interface AvatarProps {
  name?: string;
  emoji?: string;
  size?: number;
  bg?: string;
  style?: ViewStyle;
}

export function Avatar({ name, emoji, size = 40, bg = 'rgba(255,255,255,0.2)', style }: AvatarProps) {
  const fontSize = size * 0.38;
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, style]}>
      {emoji
        ? <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
        : <Text style={[styles.text, { fontSize }]}>{name ? initials(name) : '?'}</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.white, fontWeight: '800' },
});
