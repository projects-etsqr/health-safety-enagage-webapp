import { useState, useCallback } from 'react';
import { complianceService } from '../services/complianceService';
import { teamService } from '../services/teamService';
import type { DashboardStats, DashboardAlert } from '../types/compliance.types';
import type { ShiftStatus } from '../types/team.types';

export function useDashboard() {
  const [stats,       setStats]       = useState<DashboardStats | null>(null);
  const [alerts,      setAlerts]      = useState<DashboardAlert[]>([]);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [isLoading,   setLoading]     = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, sh] = await Promise.all([
        complianceService.getDashboardStats(),
        complianceService.getAlerts(),
        teamService.getShiftStatus(),
      ]);
      setStats(s);
      setAlerts(a);
      setShiftStatus(sh);
    } catch { /* screens remain with previous / null data */ }
    finally { setLoading(false); }
  }, []);

  return { stats, alerts, shiftStatus, isLoading, refresh };
}
