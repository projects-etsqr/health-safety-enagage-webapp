import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export type ShiftType = 'Morning' | 'Afternoon' | 'Night';

export interface ShiftRecord {
  id: number;
  shift_date: string | null;
  shift_type: string | null;
  shift_start: string | null;
  shift_end: string | null;
  actual_hours_worked: number | null;
  station_id: number | null;
  station_name: string | null;
  /** Supervisor has confirmed the shift (spec's "Shift Confirmed" notification). */
  confirmed: boolean;
}

export interface ShiftCheckInPayload {
  shift_date: string;
  shift_type: ShiftType;
  shift_start?: string;
  shift_end?: string;
  actual_hours_worked: number;
  station_id?: number;
}

export const shiftService = {
  async myShifts(): Promise<ShiftRecord[]> {
    // apiClient's response interceptor already strips the { success, data }
    // envelope, so `data` is the array itself — do not unwrap it twice.
    const { data } = await apiClient.get<ShiftRecord[]>(ENDPOINTS.SHIFTS.MY_SHIFTS);
    return Array.isArray(data) ? data : [];
  },

  async checkIn(payload: ShiftCheckInPayload): Promise<boolean> {
    await apiClient.post(ENDPOINTS.SHIFTS.CHECK_IN, payload);
    return true;
  },
};
