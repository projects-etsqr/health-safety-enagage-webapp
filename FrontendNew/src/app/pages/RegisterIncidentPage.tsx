/**
 * Web "Register Incident" — the client's ask from the platform review: an
 * Admin/HSE Manager should be able to log an incident from the web, through
 * the same underlying workflow the mobile app uses, rather than a separate
 * form that could drift from it or produce a differently-shaped record.
 *
 * Posts to the same endpoint the mobile app's ReportIncidentScreen does
 * (registerIncident -> POST /worker/incidents) with source: "Web App" set
 * explicitly (migration 077) so the Incidents register can tell the two
 * apart without guessing from whether GPS happened to be present.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import {
  getHazardOptions, getWorkingStationOptions, registerIncident,
  type HazardOption, type WorkingStationOption,
} from "../../services/incident-register.service";
import { IncidentsTabBar } from "../components/audits/IncidentsTabBar";
import { EventFamilyTabBar } from "../components/audits/EventFamilyTabBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const INCIDENT_TYPES = ["Injury", "Dangerous Occurrence", "Property Damage", "Environmental"];
const SEVERITIES = ["Minor", "Moderate", "Severe", "Lost Time", "Fatal"];
const TREATMENT_LEVELS = ["first_aid", "medical_treatment", "hospitalisation", "fatality"];
const TREATMENT_LABELS: Record<string, string> = {
  first_aid: "First aid",
  medical_treatment: "Medical treatment",
  hospitalisation: "Hospitalisation",
  fatality: "Fatality",
};

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function RegisterIncidentPage() {
  const navigate = useNavigate();

  const [stations, setStations] = useState<WorkingStationOption[]>([]);
  const [hazards, setHazards] = useState<HazardOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incidentType, setIncidentType] = useState("Injury");
  const [stationId, setStationId] = useState<string>("");
  const [dateTime, setDateTime] = useState(nowLocal());
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("Minor");
  const [immediateCause, setImmediateCause] = useState("");
  const [numberPersons, setNumberPersons] = useState<string>("");
  const [anyoneInjured, setAnyoneInjured] = useState<"Yes" | "No">("No");
  const [injuredName, setInjuredName] = useState("");
  const [injuredBodyPart, setInjuredBodyPart] = useState("");
  const [treatmentLevel, setTreatmentLevel] = useState<string>("");
  const [dangerousOccurrence, setDangerousOccurrence] = useState<"Yes" | "No">("No");
  const [worstCaseFatal, setWorstCaseFatal] = useState<"Yes" | "No">("No");
  const [hazardId, setHazardId] = useState<string>("");
  const [controlFailure, setControlFailure] = useState<"Yes" | "No">("No");
  const [hazardStillPresent, setHazardStillPresent] = useState<"Yes" | "No">("No");
  const [actionsTaken, setActionsTaken] = useState("");
  const [witnesses, setWitnesses] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getWorkingStationOptions(), getHazardOptions()])
      .then(([s, h]) => { setStations(s); setHazards(h); })
      .catch(() => setError("Could not load stations/hazards. You can still submit without them."))
      .finally(() => setLoadingOptions(false));
  }, []);

  const addWitness = () => setWitnesses((w) => [...w, ""]);
  const updateWitness = (i: number, value: string) =>
    setWitnesses((w) => w.map((x, idx) => (idx === i ? value : x)));
  const removeWitness = (i: number) => setWitnesses((w) => w.filter((_, idx) => idx !== i));

  const canSubmit = description.trim().length > 0 && immediateCause.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await registerIncident({
        incident_type: incidentType,
        location_station_id: stationId ? Number(stationId) : undefined,
        incident_date_time: new Date(dateTime).toISOString(),
        description: description.trim(),
        severity,
        immediate_cause: immediateCause.trim(),
        number_persons_involved: numberPersons ? Number(numberPersons) : undefined,
        anyone_injured: anyoneInjured,
        injured_person_name: anyoneInjured === "Yes" ? injuredName.trim() || undefined : undefined,
        injured_body_part: anyoneInjured === "Yes" ? injuredBodyPart.trim() || undefined : undefined,
        treatment_level: anyoneInjured === "Yes" && treatmentLevel ? treatmentLevel : undefined,
        dangerous_occurrence: dangerousOccurrence,
        worst_case_fatal: worstCaseFatal,
        hazard_id: hazardId ? Number(hazardId) : undefined,
        control_failure: controlFailure,
        hazard_still_present: hazardStillPresent,
        immediate_actions_taken: actionsTaken.trim() || undefined,
        witnesses: witnesses.filter((w) => w.trim()).map((name) => ({ name: name.trim() })),
      });
      navigate(`/violations/INC-${String(result.data.id).padStart(5, "0")}`);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Could not register this incident. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <EventFamilyTabBar />
      <IncidentsTabBar />

      <div>
        <h1 className="text-[19px]" style={{ color: "#0F172A", fontWeight: 700 }}>Register Incident</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "#64748B" }}>
          Goes through the same workflow a mobile submission does — classification, statutory check and
          risk-assessment reopening all run identically. Marked "Web App" so it's clearly not a field report.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px]"
          style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-[15px]">What happened</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Incident Type</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location / Working Station</Label>
              <Select value={stationId} onValueChange={setStationId} disabled={loadingOptions}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder={loadingOptions ? "Loading…" : "Select a station"} /></SelectTrigger>
                <SelectContent>
                  {stations.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.station_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date &amp; Time</Label>
              <Input type="datetime-local" className="mt-1" value={dateTime} onChange={(e) => setDateTime(e.target.value)} max={nowLocal()} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" placeholder="What happened…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Severity (reporter's impression)</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Immediate Cause</Label>
              <Textarea className="mt-1" placeholder="Why did this happen…" value={immediateCause} onChange={(e) => setImmediateCause(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Number of Persons Involved</Label>
              <Input type="number" className="mt-1" min={0} value={numberPersons} onChange={(e) => setNumberPersons(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-[15px]">Injury &amp; classification</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <YesNoField label="Anyone Injured" value={anyoneInjured} onChange={setAnyoneInjured} />
              {anyoneInjured === "Yes" && (
                <>
                  <div>
                    <Label>Injured Person's Name</Label>
                    <Input className="mt-1" value={injuredName} onChange={(e) => setInjuredName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Injured Body Part</Label>
                    <Input className="mt-1" value={injuredBodyPart} onChange={(e) => setInjuredBodyPart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Treatment Level</Label>
                    <Select value={treatmentLevel} onValueChange={setTreatmentLevel}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Not specified" /></SelectTrigger>
                      <SelectContent>
                        {TREATMENT_LEVELS.map((t) => <SelectItem key={t} value={t}>{TREATMENT_LABELS[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <YesNoField label="Dangerous Occurrence" value={dangerousOccurrence} onChange={setDangerousOccurrence} />
              <YesNoField label="Worst Case Could Have Been Fatal" value={worstCaseFatal} onChange={setWorstCaseFatal} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">Hazard &amp; control</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Related Hazard</Label>
                <Select value={hazardId} onValueChange={setHazardId} disabled={loadingOptions}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder={loadingOptions ? "Loading…" : "Select a hazard (optional)"} /></SelectTrigger>
                  <SelectContent>
                    {hazards.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.hazard_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <YesNoField label="Was a Control Measure in Place That Failed" value={controlFailure} onChange={setControlFailure} />
              <YesNoField label="Is the Hazard Still Present" value={hazardStillPresent} onChange={setHazardStillPresent} />
              <div>
                <Label>Immediate Actions Taken</Label>
                <Textarea className="mt-1" value={actionsTaken} onChange={(e) => setActionsTaken(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">Witnesses</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {witnesses.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={w} onChange={(e) => updateWitness(i, e.target.value)} placeholder="Witness name" />
                  <Button variant="ghost" size="sm" onClick={() => removeWitness(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addWitness}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add witness
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-2 pb-4">
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Register Incident
        </Button>
        <Button variant="outline" onClick={() => navigate("/violations")} disabled={submitting}>Cancel</Button>
      </div>
    </div>
  );
}

function YesNoField({ label, value, onChange }: { label: string; value: "Yes" | "No"; onChange: (v: "Yes" | "No") => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as "Yes" | "No")}>
        <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="No">No</SelectItem>
          <SelectItem value="Yes">Yes</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
