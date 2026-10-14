import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../layout/KeyboardAvoider';
// Must come from safe-area-context, not react-native: RN's own SafeAreaView is a
// no-op passthrough on Android, so the header rendered underneath the status bar.
// Every other screen in this app uses the context version (see ScreenLayout).
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../theme/colors';
import { askAi, aiErrorText, AiMessage } from '../../services/aiService';
import { MarkdownText } from './MarkdownText';

/**
 * Shared AI assistant chat, used by all four role apps.
 *
 * The screen is intentionally role-agnostic: the backend picks the data scope
 * and persona from the caller's JWT, so the only role-specific thing here is
 * the opening prompt suggestions, passed in by whichever dashboard opened it.
 */

interface Bubble extends AiMessage {
  id: string;
  failed?: boolean;
  /** Reply still arriving — drives the caret and suppresses the send button. */
  streaming?: boolean;
}

export interface AiChatScreenProps {
  navigation?: { goBack: () => void };
  route?: {
    params?: {
      title?: string;
      greeting?: string;
      suggestions?: string[];
    };
  };
}

const DEFAULT_GREETING =
  'Ask me anything about your safety data. I answer from your live records only.';

let bubbleSeq = 0;
const nextId = () => `m${++bubbleSeq}`;

export function AiChatScreen({ navigation, route }: AiChatScreenProps) {
  const title = route?.params?.title ?? 'HSE Assistant';
  const greeting = route?.params?.greeting ?? DEFAULT_GREETING;
  const suggestions = route?.params?.suggestions ?? [];

  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      // Snapshot the history *before* adding this turn — the backend expects
      // prior turns only, and re-sending the pending question would duplicate it.
      const history: AiMessage[] = messages
        .filter((m) => !m.failed)
        .map(({ role, content }) => ({ role, content }));

      // The assistant bubble is created up front and filled in as deltas land,
      // so the reply grows in place instead of appearing all at once at the end.
      const replyId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: question },
        { id: replyId, role: 'assistant', content: '', streaming: true },
      ]);
      setDraft('');
      setBusy(true);
      scrollToEnd();

      const patch = (fields: Partial<Bubble>) =>
        setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, ...fields } : m)));

      try {
        await askAi(question, history, (_chunk, sofar) => {
          patch({ content: sofar });
          scrollToEnd();
        });
        patch({ streaming: false });
      } catch (err: any) {
        patch({ streaming: false, failed: true, content: aiErrorText(err) });
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [busy, messages],
  );

  const empty = messages.length === 0;

  return (
    // 'top' keeps the header clear of the status bar / notch; 'bottom' keeps the
    // composer above the gesture bar. Left/right are omitted so the background
    // still runs edge to edge.
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.card} />
      <View style={styles.header}>
        {navigation ? (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.back}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textDark} />
          </TouchableOpacity>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
        >
          {empty && (
            <View style={styles.greetingWrap}>
              <View style={styles.greetingIcon}>
                <Ionicons name="sparkles-outline" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.greetingText}>{greeting}</Text>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestion}
                  onPress={() => send(s)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                  <Ionicons name="arrow-forward" size={15} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {messages.map((m) => {
            const mine = m.role === 'user';
            // Before the first delta lands there is nothing to show — the
            // "Reading your data…" row below stands in for this bubble.
            if (m.streaming && !m.content) return null;
            return (
              <View
                key={m.id}
                style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAi, m.failed && styles.bubbleFailed]}
              >
                {mine ? (
                  // The user's own text is never markdown — render it verbatim so
                  // a question containing * or _ isn't silently reformatted.
                  <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{m.content}</Text>
                ) : (
                  <MarkdownText
                    color={m.failed ? Colors.critical : Colors.textDark}
                    accent={Colors.primary}
                  >
                    {m.content}
                  </MarkdownText>
                )}
              </View>
            );
          })}

          {/* Only until the first token arrives — after that the reply itself is
              visibly growing, so a spinner alongside it just adds noise. */}
          {messages.some((m) => m.streaming && !m.content) && (
            <View style={[styles.bubble, styles.bubbleAi, styles.thinking]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.thinkingText}>Reading your data…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your safety data…"
            placeholderTextColor={Colors.textLight}
            multiline
            editable={!busy}
            onSubmitEditing={() => send(draft)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || busy) && styles.sendBtnOff]}
            onPress={() => send(draft)}
            disabled={!draft.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { width: 32, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textDark },

  list: { padding: 16, paddingBottom: 24 },

  greetingWrap: { alignItems: 'center', paddingVertical: 24 },
  greetingIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  greetingText: {
    fontSize: 14, color: Colors.textMid, textAlign: 'center',
    lineHeight: 20, marginBottom: 20, paddingHorizontal: 12,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'stretch', gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  suggestionText: { flex: 1, fontSize: 13, color: Colors.textDark, fontWeight: '600' },

  bubble: {
    maxWidth: '88%', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleAi: {
    alignSelf: 'flex-start', backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4,
  },
  bubbleFailed: { borderColor: Colors.critical, backgroundColor: Colors.criticalBg },
  bubbleText: { fontSize: 14, lineHeight: 21, color: Colors.textDark },
  bubbleTextMine: { color: Colors.white },

  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingText: { fontSize: 13, color: Colors.textMuted },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, color: Colors.textDark,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: Colors.textLight },
});

export default AiChatScreen;
