import React from 'react';
import { HazardRegisterManagementScreen } from './HazardRegisterManagementScreen';

/**
 * Supervisor review queue for worker-submitted unsafe acts.
 *
 * Used to be its own read-only list over `unsafe_acts` ("Safety Observations"
 * was the wording here, before the merge). Migration 080/081 folded Unsafe Act
 * into the standing hazard register and moved the worker's submission flow
 * (LogHazardScreen) to post there instead — but this screen, and every
 * Dashboard/Tasks/Operations card still routing to it, kept reading the old
 * table, which the worker stopped writing to. New unsafe acts landed in the
 * register and were invisible here.
 *
 * Same fix the codebase already uses for a screen two names now point at:
 * render the real one.
 */
export function SafetyObservationManagementScreen(props: any) {
  return <HazardRegisterManagementScreen {...props} />;
}
