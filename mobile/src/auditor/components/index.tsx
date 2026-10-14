/**
 * WF-05 shared UI — the pieces every auditor screen renders the same way.
 *
 * A classification chip that means one thing on the checklist and another on the
 * report is worse than no chip. These are the single rendering of the rubric's
 * vocabulary, so the walk, the review, the closing meeting and the report all
 * state a Major NC identically.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import {
  AuditStep, BAND_META, Classification, CLASSIFICATION_META, ItemResponse,
  OverallRating, RATING_META, RESPONSE_META, RISK_BAND_META, ScoreBand,
  stepStateColor,
} from '../services/auditService';

export const C = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  ink: '#0F172A',
  mid: '#475569',
  muted: '#64748B',
  light: '#94A3B8',
  brand: '#1D4ED8',
  brandSoft: '#EFF6FF',
  // The flow diagram's own palette: orange for automatic, red for a hard stop.
  automatic: '#EA580C',
  hardStop: '#DC2626',
};

// ── Header ───────────────────────────────────────────────────────────────────

export function ScreenHeader({
  title, subtitle, onBack, right,
}: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
      ) : <View style={{ width: 34 }} />}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <View style={s.headerRight}>{right}</View>
    </View>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────────

export function ClassificationChip({
  value, small, repeat,
}: { value?: Classification | null; small?: boolean; repeat?: boolean }) {
  if (!value) return null;
  const m = CLASSIFICATION_META[value];
  return (
    <View style={s.chipRow}>
      <View style={[s.chip, { backgroundColor: m.bg }, small && s.chipSmall]}>
        <Text style={[s.chipText, { color: m.color }, small && s.chipTextSmall]}>
          {small ? m.short : m.label.toUpperCase()}
        </Text>
      </View>
      {repeat && (
        <View style={[s.chip, s.repeatChip, small && s.chipSmall]}>
          <Ionicons name="repeat" size={small ? 9 : 11} color="#7C2D12" />
          <Text style={[s.chipText, { color: '#7C2D12' }, small && s.chipTextSmall]}>REPEAT</Text>
        </View>
      )}
    </View>
  );
}

export function RatingChip({ value }: { value?: OverallRating | null }) {
  if (!value) return null;
  const m = RATING_META[value];
  return (
    <View style={[s.chip, { backgroundColor: m.bg }]}>
      <Text style={[s.chipText, { color: m.color }]}>{m.label.toUpperCase()}</Text>
    </View>
  );
}

export function RiskBandChip({ value, small }: { value?: string | null; small?: boolean }) {
  if (!value) return null;
  const m = RISK_BAND_META[value.toLowerCase()] || RISK_BAND_META.low;
  return (
    <View style={[s.chip, { backgroundColor: m.bg }, small && s.chipSmall]}>
      <Text style={[s.chipText, { color: m.color }, small && s.chipTextSmall]}>
        {m.label.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Score ────────────────────────────────────────────────────────────────────

export function ScoreRing({
  score, band, size = 92, caption,
}: { score: number; band: ScoreBand; size?: number; caption?: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = BAND_META[band].color;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${(circ * pct) / 100} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={s.ringCentre}>
          <Text style={[s.ringScore, { color, fontSize: size * 0.25 }]}>{Math.round(score)}%</Text>
          <Text style={[s.ringBand, { color }]}>{BAND_META[band].label}</Text>
        </View>
      </View>
      {!!caption && <Text style={s.ringCaption}>{caption}</Text>}
    </View>
  );
}

// ── The point rubric selector ────────────────────────────────────────────────

const RESPONSES: ItemResponse[] = ['full', 'partial', 'none', 'na'];

export function ResponseSelector({
  value, onChange, disabled,
}: { value?: ItemResponse | null; onChange: (v: ItemResponse) => void; disabled?: boolean }) {
  return (
    <View style={s.respRow}>
      {RESPONSES.map((r) => {
        const m = RESPONSE_META[r];
        const active = value === r;
        return (
          <TouchableOpacity
            key={r}
            style={[s.respBtn, active && { backgroundColor: m.bg, borderColor: m.color }, disabled && s.respOff]}
            onPress={() => !disabled && onChange(r)}
            activeOpacity={0.85}
          >
            <Text style={[s.respLabel, active && { color: m.color }]}>{m.label}</Text>
            <Text style={[s.respPoints, active && { color: m.color }]}>{m.points}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── The ten-step tracker ─────────────────────────────────────────────────────

export function StepTracker({
  steps, onPressStep, compact,
}: { steps: AuditStep[]; onPressStep?: (s: AuditStep) => void; compact?: boolean }) {
  if (compact) {
    return (
      <View style={s.pipRow}>
        {steps.map((st) => {
          const c = stepStateColor(st.state);
          return (
            <View key={st.number} style={[s.pip, { backgroundColor: c.fg === '#94A3B8' ? '#E2E8F0' : c.fg }]} />
          );
        })}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stepScroll}>
      {steps.map((st) => {
        const c = stepStateColor(st.state);
        const Wrapper: any = onPressStep ? TouchableOpacity : View;
        return (
          <Wrapper
            key={st.number}
            style={[s.stepCard, { borderColor: st.state === 'todo' ? C.border : c.fg }]}
            onPress={onPressStep ? () => onPressStep(st) : undefined}
            activeOpacity={0.85}
          >
            <View style={s.stepTop}>
              <View style={[s.stepNum, { backgroundColor: c.bg }]}>
                {st.state === 'done' ? (
                  <Ionicons name="checkmark" size={13} color={c.fg} />
                ) : st.state === 'blocked' ? (
                  <Ionicons name="lock-closed" size={11} color={c.fg} />
                ) : (
                  <Text style={[s.stepNumText, { color: c.fg }]}>{String(st.number).padStart(2, '0')}</Text>
                )}
              </View>
              {st.automatic && <Ionicons name="flash" size={11} color={C.automatic} />}
              {st.hard_stop && !st.automatic && <Ionicons name="alert-circle" size={11} color={C.hardStop} />}
            </View>
            <Text style={s.stepPhase}>{st.phase}</Text>
            <Text style={[s.stepLabel, st.state === 'todo' && { color: C.light }]} numberOfLines={2}>
              {st.label}
            </Text>
            <Text style={s.stepOwner} numberOfLines={1}>{st.owner_label || st.owner}</Text>
          </Wrapper>
        );
      })}
    </ScrollView>
  );
}

// ── Layout helpers ───────────────────────────────────────────────────────────

export function Card({
  title, subtitle, right, children, tone,
}: {
  title?: string; subtitle?: string; right?: React.ReactNode;
  children?: React.ReactNode; tone?: 'default' | 'warn' | 'danger' | 'ok';
}) {
  const toneStyle =
    tone === 'danger' ? s.cardDanger : tone === 'warn' ? s.cardWarn : tone === 'ok' ? s.cardOk : null;
  return (
    <View style={[s.card, toneStyle]}>
      {(title || right) && (
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            {!!title && <Text style={s.cardTitle}>{title}</Text>}
            {!!subtitle && <Text style={s.cardSub}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function KV({ k, v, vColor }: { k: string; v: React.ReactNode; vColor?: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.k}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number'
        ? <Text style={[s.v, vColor ? { color: vColor } : null]}>{v}</Text>
        : v}
    </View>
  );
}

export function PrimaryButton({
  label, onPress, icon, disabled, tone, loading,
}: {
  label: string; onPress: () => void; icon?: string; disabled?: boolean;
  tone?: 'brand' | 'danger' | 'ok'; loading?: boolean;
}) {
  const bg = disabled ? '#CBD5E1' : tone === 'danger' ? '#DC2626' : tone === 'ok' ? '#059669' : C.brand;
  return (
    <TouchableOpacity
      style={[s.primaryBtn, { backgroundColor: bg }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
    >
      {!!icon && <Ionicons name={icon as any} size={17} color="#FFFFFF" />}
      <Text style={s.primaryBtnText}>{loading ? 'Working…' : label}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({
  label, onPress, icon, tone,
}: { label: string; onPress: () => void; icon?: string; tone?: 'brand' | 'danger' }) {
  const col = tone === 'danger' ? '#DC2626' : C.brand;
  return (
    <TouchableOpacity style={[s.ghostBtn, { borderColor: col }]} onPress={onPress} activeOpacity={0.85}>
      {!!icon && <Ionicons name={icon as any} size={16} color={col} />}
      <Text style={[s.ghostBtnText, { color: col }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Banner({
  tone, title, text, icon,
}: { tone: 'danger' | 'warn' | 'info' | 'ok'; title: string; text?: string; icon?: string }) {
  const map = {
    danger: { bg: '#FEF2F2', bd: '#FECACA', fg: '#B91C1C', ic: 'alert-circle' },
    warn: { bg: '#FFFBEB', bd: '#FDE68A', fg: '#B45309', ic: 'warning' },
    info: { bg: '#EFF6FF', bd: '#BFDBFE', fg: '#1D4ED8', ic: 'information-circle' },
    ok: { bg: '#ECFDF5', bd: '#A7F3D0', fg: '#047857', ic: 'checkmark-circle' },
  }[tone];
  return (
    <View style={[s.banner, { backgroundColor: map.bg, borderColor: map.bd }]}>
      <Ionicons name={(icon || map.ic) as any} size={17} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.bannerTitle, { color: map.fg }]}>{title}</Text>
        {!!text && <Text style={[s.bannerText, { color: map.fg }]}>{text}</Text>}
      </View>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

export function Empty({ icon, text }: { icon?: string; text: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={(icon || 'file-tray-outline') as any} size={30} color={C.light} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    minHeight: 58, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#EEF2F6',
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  headerSub: { fontSize: 11, fontWeight: '600', color: C.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  chipTextSmall: { fontSize: 9 },
  repeatChip: { backgroundColor: '#FFEDD5' },

  ringCentre: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontWeight: '900' },
  ringBand: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: -2 },
  ringCaption: { fontSize: 10, fontWeight: '700', color: C.muted, marginTop: 6 },

  respRow: { flexDirection: 'row', gap: 8 },
  respBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  respOff: { opacity: 0.45 },
  respLabel: { fontSize: 12, fontWeight: '800', color: C.mid },
  respPoints: { fontSize: 9, fontWeight: '700', color: C.light, marginTop: 2 },

  stepScroll: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },
  stepCard: {
    width: 128, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5,
    padding: 10, gap: 2,
  },
  stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  stepNum: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 10, fontWeight: '900' },
  stepPhase: { fontSize: 8, fontWeight: '900', color: C.light, letterSpacing: 0.7 },
  stepLabel: { fontSize: 12, fontWeight: '800', color: C.ink, lineHeight: 15 },
  stepOwner: { fontSize: 9, fontWeight: '700', color: C.muted, marginTop: 2 },

  pipRow: { flexDirection: 'row', gap: 3 },
  pip: { flex: 1, height: 3, borderRadius: 2 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 12,
  },
  cardDanger: { borderColor: '#FECACA', backgroundColor: '#FFFBFB' },
  cardWarn: { borderColor: '#FDE68A', backgroundColor: '#FFFDF7' },
  cardOk: { borderColor: '#A7F3D0', backgroundColor: '#FAFFFD' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.ink },
  cardSub: { fontSize: 11, fontWeight: '600', color: C.muted, marginTop: 2, lineHeight: 15 },

  kv: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12,
  },
  k: { fontSize: 12, color: C.muted, fontWeight: '600' },
  v: { fontSize: 12, color: C.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, height: 50,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 12, height: 46, borderWidth: 1.5, backgroundColor: '#FFFFFF',
  },
  ghostBtnText: { fontSize: 13, fontWeight: '800' },

  banner: {
    flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  bannerTitle: { fontSize: 13, fontWeight: '800' },
  bannerText: { fontSize: 11.5, lineHeight: 16, marginTop: 3, fontWeight: '600' },

  sectionLabel: {
    fontSize: 11, fontWeight: '900', color: C.light, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8, marginTop: 4,
  },

  empty: { alignItems: 'center', paddingVertical: 34, gap: 8 },
  emptyText: { fontSize: 12.5, fontWeight: '600', color: C.muted, textAlign: 'center', paddingHorizontal: 30 },
});

export { s as auditStyles };
