import React from 'react';
import { StyleSheet, TextStyle, StyleProp } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

/**
 * Black outline icon wrapper around Feather (react-native-vector-icons).
 *
 * Replaces the colourful emoji glyphs that used to be rendered inside <Text>.
 * Pass either a Feather `name` directly, or an `emoji` to be looked up in the
 * shared map below. Size/colour are read from the passed `style` (fontSize /
 * color) when not supplied explicitly, so existing icon styles keep working.
 */

// Maps the emojis previously used across the worker app to Feather icon names.
export const EMOJI_ICON_MAP: Record<string, string> = {
  '📋': 'clipboard',
  '🚨': 'alert-octagon',
  '⚠️': 'alert-triangle',
  '⚠': 'alert-triangle',
  '🔔': 'bell',
  '📝': 'edit-3',
  '🛑': 'octagon',
  '🎓': 'award',
  '📈': 'trending-up',
  '📍': 'map-pin',
  '🛡️': 'shield',
  '🛡': 'shield',
  '✅': 'check-circle',
  '✔️': 'check',
  '✓': 'check',
  '📄': 'file-text',
  '☰': 'menu',
  '←': 'arrow-left',
  '→': 'arrow-right',
  '➔': 'arrow-right',
  '❯': 'chevron-right',
  '📷': 'camera',
  '🕒': 'clock',
  '👁️': 'eye',
  '👁': 'eye',
  '📅': 'calendar',
  '🔬': 'search',
  '🔧': 'tool',
  '🔍': 'search',
  '🩹': 'plus-square',
  '📹': 'video',
  '⭐': 'star',
  '📥': 'download',
  '📖': 'book-open',
  '💬': 'message-circle',
  '🤖': 'cpu',
  '💾': 'save',
  '🔥': 'zap',
  '⬜': 'square',
  '⛏️': 'tool',
  '⛏': 'tool',
  '⚡': 'zap',
  '📞': 'phone',
  '🧯': 'shield',
  '🏠': 'home',
  '👤': 'user',
  '👷': 'user',
  '🦺': 'shield',
  '🧗': 'chevrons-up',
  '🆔': 'hash',
  '🔑': 'key',
  '🙈': 'eye-off',
  '🔒': 'lock',
  '🔓': 'unlock',
  '▶': 'play',
  '▶️': 'play',
  '↺': 'rotate-ccw',
  '✕': 'x',
  '✖': 'x',
  '📊': 'bar-chart-2',
  '🚀': 'send',
  '➕': 'plus',
  '+': 'plus',
  '🖊️': 'edit-2',
  '🖊': 'edit-2',
  '🏆': 'award',
  '⚙️': 'settings',
  '⚙': 'settings',
  '🎬': 'film',
  '⛶': 'maximize',
  '➤': 'send',
  '📎': 'paperclip',
  '⎋': 'external-link',
  '⏱️': 'clock',
  '⏱': 'clock',
  '⏸️': 'pause',
  '⏸': 'pause',
  '🔖': 'bookmark',
  '☁️': 'upload-cloud',
  '☁': 'upload-cloud',
  '📭': 'inbox',
  'ℹ️': 'info',
  'ℹ': 'info',
  '•': 'circle',
  '📸': 'camera',
  '🖼️': 'image',
  '🖼': 'image',
  '🚛': 'truck',
};

export interface IconProps {
  /** Feather icon name (takes precedence over `emoji`). */
  name?: string;
  /** Legacy emoji to resolve via EMOJI_ICON_MAP. */
  emoji?: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const DEFAULT_SIZE = 20;
const DEFAULT_COLOR = '#111111';

export const Icon: React.FC<IconProps> = ({ name, emoji, size, color, style }) => {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const { fontSize, color: styleColor, lineHeight, ...rest } = flat;

  const resolvedName = name ?? (emoji ? EMOJI_ICON_MAP[emoji] : undefined) ?? 'help-circle';
  const resolvedSize = size ?? (typeof fontSize === 'number' ? fontSize : DEFAULT_SIZE);
  const resolvedColor = color ?? (styleColor as string) ?? DEFAULT_COLOR;

  return (
    <Feather name={resolvedName} size={resolvedSize} color={resolvedColor} style={rest} />
  );
};

export default Icon;
