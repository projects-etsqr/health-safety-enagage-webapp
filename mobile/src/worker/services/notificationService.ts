import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  read: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
}

export const notificationService = {
  async getNotifications(): Promise<NotificationListResponse> {
    const { data } = await apiClient.get<NotificationListResponse>(ENDPOINTS.NOTIFICATIONS.LIST);
    return data;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  },

  async markAllRead(): Promise<void> {
    await apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },
};
