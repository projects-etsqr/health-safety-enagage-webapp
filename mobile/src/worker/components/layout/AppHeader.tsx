import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon, EMOJI_ICON_MAP } from '../display/Icon';

/** Accepts either a legacy emoji or a Feather icon name and returns a Feather name. */
const toIconName = (s?: string): string | undefined =>
  s ? EMOJI_ICON_MAP[s] ?? s : undefined;

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Pass onBack to show a back (←) button. Omit for menu screens. */
  onBack?: () => void;
  /** Custom left icon — defaults to ← when onBack provided, ☰ when omitted */
  leftIcon?: string;
  onLeftPress?: () => void;
  /** Right slot — either a preset or fully custom node */
  rightIcon?: string;
  onRightPress?: () => void;
  rightNode?: React.ReactNode;
  style?: ViewStyle;
  /** Use true for headers on white background (most screens) */
  light?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  rightNode,
  style,
  light = true,
}: AppHeaderProps) {
  const bg = light ? Colors.card : Colors.primary;
  const titleColor = light ? Colors.textDark : Colors.white;
  const subColor = light ? Colors.textMuted : 'rgba(255,255,255,0.6)';
  const iconColor = light ? Colors.textDark : Colors.white;

  const handleLeft = onLeftPress ?? onBack;
  const resolvedLeftIcon = toIconName(leftIcon) ?? (onBack ? 'arrow-left' : 'menu');
  const resolvedRightIcon = toIconName(rightIcon);

  return (
    <View style={[styles.header, { backgroundColor: bg, borderBottomColor: light ? Colors.border : 'transparent' }, style]}>
      {/* Left */}
      {handleLeft ? (
        <TouchableOpacity onPress={handleLeft} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name={resolvedLeftIcon} size={22} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}

      {/* Center */}
      <View style={styles.center}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text>}
      </View>

      {/* Right */}
      {rightNode ? (
        <View style={styles.iconBtn}>{rightNode}</View>
      ) : resolvedRightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name={resolvedRightIcon} size={22} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 1 },
});
