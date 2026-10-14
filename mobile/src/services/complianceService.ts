import { apiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type {
  ComplianceMetrics,
  ComplianceException,
  GearCheckWorker,
  ExpiringPermit,
  DashboardStats,
  DashboardAlert,
} from '../types/compliance.types';

export const complianceService = {
  async getMetrics(): Promise<ComplianceMetrics> {
    const res = await apiClient.get<ComplianceMetrics>(ENDPOINTS.COMPLIANCE.METRICS);
    return res.data;
  },

  async getExceptions(): Promise<ComplianceException[]> {
    const res = await apiClient.get<ComplianceException[]>(ENDPOINTS.COMPLIANCE.EXCEPTIONS);
    return res.data;
  },

  async getGearCheck(): Promise<GearCheckWorker[]> {
    const res = await apiClient.get<GearCheckWorker[]>(ENDPOINTS.COMPLIANCE.GEAR_CHECK);
    return res.data;
  },

  async getExpiringPermits(): Promise<ExpiringPermit[]> {
    const res = await apiClient.get<ExpiringPermit[]>(ENDPOINTS.COMPLIANCE.EXPIRING_PERMITS);
    return res.data;
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await apiClient.get<DashboardStats>(ENDPOINTS.DASHBOARD.STATS);
    return res.data;
  },

  async getAlerts(): Promise<DashboardAlert[]> {
    const res = await apiClient.get<DashboardAlert[]>(ENDPOINTS.DASHBOARD.ALERTS);
    return Array.isArray(res.data) ? res.data : [];
  },

  async remindWorker(exceptionId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.COMPLIANCE.REMIND(exceptionId));
  },
};
