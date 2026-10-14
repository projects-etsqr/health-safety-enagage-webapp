import React, { useState } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { askAi, aiErrorText, AiMessage } from '../../services/aiService';
import { MarkdownText } from '../../components/AiAssistant/MarkdownText';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  checklist?: string[];
  doc?: { title: string; desc: string };
  /** Reply still arriving from the streaming endpoint. */
  streaming?: boolean;
}

const clockNow = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function AISafetyAssistantScreen({ navigation }: any) {
  // ScreenLayout renders a plain View, so the composer had no bottom inset and
  // sat underneath the gesture bar on gesture-navigation devices.
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const firstName = (user?.name || '').split(' ')[0];

  // Opens with a greeting only. The previous seed conversation asserted specific
  // PPE requirements for a named zone that no query ever produced — invented
  // safety guidance a worker could act on, so it is not reinstated here.
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: firstName
        ? `Hello ${firstName}. I'm your AI Safety Assistant. Ask me about your tasks, shifts or reports.`
        : "I'm your AI Safety Assistant. Ask me about your tasks, shifts or reports.",
      time: clockNow(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    const question = inputText.trim();
    if (!question || busy) return;

    // Prior turns only — the pending question is passed separately.
    const history: AiMessage[] = messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    // Created empty and filled in as deltas arrive, so the answer grows in place.
    const replyId = `a${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: `u${Date.now()}`, sender: 'user', text: question, time: clockNow() },
      { id: replyId, sender: 'ai', text: '', time: clockNow(), streaming: true },
    ]);
    setInputText('');
    setBusy(true);

    const patch = (fields: Partial<Message>) =>
      setMessages(prev => prev.map(m => (m.id === replyId ? { ...m, ...fields } : m)));

    try {
      await askAi(question, history, (_chunk, sofar) => patch({ text: sofar }));
      patch({ streaming: false });
    } catch (err: any) {
      patch({ streaming: false, text: aiErrorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenLayout bg="#F8FAFC">
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon emoji="←" style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Safety Assistant</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
          <Icon emoji="🔔" style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      {/* Keyboard avoidance is ScreenLayout's job now — see KeyboardAvoider.
          It wraps the header too, which is what a pinned composer wants: the
          header holds still and the chat area takes the shrink. */}
      <View style={styles.container}>
        <ScrollView
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dateLabel}>
            <Text style={styles.dateText}>Today</Text>
          </View>

          {messages.map(msg => msg.streaming && !msg.text ? (
            // Waiting on the first delta — show the robot with a spinner rather
            // than an empty speech bubble.
            <View key={msg.id} style={[styles.messageRow, styles.messageRowAi]}>
              <View style={styles.aiIconBox}>
                <Icon emoji="🤖" style={styles.aiIcon} />
              </View>
              <View style={styles.messageContent}>
                <View style={[styles.bubble, styles.bubbleAi, styles.thinkingBubble]}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.thinkingText}>Reading your data…</Text>
                </View>
              </View>
            </View>
          ) : (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === 'user' ? styles.messageRowUser : styles.messageRowAi,
              ]}
            >
              {/* Icon */}
              {msg.sender === 'ai' && (
                <View style={styles.aiIconBox}>
                  <Icon emoji="🤖" style={styles.aiIcon} />
                </View>
              )}

              <View style={styles.messageContent}>
                <View
                  style={[
                    styles.bubble,
                    msg.sender === 'user' ? styles.bubbleUser : styles.bubbleAi,
                  ]}
                >
                  {msg.sender === 'user' ? (
                    // Verbatim — the worker's own wording, never reformatted.
                    <Text style={[styles.msgText, styles.msgTextUser]}>{msg.text}</Text>
                  ) : (
                    <MarkdownText color="#1E293B" accent="#2563EB" fontSize={14} lineHeight={20}>
                      {msg.text}
                    </MarkdownText>
                  )}

                  {/* Checklist */}
                  {msg.checklist && (
                    <View style={styles.checklist}>
                      {msg.checklist.map((item, idx) => (
                        <View key={idx} style={styles.checkItem}>
                          <Icon emoji="✓" style={styles.checkIcon} />
                          <Text style={styles.checkText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Doc Box */}
                  {msg.doc && (
                    <View style={styles.docBox}>
                      <View style={styles.pdfIcon}>
                        <Text style={styles.pdfIconText}>PDF</Text>
                      </View>
                      <View style={styles.docDetails}>
                        <Text style={styles.docTitle}>{msg.doc.title}</Text>
                        <Text style={styles.docDesc}>{msg.doc.desc}</Text>
                      </View>
                      <Icon emoji="⎋" style={styles.docOpenIcon} />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.timeText,
                    msg.sender === 'user' ? styles.timeTextUser : styles.timeTextAi,
                  ]}
                >
                  {msg.time}
                </Text>
              </View>

              {msg.sender === 'user' && (
                <View style={styles.userIconBox}>
                  <Icon emoji="👤" style={styles.userIcon} />
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Suggestion pills */}
        <View style={styles.suggestions}>
          <TouchableOpacity style={styles.pill} onPress={() => setInputText('How to report an unsafe act?')}>
            <Text style={styles.pillText}>How to report an unsafe act?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => setInputText('Permit guidance')}>
            <Text style={styles.pillText}>Permit guidance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => setInputText('Latest incident reports')}>
            <Text style={styles.pillText}>Latest incident reports</Text>
          </TouchableOpacity>
        </View>

        {/* Input area */}
        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.attachmentBtn}>
            <Icon emoji="📎" style={styles.attachmentIcon} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about your tasks, shifts or reports..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            editable={!busy}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={busy || !inputText.trim()}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon emoji="➤" style={styles.sendIcon} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerIcon: {
    fontSize: 22,
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
  },
  dateLabel: {
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  aiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    elevation: 1,
  },
  aiIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  userIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    elevation: 1,
  },
  userIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  messageContent: {
    maxWidth: '75%',
  },
  bubble: {
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  bubbleAi: {
    backgroundColor: '#EFF6FF',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#2563EB',
    borderTopRightRadius: 4,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    fontSize: 13,
    color: '#64748B',
  },
  msgText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    fontWeight: '500',
  },
  msgTextUser: {
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  timeTextAi: {
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  timeTextUser: {
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  checklist: {
    marginTop: 12,
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
    marginRight: 8,
  },
  checkText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  docBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pdfIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pdfIconText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  docDetails: {
    flex: 1,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  docDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  docOpenIcon: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 6,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  attachmentBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentIcon: {
    fontSize: 22,
    color: '#64748B',
  },
  textInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
