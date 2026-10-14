/**
 * The eight-stage lifecycle, rendered as a progress rail.
 *
 * Source of truth is the backend: every /incident-workflow response carries a
 * derived `stage` block, and this renders exactly what it is given. It does not
 * infer the stage from workflow_status — that mapping lives in one place
 * (backend/app/services/workflow_stages.py) and duplicating it here is how the
 * two would drift.
 *
 * RECORD is always shown complete. A report only exists once it has been
 * submitted, so capture is finished by the time there is anything to render.

 * Currently rendered nowhere. The eight-stage rail was taken off every mobile
 * screen on request — the stages themselves are unchanged and every endpoint
 * still returns them, so restoring this is a matter of putting the element
 * back. Kept rather than deleted for that reason, and because the stage
 * vocabulary it draws is the client's own (WF workflow engine).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  STAGE_SHORT_LABEL as SHORT_LABEL,
  WORKFLOW_STAGES,
  toStageInfo,
  type StageInfo,
  type WorkflowStageKey,
} from '../../services/workflowStages';

const ORDER: WorkflowStageKey[] = [...WORKFLOW_STAGES];

type Props = {
  /**
   * Either a StageInfo, or the record itself — incidents nest their stage in a
   * `stage` object while the other families return it flat, and `toStageInfo`
   * normalises both. Passing the record means a caller does not have to know
   * which family's endpoint it came from.
   */
  stage?: StageInfo | Record<string, any> | null;
  /** Hide the "Stage n of 8 · Label" caption when the parent already shows it. */
  showCaption?: boolean;
};

export function WorkflowStageBar({ stage: source, showCaption = true }: Props) {
  const stage = toStageInfo(source);
  // An unmapped status yields stage_number null. Rendering an all-grey rail is
  // the honest answer: we genuinely do not know where this record sits, and
  // guessing stage 1 would read as "just reported".
  const current = stage?.stage_number ?? 0;
  const isClosed = Boolean(stage?.is_closed);

  return (
    <View style={styles.wrap}>
      <View style={styles.rail}>
        {ORDER.map((key, i) => {
          const n = i + 1;
          const done = current > 0 && n < current;
          const active = current > 0 && n === current;

          return (
            <View key={key} style={styles.segment}>
              <View style={styles.dotRow}>
                <View
                  style={[
                    styles.connector,
                    i === 0 && styles.connectorHidden,
                    done || active ? styles.connectorDone : null,
                  ]}
                />
                <View
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    active && (isClosed ? styles.dotClosed : styles.dotActive),
                  ]}
                >
                  <Text
                    style={[
                      styles.dotText,
                      (done || active) && styles.dotTextOn,
                    ]}
                  >
                    {n}
                  </Text>
                </View>
                <View
                  style={[
                    styles.connector,
                    i === ORDER.length - 1 && styles.connectorHidden,
                    done ? styles.connectorDone : null,
                  ]}
                />
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
              >
                {SHORT_LABEL[key]}
              </Text>
            </View>
          );
        })}
      </View>

      {showCaption && (
        <Text style={styles.caption}>
          {current > 0
            ? `Stage ${current} of ${stage?.total_stages ?? 8} · ${stage?.stage_label ?? ''}`
            : 'Stage unknown — status not recognised by the workflow engine'}
          {stage?.stage_description ? ` — ${stage.stage_description}` : ''}
        </Text>
      )}
    </View>
  );
}

const DOT = 20;

const styles = StyleSheet.create({
  wrap: { paddingVertical: Spacing.sm },
  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  segment: { flex: 1, alignItems: 'center' },
  dotRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  connector: { flex: 1, height: 2, backgroundColor: Colors.border },
  connectorDone: { backgroundColor: Colors.primary },
  // Kept in the tree rather than removed so every segment keeps the same width
  // and the dots stay evenly spaced across the rail.
  connectorHidden: { backgroundColor: 'transparent' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dotActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  dotClosed: { backgroundColor: Colors.success, borderColor: Colors.success },
  dotText: { fontSize: 9, fontWeight: '800', color: Colors.textLight },
  dotTextOn: { color: Colors.white },
  label: {
    fontSize: 8,
    marginTop: 4,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  labelActive: { color: Colors.textDark, fontWeight: '800' },
  caption: {
    marginTop: Spacing.sm,
    fontSize: 11,
    color: Colors.textMid,
    lineHeight: 15,
  },
});
