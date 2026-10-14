/**
 * Training videos — shared presentation for all 4 mobile roles.
 *
 * Kept prop-driven (no data fetching in here) because worker's api client has
 * its own silent-refresh-on-401 behaviour that the top-level client used by
 * supervisor/manager/auditor doesn't share — each role fetches through its own
 * service and hands the result to these views, so this file never has to pick
 * a client.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { Card, EmptyState, Loading, PrimaryButton, HSE_COLORS } from '../hseiq';
import type { TrainingVideo, TrainingComment } from '../../services/trainingService';

export function TrainingListView({
  videos, isLoading, onRefresh, onSelect,
}: {
  videos: TrainingVideo[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelect: (video: TrainingVideo) => void;
}) {
  if (isLoading && videos.length === 0) return <Loading text="Loading training videos…" />;

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {videos.length === 0 ? (
        <EmptyState text="No training videos assigned to your role yet." />
      ) : (
        videos.map((v) => (
          <TouchableOpacity key={v.id} onPress={() => onSelect(v)} activeOpacity={0.85}>
            <Card>
              <Text style={styles.listTitle} numberOfLines={2}>{v.title}</Text>
              {v.description ? (
                <Text style={styles.listDesc} numberOfLines={2}>{v.description}</Text>
              ) : null}
              <View style={styles.videoChip}>
                <Text style={styles.videoChipText}>▶ Video</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

export function TrainingDetailView({
  video, comments, isLoadingComments, onSubmitComment, onBack,
}: {
  video: TrainingVideo;
  comments: TrainingComment[];
  isLoadingComments: boolean;
  onSubmitComment: (text: string) => Promise<void>;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await onSubmitComment(text);
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backRow}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      ) : null}

      <Card>
        <Text style={styles.detailTitle}>{video.title}</Text>
        {video.description ? <Text style={styles.detailDesc}>{video.description}</Text> : null}
        <PrimaryButton label="Watch Video" onPress={() => Linking.openURL(video.video_url)} />
      </Card>

      <Card title={`Comments (${comments.length})`}>
        {isLoadingComments ? (
          <ActivityIndicator color={HSE_COLORS.acceptable} />
        ) : comments.length === 0 ? (
          <Text style={styles.noComments}>Be the first to comment.</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>{c.author_name ?? 'Anonymous'}</Text>
              <Text style={styles.commentText}>{c.comment_text}</Text>
              <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString()}</Text>
            </View>
          ))
        )}

        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            placeholder="Write a comment…"
            placeholderTextColor={HSE_COLORS.textLight}
            value={draft}
            onChangeText={setDraft}
            multiline
            editable={!posting}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || posting) && styles.sendBtnDisabled]}
            onPress={submit}
            disabled={!draft.trim() || posting}
          >
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listTitle: { fontSize: 15, fontWeight: '700', color: HSE_COLORS.textDark },
  listDesc: { fontSize: 13, color: HSE_COLORS.textMuted, marginTop: 4, lineHeight: 18 },
  videoChip: {
    alignSelf: 'flex-start', marginTop: 10, backgroundColor: HSE_COLORS.passBg,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  videoChipText: { fontSize: 11, fontWeight: '700', color: HSE_COLORS.pass },

  backRow: { paddingHorizontal: 16, paddingTop: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: HSE_COLORS.acceptable },

  detailTitle: { fontSize: 18, fontWeight: '800', color: HSE_COLORS.textDark },
  detailDesc: { fontSize: 13.5, color: HSE_COLORS.textMid, lineHeight: 19, marginTop: 8, marginBottom: 4 },

  noComments: { fontSize: 13, color: HSE_COLORS.textMuted, fontStyle: 'italic' },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HSE_COLORS.border },
  commentAuthor: { fontSize: 12.5, fontWeight: '700', color: HSE_COLORS.textDark },
  commentText: { fontSize: 13, color: HSE_COLORS.textMid, marginTop: 2, lineHeight: 18 },
  commentTime: { fontSize: 10.5, color: HSE_COLORS.textLight, marginTop: 4 },

  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  composerInput: {
    flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderColor: HSE_COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5, color: HSE_COLORS.textDark,
  },
  sendBtn: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 16, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
