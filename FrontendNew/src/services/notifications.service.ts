import axiosInstance from '../api/axiosInstance';

export interface NotificationItem {
  id: number;
  organisation_id: number | null;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'maintenance' | 'announcement';
  target_type: 'all' | 'specific';
  status: string;
  is_read: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Set on CAPA/audit chase notifications (migration 061) — "CAPA-000123" or
  // "AUD-000123"/"RPT-000123" — so the client can deep-link to the action
  // instead of making the user go and find it by hand. Absent on broadcasts.
  category: string | null;
  subject_ref: string | null;
}

/** Where clicking a notification should take the user, or null for a plain
 * broadcast with nothing to open (falls back to the notifications list). */
export function resolveNotificationLink(n: Pick<NotificationItem, 'subject_ref' | 'category'>): string | null {
  const match = n.subject_ref ? /^([A-Z]+)-0*(\d+)$/.exec(n.subject_ref) : null;
  if (match) {
    const [, prefix, numStr] = match;
    const id = Number(numStr);
    if (Number.isFinite(id) && id > 0) {
      if (prefix === 'CAPA') return `/capa-actions/${id}`;
      // AUD and RPT notifications both name the same audit row — report_ref
      // is just a different label stamped on the same id at the
      // report-issued stage.
      if (prefix === 'AUD' || prefix === 'RPT') return `/audits/${id}`;
    }
  }
  // Aggregate notifications ("11 corrective actions are overdue") don't name
  // one record, so subject_ref never matches above — route by category to
  // the matching filtered list instead of falling back to the plain
  // notifications page.
  if (n.category === 'capa_overdue_summary') return '/capa-actions?overdue=1';
  return null;
}

export const getNotifications = (skip = 0, limit = 50) =>
  axiosInstance.get<NotificationItem[]>('/notifications/', { params: { skip, limit } }).then(r => r.data);

export const getUnreadCount = () =>
  axiosInstance.get<{ count: number }>('/notifications/unread-count').then(r => r.data.count);

export const markNotificationRead = (id: number) =>
  axiosInstance.post(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  axiosInstance.post('/notifications/read-all');
