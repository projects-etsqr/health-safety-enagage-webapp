import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';

interface Props {
  title: string;
  onBack?: () => void;
  rightNode?: React.ReactNode;
  dark?: boolean;
  showBell?: boolean;
  onBell?: () => void;
}

export function AppHeader({ title, onBack, rightNode, dark, showBell, onBell }: Props) {
  const insets = useSafeAreaInsets();
  const bg = dark ? Colors.primary : Colors.background;
  const color = dark ? Colors.white : Colors.textDark;

  return (
    <View style={[styles.header, { backgroundColor: bg, paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={color} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="menu" size={22} color={color} />
        </TouchableOpacity>
      )}
      <Text style={[styles.title, { color }]}>{title}</Text>
      <View style={styles.right}>
        {showBell && (
          <TouchableOpacity onPress={onBell} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={color} />
          </TouchableOpacity>
        )}
        {rightNode}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 4 },
});
