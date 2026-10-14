import { useState, useCallback } from 'react';
import { incidentService } from '../services/incidentService';
import { Incident, ReportIncidentRequest, ReportNearMissRequest, ReportUnsafeActRequest } from '../types';

/**
 * `queued` means the report was saved on the device because there was no
 * signal, and will be sent on reconnect. Screens must say so rather than
 * claiming a successful submission — see services/offlineQueue.ts.
 */
export interface ReportOutcome {
  ok: boolean;
  queued: boolean;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async (params?: { type?: string; status?: string; mine?: boolean }) => {
    setLoading(true);
    try {
      const res = await incidentService.getIncidents(params);
      setIncidents(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, []);

  const reportIncident = useCallback(async (payload: ReportIncidentRequest): Promise<ReportOutcome> => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentService.reportIncident(payload);
      // A queued draft has no server record yet, so nothing goes into the list.
      if (!res.queued && res.data) setIncidents(prev => [res.data as Incident, ...prev]);
      return { ok: true, queued: res.queued };
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit report');
      return { ok: false, queued: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const reportNearMiss = useCallback(async (payload: ReportNearMissRequest): Promise<ReportOutcome> => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentService.reportNearMiss(payload);
      // A queued draft has no server record yet, so nothing goes into the list.
      if (!res.queued && res.data) setIncidents(prev => [res.data as Incident, ...prev]);
      return { ok: true, queued: res.queued };
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit near miss');
      return { ok: false, queued: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const reportUnsafeAct = useCallback(async (payload: ReportUnsafeActRequest): Promise<ReportOutcome> => {
    setLoading(true);
    setError(null);
    try {
      const res = await incidentService.reportUnsafeAct(payload);
      // A queued draft has no server record yet, so nothing goes into the list.
      if (!res.queued && res.data) setIncidents(prev => [res.data as Incident, ...prev]);
      return { ok: true, queued: res.queued };
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit observation');
      return { ok: false, queued: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return { incidents, isLoading, error, fetchIncidents, reportIncident, reportNearMiss, reportUnsafeAct };
}
