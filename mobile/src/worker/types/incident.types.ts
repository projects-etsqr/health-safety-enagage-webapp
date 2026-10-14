/**
 * Values here are the literal strings the KPI engine matches on
 * (backend/app/controllers/dashboard.py) — do not "tidy" them into slugs.
 * `Injury` gates the recordable count; `Lost Time` gates LTIFR/LTISR/DART.
 */
export type IncidentType =
  | 'Injury'
  | 'Dangerous Occurrence'
  | 'Property Damage'
  | 'Environmental';

export type SeverityLevel = 'Minor' | 'Moderate' | 'Severe' | 'Lost Time' | 'Fatal';

export type IncidentStatus = 'submitted' | 'under_review' | 'investigating' | 'closed';

export type YesNo = 'Yes' | 'No';

export type PotentialConsequence = 'minor_injury' | 'lost_time_injury' | 'property_damage' | 'environmental_impact';
export type NearMissCause = 'slippery_floor' | 'missing_guard' | 'distraction' | 'poor_lighting' | 'other';

export interface PhotoAttachment {
  uri: string;
  name: string;
  type: string;
}

/**
 * One piece of evidence attached to a report, as the capture UI holds it.
 *
 * A superset of PhotoAttachment — `uri`/`name`/`type` are what the upload puts
 * on the wire, and the rest is for drawing the tile before submit. `kind` is
 * derived once at capture rather than re-sniffed from the mime type at every
 * render, because the picker does not always return one.
 */
export interface MediaAttachment extends PhotoAttachment {
  kind: 'photo' | 'video';
  /** Seconds, videos only, when the picker reports it. */
  durationSec?: number;
  sizeBytes?: number;
}

export interface ReportIncidentRequest {
  incident_date_time: string;
  location_station_id: number;
  incident_type: IncidentType;
  severity: SeverityLevel;
  description: string;
  immediate_cause?: string;
  number_persons_involved?: number;
  anyone_injured: YesNo;
  injured_person_name?: string;
  injured_body_part?: string;
  hazard_id: number;
  permit_active?: YesNo;
  control_failure?: YesNo;
  hazard_still_present?: YesNo;
  immediate_actions_taken?: string;
  /** A picked employee carries their id; a typed name is a bare string. Both
   *  shapes are stored as sent, so the link survives where one exists. */
  witnesses?: Array<string | { name: string; employee_id?: number }>;
  gps_latitude?: number;
  gps_longitude?: number;
  photos?: PhotoAttachment[];
}

export interface ReportNearMissRequest {
  description: string;
  potential_consequence: PotentialConsequence;
  causes: NearMissCause[];
  location: string;
  preventative_suggestion?: string;
  photos?: PhotoAttachment[];
}

export interface ReportUnsafeActRequest {
  category: string;
  observation_details: string;
  intervention_performed: boolean;
  location: string;
  department: string;
  photos?: PhotoAttachment[];
}

export interface Incident {
  id: string;
  incident_ref: string;
  incident_type: IncidentType;
  date: string;
  location: string;
  description: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  reported_by: string;
  created_at: string;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
}
