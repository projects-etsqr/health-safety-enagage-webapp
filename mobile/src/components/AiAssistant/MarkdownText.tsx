import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';

/**
 * Renders an assistant reply as markdown.
 *
 * The role prompts ask the model for markdown (bold figures, short bullet
 * lists), but both chat screens rendered replies in a plain <Text>, so users
 * saw literal `**asterisks**` and `-` characters. This turns that into real
 * formatting while keeping each screen's own colours.
 *
 * Deliberately narrow: only the subset the assistant actually emits is styled —
 * bold, bullets, paragraphs, headings, code and links. Tables and images are
 * left at library defaults; the prompts discourage both on mobile.
 */

export interface MarkdownTextProps {
  children: string;
  /** Body text colour — pass the bubble's own text colour. */
  color?: string;
  /** Colour for links and bullet markers. */
  accent?: string;
  fontSize?: number;
  lineHeight?: number;
}

export function MarkdownText({
  children,
  color = '#0B1C30',
  accent = '#004AC6',
  fontSize = 14,
  lineHeight = 21,
}: MarkdownTextProps) {
  // Rebuilding this object every render would remount the whole tree on each
  // keystroke in the composer, so it is memoised per colour/size combination.
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { color, fontSize, lineHeight },
        paragraph: { marginTop: 0, marginBottom: 8, color, fontSize, lineHeight },
        strong: { fontWeight: '700', color },
        em: { fontStyle: 'italic', color },
        bullet_list: { marginTop: 2, marginBottom: 6 },
        ordered_list: { marginTop: 2, marginBottom: 6 },
        list_item: { marginBottom: 3, color, fontSize, lineHeight },
        bullet_list_icon: { color: accent, marginRight: 6, marginLeft: 0 },
        ordered_list_icon: { color: accent, marginRight: 6, marginLeft: 0 },
        heading1: { fontSize: fontSize + 3, fontWeight: '700', color, marginTop: 2, marginBottom: 6 },
        heading2: { fontSize: fontSize + 2, fontWeight: '700', color, marginTop: 2, marginBottom: 6 },
        heading3: { fontSize: fontSize + 1, fontWeight: '700', color, marginTop: 2, marginBottom: 4 },
        code_inline: {
          backgroundColor: 'rgba(127,127,127,0.14)',
          color,
          paddingHorizontal: 4,
          borderRadius: 4,
          fontSize: fontSize - 1,
        },
        fence: {
          backgroundColor: 'rgba(127,127,127,0.12)',
          borderWidth: 0,
          borderRadius: 8,
          padding: 10,
          color,
          fontSize: fontSize - 1,
        },
        code_block: {
          backgroundColor: 'rgba(127,127,127,0.12)',
          borderWidth: 0,
          borderRadius: 8,
          padding: 10,
          color,
          fontSize: fontSize - 1,
        },
        link: { color: accent, textDecorationLine: 'underline' },
        hr: { backgroundColor: 'rgba(127,127,127,0.3)', height: 1, marginVertical: 8 },
        blockquote: {
          backgroundColor: 'rgba(127,127,127,0.08)',
          borderLeftWidth: 3,
          borderLeftColor: accent,
          paddingHorizontal: 10,
          paddingVertical: 4,
          marginVertical: 4,
        },
      }),
    [color, accent, fontSize, lineHeight],
  );

  // A non-string slipping through (a thrown object, a null answer) would crash
  // the parser and take the whole chat screen down with it.
  if (typeof children !== 'string' || children.length === 0) {
    return null;
  }

  try {
    return <Markdown style={styles}>{children}</Markdown>;
  } catch {
    // Malformed markdown should degrade to plain text, never blank the reply.
    return <Text style={{ color, fontSize, lineHeight }}>{children}</Text>;
  }
}

export default MarkdownText;
