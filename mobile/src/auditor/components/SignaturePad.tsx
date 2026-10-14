/**
 * On-device signature capture.
 *
 * "Both auditor and auditee sign before leaving site, so findings lock
 * immediately." That only works if signing happens on the phone that is already
 * in the auditor's hand — a signature collected later, on paper or by email, is
 * exactly the gap that lets findings drift between the walk and the report.
 *
 * Drawn with PanResponder into an SVG path and serialised as an SVG data URI.
 * No native signature library is in this project, and adding one for a canvas
 * that captures a few strokes would be a dependency for something react-native-svg
 * already does — it is a list of points and a stroke.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Stroke = string;   // one SVG path "M x y L x y L …"

export interface SignaturePadProps {
  label: string;
  /** Who is signing — printed under the line, and stored next to the image. */
  signerName?: string;
  height?: number;
  onChange: (dataUri: string | null) => void;
}

const WIDTH_FALLBACK = 320;

export function SignaturePad({ label, signerName, height = 160, onChange }: SignaturePadProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke>('');
  const [width, setWidth] = useState(WIDTH_FALLBACK);

  // Held in a ref as well as state: the PanResponder closure is created once and
  // would otherwise keep appending to the first empty string it ever saw.
  const currentRef = useRef('');
  const strokesRef = useRef<Stroke[]>([]);

  const emit = useCallback((all: Stroke[]) => {
    if (!all.length) { onChange(null); return; }
    const paths = all
      .map((d) => `<path d="${d}" stroke="#0F172A" stroke-width="2.5" fill="none" ` +
                  `stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${height}" ` +
      `viewBox="0 0 ${Math.round(width)} ${height}">${paths}</svg>`;
    // encodeURIComponent rather than base64: React Native has no btoa, and an
    // SVG data URI is valid either way.
    onChange(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  }, [onChange, width, height]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrent(currentRef.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCurrent(currentRef.current);
        },
        onPanResponderRelease: () => {
          if (!currentRef.current) return;
          const next = [...strokesRef.current, currentRef.current];
          strokesRef.current = next;
          setStrokes(next);
          currentRef.current = '';
          setCurrent('');
          emit(next);
        },
      }),
    [emit],
  );

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = '';
    setStrokes([]);
    setCurrent('');
    onChange(null);
  };

  const signed = strokes.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity onPress={clear} disabled={!signed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.clear, !signed && styles.clearOff]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[styles.pad, { height }, signed && styles.padSigned]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        <Svg width="100%" height={height}>
          {strokes.map((d, i) => (
            <Path key={i} d={d} stroke="#0F172A" strokeWidth={2.5} fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {!!current && (
            <Path d={current} stroke="#0F172A" strokeWidth={2.5} fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
        {!signed && <Text style={styles.hint}>Sign here</Text>}
      </View>

      <View style={styles.line} />
      <Text style={styles.signer}>{signerName || 'Name not set'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  clear: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  clearOff: { color: '#CBD5E1' },
  pad: {
    borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 12,
    backgroundColor: '#FFFFFF', overflow: 'hidden', justifyContent: 'center',
  },
  padSigned: { borderStyle: 'solid', borderColor: '#2563EB', backgroundColor: '#FFFFFF' },
  hint: {
    position: 'absolute', alignSelf: 'center', color: '#CBD5E1',
    fontSize: 13, fontWeight: '700',
  },
  line: { height: 1, backgroundColor: '#0F172A', marginTop: 8, opacity: 0.25 },
  signer: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginTop: 6 },
});

export default SignaturePad;
