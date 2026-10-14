import apiClient from '../api/client';

export interface SOSPayload {
  message?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export interface SOSResponse {
  id: string;
  sos_ref: string;
  status: string;
  raised_by: string;
  created_at: string;
}

export const sosService = {
  async triggerSOS(payload: SOSPayload = {}): Promise<SOSResponse> {
    const { data } = await apiClient.post<SOSResponse>('/worker/sos', payload);
    return data;
  },
};
