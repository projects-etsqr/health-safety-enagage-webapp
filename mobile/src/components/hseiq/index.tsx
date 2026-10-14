/**
 * Shared presentation for the WF-06 … WF-09 screens.
 *
 * All four role apps show the same handful of concepts — a gate verdict, a
 * banded score, a domain breakdown — and they must look and read identically
 * everywhere, because a supervisor and an auditor discussing the same permit
 * need to be looking at the same thing.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

export const HSE_COLORS = {
  pass: '#10B981',
  amber: '#F59E0B',
  block: '#EF4444',
  passBg: '#ECFDF5',
  amberBg: '#FEF3C7',
  blockBg: '#FEF2F2',

  critical: '#DC2626',
  high: '#EF4444',
  elevated: '#F59E0B',
  acceptable: '#3B82F6',
  low: '#10B981',

  card: '#FFFFFF',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  textDark: '#0F172A',
  textMid: '#334155',
  textMuted: '#64748B',
  textLight: '#94A3B8',
};

export function bandColor(band?: string): string {
  switch ((band || '').toLowerCase()) {
    case 'critical': return HSE_COLORS.critical;
    case 'high': return HSE_COLORS.high;
    case 'elevated': return HSE_COLORS.elevated;
    case 'acceptable': return HSE_COLORS.acceptable;
    case 'low': return HSE_COLORS.low;
    case 'block': return HSE_COLORS.block;
    case 'signoff': return HSE_COLORS.block;
    case 'amber': return HSE_COLORS.amber;
    case 'pass': return HSE_COLORS.pass;
    default: return HSE_COLORS.textMuted;
  }
}

/** A single gate verdict row — the same shape in every role app. */
export function GateRow({ gate }: { gate: { gate_key: string; verdict: string; reason: string; hard?: boolean } }) {
  const color = bandColor(gate.verdict);
  const label = gate.gate_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <View style={[styles.gateRow, { borderLeftColor: color }]}>
      <View style={styles.gateHead}>
        <Text style={styles.gateLabel}>{label}</Text>
        <View style={[styles.pill, { backgroundColor: color }]}>
          <Text style={styles.pillText}>{gate.verdict.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.gateReason}>{gate.reason}</Text>
      {gate.hard ? (
        <Text style={styles.hardBlock}>
          Hard block — this cannot be overridden by anyone.
        </Text>
      ) : null}
    </View>
  );
}

/** Overall verdict banner shown above a gate list. */
export function GateBanner({ overall, reasons }: { overall: string; reasons?: string[] }) {
  const color = bandColor(overall);
  const bg =
    overall === 'pass' ? HSE_COLORS.passBg : overall === 'amber' ? HSE_COLORS.amberBg : HSE_COLORS.blockBg;
  const title =
    overall === 'pass' ? 'All gates passed'
      : overall === 'amber' ? 'Proceed with acknowledgement'
      : 'Blocked by the gate engine';
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.bannerTitle, { color }]}>{title}</Text>
      {(reasons || []).map((r, i) => (
        <Text key={i} style={styles.bannerReason}>• {r}</Text>
      ))}
    </View>
  );
}

/** Big banded number — SPS, fatigue index, journey risk. */
export function ScoreTile({
  value, band, label, sub,
}: { value: number | string; band?: string; label: string; sub?: string }) {
  const color = bandColor(band);
  return (
    <View style={styles.scoreTile}>
      <Text style={[styles.scoreValue, { color }]}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
      {band ? (
        <View style={[styles.pill, { backgroundColor: color, marginTop: 6 }]}>
          <Text style={styles.pillText}>{band.toUpperCase()}</Text>
        </View>
      ) : null}
      {sub ? <Text style={styles.scoreSub}>{sub}</Text> : null}
    </View>
  );
}

/** One weighted domain in the five-domain breakdown. */
export function DomainBar({
  name, score, weight,
}: { name: string; score: number; weight?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = bandColor(
    score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'elevated' : score >= 10 ? 'acceptable' : 'low',
  );
  return (
    <View style={styles.domainRow}>
      <View style={styles.domainHead}>
        <Text style={styles.domainName}>{name}</Text>
        <Text style={[styles.domainScore, { color }]}>
          {score.toFixed(1)}
          {weight ? <Text style={styles.domainWeight}>  ×{weight}</Text> : null}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function Card({ title, children, right }: any) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={HSE_COLORS.acceptable} />
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label, onPress, disabled, tone = 'primary', busy,
}: {
  label: string; onPress: () => void; disabled?: boolean;
  tone?: 'primary' | 'danger' | 'success'; busy?: boolean;
}) {
  const bg =
    disabled ? '#CBD5E1'
      : tone === 'danger' ? HSE_COLORS.block
      : tone === 'success' ? HSE_COLORS.pass
      : '#2563EB';
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

/** Compact 1..N segmented picker used by the journey risk factors. */
export function Segmented({
  value, max, onChange, labels,
}: { value: number; max: number; onChange: (v: number) => void; labels?: string[] }) {
  return (
    <View style={styles.segRow}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => {
        const active = n === value;
        return (
          <TouchableOpacity
            key={n}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => onChange(n)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {labels?.[n - 1] ?? n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HSE_COLORS.card, borderRadius: 12, padding: 16,
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: HSE_COLORS.textDark },

  gateRow: {
    borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 10,
    marginBottom: 8, backgroundColor: '#FFF', borderRadius: 6,
  },
  gateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gateLabel: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  gateReason: { fontSize: 12, color: HSE_COLORS.textMuted, marginTop: 4, lineHeight: 17 },
  hardBlock: { fontSize: 11, color: HSE_COLORS.block, fontWeight: '700', marginTop: 6 },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  banner: { borderWidth: 1, borderRadius: 10, padding: 14, marginHorizontal: 16, marginTop: 12 },
  bannerTitle: { fontSize: 15, fontWeight: '800' },
  bannerReason: { fontSize: 12, color: HSE_COLORS.textMid, marginTop: 6, lineHeight: 17 },

  scoreTile: { alignItems: 'center', paddingVertical: 14, flex: 1 },
  scoreValue: { fontSize: 40, fontWeight: '800' },
  scoreLabel: { fontSize: 12, color: HSE_COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  scoreSub: { fontSize: 11, color: HSE_COLORS.textLight, marginTop: 6, textAlign: 'center' },

  domainRow: { marginBottom: 14 },
  domainHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  domainName: { fontSize: 13, color: HSE_COLORS.textMid, flex: 1 },
  domainScore: { fontSize: 13, fontWeight: '700' },
  domainWeight: { fontSize: 11, color: HSE_COLORS.textMuted, fontWeight: '400' },
  track: { height: 8, backgroundColor: '#EEF2F7', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },

  empty: { padding: 28, alignItems: 'center' },
  emptyText: { color: HSE_COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8 },

  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: HSE_COLORS.border,
  },
  segActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  segText: { fontSize: 13, fontWeight: '600', color: HSE_COLORS.textMid },
  segTextActive: { color: '#fff' },
});
