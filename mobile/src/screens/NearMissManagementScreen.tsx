import React from 'react';
import { ReportWorkflowList } from '../components/workflow/ReportWorkflowList';

/**
 * The supervisor's near misses, run on the eight-stage workflow engine.
 *
 * Stages 02 ASSESS through 04 INVESTIGATE are the supervisor's; 05 IMPROVE
 * onwards belongs to the CAPA owner and the manager. Records at those later
 * stages still show here, read-only and naming whose step it is, so a
 * supervisor chasing a near miss can see it is sitting with the manager rather
 * than assume it was dropped.
 */
export function NearMissManagementScreen({ navigation }: any) {
  return (
    <ReportWorkflowList
      navigation={navigation}
      reportType="near_miss"
      title="Near Misses"
      emptyTitle="No open near misses"
      emptyIcon="warning-outline"
    />
  );
}
