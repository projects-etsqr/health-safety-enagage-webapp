import React from 'react';
import { ReportWorkflowList } from '../components/workflow/ReportWorkflowList';

/**
 * Supervisor review queue for worker-submitted risk reports.
 *
 * Reads risk_reports (field observations), not the hazards catalog — only the
 * workflow table carries a supervisor queue.
 */
export function RiskManagementScreen({ navigation }: any) {
  return (
    <ReportWorkflowList
      navigation={navigation}
      reportType="risk"
      // Titled for what it actually reads. "Hazard Management" collided with
      // the hazard register (flow 5), which is a different table and a
      // different lifecycle -- two screens under one name is how a supervisor
      // ends up looking for a register entry in the observation queue.
      title="Risk Observations"
      emptyTitle="No risk observations to review"
      emptyIcon="alert-circle-outline"
    />
  );
}
