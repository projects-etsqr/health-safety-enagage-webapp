import axiosInstance from '../api/axiosInstance';
import type { Site, Zone, Shift } from '../types';

// Backend response shape for sites
interface BackendSite {
  id: number;
  site_name: string;
  address: string;
  postcode: string;
  city: string;
  type: string;
  operational_status: string;
  capacity: number;
  primary_products: string;
  hazard_classification: string;
  created_at: string;
  updated_at: string;
}

interface BackendWorkingStation {
  id: number;
  station_name: string;
  site_id: number;
  zone_classification: string | null;
}

function adaptSite(s: BackendSite): Site {
  return {
    Site_ID: String(s.id),
    Site_Name: s.site_name,
    Location: s.address ?? '',
    Country: '',
    Timezone: 'UTC',
    Status: s.operational_status ?? 'Active',
    Total_Zones: 0,
    Total_Workers: 0,
    Compliance_Rate: 0,
    Manager: '',
    Emergency_Contact: '',
    Established_Date: s.created_at?.split('T')[0] ?? '',
  } as unknown as Site;
}

function adaptZone(ws: BackendWorkingStation): Zone {
  return {
    Zone_ID: String(ws.id),
    Zone_Name: ws.station_name,
    Site_ID: String(ws.site_id),
    Zone_Type: ws.zone_classification ?? 'General',
  } as unknown as Zone;
}

export const getSites = () =>
  axiosInstance.get<BackendSite[]>('/sites/').then((r) => r.data.map(adaptSite));

export const getZones = (_siteId?: string): Promise<Zone[]> =>
  axiosInstance
    .get<BackendWorkingStation[]>('/working-stations/', { params: { limit: 200 } })
    .then((r) => r.data.map(adaptZone));

interface BackendShiftPattern {
  shift_id: string;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  sites: string;
  active_employees: number;
}

function adaptShiftPattern(p: BackendShiftPattern): Shift {
  return {
    Shift_ID: p.shift_id,
    Shift_Name: p.shift_name ?? p.shift_id,
    Start_Time: p.start_time ?? '—',
    End_Time: p.end_time ?? '—',
    Sites: p.sites || '—',
    Active_Rules: p.active_employees,
    Status: 'Active',
  } as unknown as Shift;
}

export const getShifts = (): Promise<Shift[]> =>
  axiosInstance.get<BackendShiftPattern[]>('/shift-schedules/patterns').then((r) => r.data.map(adaptShiftPattern));

export type { Site, Zone, Shift };
