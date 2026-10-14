import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export interface WorkingStation {
  id: number;
  station_name: string;
}

export interface HazardOption {
  id: number;
  hazard_name: string;
}

export interface EmployeeOption {
  id: number;
  full_name: string;
}

/**
 * Reference data for the FK pickers on the report forms. Report screens used to
 * post station *names* as free text, which meant location_station_id was always
 * resolved by string match (and silently fell back to station 1 on a miss).
 */
export const lookupService = {
  async workingStations(): Promise<WorkingStation[]> {
    const { data } = await apiClient.get<WorkingStation[]>(ENDPOINTS.LOOKUPS.WORKING_STATIONS);
    return Array.isArray(data) ? data : [];
  },

  async hazards(): Promise<HazardOption[]> {
    const { data } = await apiClient.get<HazardOption[]>(ENDPOINTS.HAZARDS.LIST);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Everyone in the signed-in user's organisation.
   *
   * Scoped by the server, not here: /employees/ filters on the org from the
   * caller's token, so a worker in one organisation cannot be shown another's
   * staff whatever this asks for.
   *
   * The explicit limit matters though. The endpoint defaults to 100 and this
   * organisation has 157 people, so the witness picker was silently missing 57
   * of them — and a picker that cannot find the person you are looking for is
   * worse than no picker, because the reporter assumes they are not on the
   * system. 1000 covers any single site comfortably; past that the picker
   * should ask the server to search rather than paging through everybody.
   */
  async employees(): Promise<EmployeeOption[]> {
    const { data } = await apiClient.get<EmployeeOption[]>(ENDPOINTS.LOOKUPS.EMPLOYEES, {
      params: { limit: 1000 },
    });
    return Array.isArray(data) ? data : [];
  },
};
