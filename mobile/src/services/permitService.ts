import { apiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { Permit, PermitListResponse } from '../types/permit.types';

export const permitService = {
  async getPermits(params?: { status?: string; type?: string }): Promise<PermitListResponse> {
    const res = await apiClient.get<PermitListResponse>(ENDPOINTS.PERMITS.LIST, { params });
    return res.data;
  },

  async getPermit(id: string): Promise<Permit> {
    const res = await apiClient.get<Permit>(ENDPOINTS.PERMITS.DETAIL(id));
    return res.data;
  },

  async approvePermit(id: string, notes?: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PERMITS.APPROVE(id), { notes });
  },

  async rejectPermit(id: string, reason: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PERMITS.REJECT(id), { reason });
  },

  async acknowledgePermit(id: string, checklist: Record<string, boolean>): Promise<void> {
    await apiClient.post(ENDPOINTS.PERMITS.ACKNOWLEDGE(id), { checklist });
  },
};
