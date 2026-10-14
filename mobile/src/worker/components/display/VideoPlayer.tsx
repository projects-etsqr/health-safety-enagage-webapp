import React, { useRef, useState } from 'react';
import { Icon } from './Icon';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import type { VideoRef } from 'react-native-video';
import type { OnLoadData, OnProgressData, OnBufferData } from 'react-native-video';
import { Colors } from '../../theme/colors';

interface VideoPlayerProps {
  uri?: string | null;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ uri }: VideoPlayerProps) {
  const videoRef   = useRef<VideoRef>(null);
  const [paused,   setPaused]   = useState(true);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const [buffering,setBuffering]= useState(false);
  const [ended,    setEnded]    = useState(false);
  const [barW,     setBarW]     = useState(1);

  const progress = duration > 0 ? current / duration : 0;

  const togglePlay = () => {
    if (ended) {
      videoRef.current?.seek(0);
      setEnded(false);
      setPaused(false);
    } else {
      setPaused(p => !p);
    }
  };

  const handleSeekTap = (e: any) => {
    if (!duration) return;
    const x      = e.nativeEvent.locationX;
    const seekTo = Math.max(0, Math.min((x / barW) * duration, duration));
    videoRef.current?.seek(seekTo);
    setCurrent(seekTo);
  };

  // ── No video URL: placeholder ─────────────────────────────────────────────
  if (!uri) {
    return (
      <View style={styles.placeholder}>
        <Icon emoji="🎬" style={styles.phIcon} />
        <Text style={styles.phTitle}>Video Coming Soon</Text>
        <Text style={styles.phSub}>Video content will appear here once it has been uploaded to the course.</Text>
      </View>
    );
  }

  // ── Real video player ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Video surface */}
      <TouchableOpacity style={styles.surface} onPress={togglePlay} activeOpacity={1}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          paused={paused}
          resizeMode="contain"
          onLoad={({ duration: d }: OnLoadData) => setDuration(d)}
          onProgress={({ currentTime }: OnProgressData) => setCurrent(currentTime)}
          onBuffer={({ isBuffering }: OnBufferData) => setBuffering(isBuffering)}
          onEnd={() => { setEnded(true); setPaused(true); }}
          onError={() => {}}
        />

        {/* Buffering spinner */}
        {buffering && (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

        {/* Centre play/pause icon — visible when paused */}
        {(paused || ended) && !buffering && (
          <View style={styles.bigPlayBtn}>
            <Icon name={ended ? 'rotate-ccw' : 'play'} style={styles.bigPlayIcon} />
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={togglePlay} style={styles.ctrlBtn}>
          <Icon name={paused ? 'play' : 'pause'} style={styles.ctrlIcon} />
        </TouchableOpacity>

        <Text style={styles.timeLabel}>{fmt(current)}</Text>

        {/* Seek bar */}
        <TouchableOpacity
          style={styles.seekTrack}
          onPress={handleSeekTap}
          onLayout={e => setBarW(e.nativeEvent.layout.width || 1)}
          activeOpacity={1}
        >
          <View style={styles.seekBg} />
          <View style={[styles.seekFill, { width: `${Math.round(progress * 100)}%` }]} />
          <View style={[styles.seekKnob, { left: `${Math.round(progress * 100)}%` }]} />
        </TouchableOpacity>

        <Text style={styles.timeLabel}>{fmt(duration)}</Text>

        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => videoRef.current?.presentFullscreenPlayer()}
        >
          <Icon emoji="⛶" style={styles.ctrlIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Placeholder
  placeholder: {
    height: 200, borderRadius: 14, backgroundColor: '#263238',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  phIcon:  { fontSize: 40, marginBottom: 10 },
  phTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6 },
  phSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18 },

  // Player
  container: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },

  surface: { height: 210, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  spinnerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bigPlayBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  bigPlayIcon: { fontSize: 28, color: '#fff', marginLeft: 4 },

  // Controls bar
  controls: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 8, gap: 6,
  },
  ctrlBtn:   { padding: 4 },
  ctrlIcon:  { fontSize: 18, color: '#fff' },
  timeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', minWidth: 32, textAlign: 'center' },

  seekTrack: { flex: 1, height: 20, justifyContent: 'center' },
  seekBg:    { ...StyleSheet.absoluteFill, top: 8, bottom: 8, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  seekFill:  { position: 'absolute', left: 0, top: 8, bottom: 8, borderRadius: 3, backgroundColor: Colors.primary },
  seekKnob:  {
    position: 'absolute', top: '50%', marginTop: -7, marginLeft: -7,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.white,
    elevation: 2,
  },
});
