import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react-native';
import {
  incidentWorkflowService,
  type NextActionItem,
} from '../../services/incidentWorkflowService';

/**
 * "Needs your action" — the manager's queue of outstanding steps.
 *
 * The dashboard's severity tiles answer how bad the estate is. They never
 * answered what to do now, so an incident could sit in IMPROVE indefinitely
 * with a single unsigned CAPA holding it and nothing on screen saying so.
 * Every row here names the specific step, what clearing it unblocks, and
 * routes straight to the screen that performs it.
 */

const STAGE_TINT: Record<string, { bg: string; fg: string }> = {
  RECORD: { bg: '#EEF2FB', fg: '#4A57B9' },
  ASSESS: { bg: '#FEF3C7', fg: '#B45309' },
  RESPOND: { bg: '#FFEDD5', fg: '#EA580C' },
  INVESTIGATE: { bg: '#DBEAFE', fg: '#1D4ED8' },
  IMPROVE: { bg: '#E0E7FF', fg: '#4338CA' },
  VERIFY: { bg: '#DCFCE7', fg: '#15803D' },
  LEARN: { bg: '#F3E8FF', fg: '#7E22CE' },
  CLOSE: { bg: '#F1F5F9', fg: '#475569' },
};

interface Props {
  onOpen: (item: NextActionItem) => void;
  /** Bumped by the parent after any workflow write, to force a refetch. */
  refreshKey?: number;
  /**
   * Only this manager's own steps (the dashboard preview) or every open
   * incident (the Tasks tab's list, where they came to look at the family).
   * Steps sitting with a supervisor still render, saying whose they are.
   */
  mineOnly?: boolean;
  /** How many rows before "show N more". `false` renders the lot. */
  preview?: number | false;
  /** The dashboard's caption. The full-screen list has its own header. */
  heading?: string | null;
}

export function NeedsYourAction({
  onOpen, refreshKey = 0, mineOnly = true, preview = 3, heading = 'NEEDS YOUR ACTION',
}: Props) {
  const [items, setItems] = useState<NextActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    incidentWorkflowService
      .getNextActions(mineOnly)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mineOnly]);

  useEffect(() => { load(); }, [load, refreshKey, mineOnly]);

  if (loading && items.length === 0) {
    return (
      <View style={styles.wrap}>
        {!!heading && <Text style={styles.heading}>{heading}</Text>}
        <ActivityIndicator color="#0B3D91" style={{ marginVertical: 16 }} />
      </View>
    );
  }

  // An empty queue is worth saying out loud — it is the difference between
  // "nothing is waiting on me" and "the list failed to load".
  if (items.length === 0) {
    return (
      <View style={styles.wrap}>
        {!!heading && <Text style={styles.heading}>{heading}</Text>}
        <View style={styles.clearCard}>
          <CheckCircle2 size={18} color="#15803D" />
          <Text style={styles.clearText}>Nothing is waiting on you right now.</Text>
        </View>
      </View>
    );
  }

  const shown = preview === false || expanded ? items : items.slice(0, preview);

  return (
    <View style={styles.wrap}>
      {!!heading && (
        <View style={styles.headRow}>
          <Text style={styles.heading}>{heading}</Text>
          <View style={styles.countPill}><Text style={styles.countText}>{items.length}</Text></View>
        </View>
      )}

      {shown.map((item) => {
        const tint = STAGE_TINT[item.stage ?? ''] ?? STAGE_TINT.CLOSE;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, item.is_overdue && styles.cardOverdue]}
            activeOpacity={0.85}
            onPress={() => onOpen(item)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.ref}>{item.reference}</Text>
              {!!item.priority && (
                <View style={styles.prioPill}><Text style={styles.prioText}>{item.priority}</Text></View>
              )}
              <View style={[styles.stagePill, { backgroundColor: tint.bg }]}>
                <Text style={[styles.stageText, { color: tint.fg }]}>
                  {String(item.stage_number ?? '').padStart(2, '0')} {item.stage}
                </Text>
              </View>
              {item.is_overdue && (
                <View style={styles.overduePill}>
                  <Clock3 size={10} color="#B91C1C" />
                  <Text style={styles.overdueText}>OVERDUE</Text>
                </View>
              )}
            </View>

            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.detail} numberOfLines={2}>{item.detail}</Text>

            {/* The specific thing blocking an IMPROVE-stage incident, so the
                manager does not have to open it to find out which CAPA. */}
            {!!item.subject && (
              <View style={styles.subject}>
                <Text style={styles.subjectRef}>{item.subject.reference}</Text>
                <Text style={styles.subjectDesc} numberOfLines={1}>{item.subject.description}</Text>
                {!!item.subject.due_date && (
                  <Text style={styles.subjectDue}>due {item.subject.due_date}</Text>
                )}
              </View>
            )}

            <Text style={styles.incidentDesc} numberOfLines={1}>{item.description}</Text>

            <View style={styles.ctaRow}>
              {!!item.unblocks && (
                <Text style={styles.unblocks}>→ unblocks {item.unblocks}</Text>
              )}
              <View style={styles.ctaBtn}>
                <Text style={styles.ctaText}>{item.cta}</Text>
                <ArrowRight size={13} color="#FFFFFF" />
              </View>
            </View>

            {(item.is_hipo || item.statutory_reportable) && (
              <View style={styles.flagRow}>
                <ShieldAlert size={11} color="#B91C1C" />
                <Text style={styles.flagText}>
                  {[item.is_hipo && 'High potential', item.statutory_reportable && 'Statutory reportable']
                    .filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {preview !== false && items.length > preview && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.moreBtn}>
          <Text style={styles.moreText}>
            {expanded ? 'Show fewer' : `Show ${items.length - preview} more`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heading: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
  countPill: { backgroundColor: '#0B3D91', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  clearCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1,
    borderRadius: 12, padding: 14,
  },
  clearText: { fontSize: 13, color: '#166534', fontWeight: '600' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E3E9F6',
  },
  cardOverdue: { borderColor: '#FCA5A5', backgroundColor: '#FFFBFB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  ref: { fontSize: 12, fontWeight: '800', color: '#0B3D91' },
  prioPill: { backgroundColor: '#FEE2E2', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  prioText: { fontSize: 10, fontWeight: '800', color: '#B91C1C' },
  stagePill: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  stageText: { fontSize: 10, fontWeight: '800' },
  overduePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEE2E2', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  overdueText: { fontSize: 9, fontWeight: '800', color: '#B91C1C' },

  action: { fontSize: 15, fontWeight: '800', color: '#0B1C30', marginBottom: 2 },
  detail: { fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 8 },

  subject: {
    backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#4338CA',
  },
  subjectRef: { fontSize: 11, fontWeight: '800', color: '#4338CA' },
  subjectDesc: { fontSize: 12, color: '#334155', marginTop: 1 },
  subjectDue: { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  incidentDesc: { fontSize: 11, color: '#94A3B8', marginBottom: 10 },

  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unblocks: { fontSize: 10, color: '#64748B', flex: 1 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0B3D91', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  ctaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  flagText: { fontSize: 10, color: '#B91C1C', fontWeight: '700' },

  moreBtn: { alignItems: 'center', paddingVertical: 8 },
  moreText: { fontSize: 12, fontWeight: '700', color: '#0B3D91' },
});
