/**
 * WF-09 · Journey Risk & JMP.
 *
 * "Route × Mode × Cargo. Weather go/no-go ack. Pre-trip gate. Vehicle QR."
 *
 * JRS >= 13 is high risk and cannot depart without Transport Authorisation —
 * the screen makes that visible while the driver is still planning, not at the
 * gate when the truck is loaded.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenLayout } from '../components/layout/ScreenLayout';
import {
  Card, PrimaryButton, ScoreTile, Segmented, GateRow, GateBanner,
  bandColor, HSE_COLORS, EmptyState,
} from '../../components/hseiq';
import { transportService, JourneyPlan, Vehicle, GateEvaluation } from '../../services/hseiqService';
import { useGeoTag } from '../hooks/useGeoTag';

const MODES = ['road', 'rail', 'marine', 'air'] as const;

const ROUTE_LABELS = ['Familiar', 'Mixed', 'Remote'];
const CARGO_LABELS = ['General', 'Heavy', 'Hazardous'];

export default function JourneyPlanScreen({ navigation }: any) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<typeof MODES[number]>('road');
  const [route, setRoute] = useState(1);
  const [modeScore, setModeScore] = useState(1);
  const [cargo, setCargo] = useState(1);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);

  const [journeys, setJourneys] = useState<JourneyPlan[]>([]);
  const [gates, setGates] = useState<GateEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const { geo } = useGeoTag();

  const jrs = route * modeScore * cargo;
  const band = jrs >= 13 ? 'high' : jrs >= 5 ? 'medium' : 'low';

  const load = useCallback(() => {
    transportService.myJourneys().then(setJourneys).catch(() => setJourneys([]));
    transportService.vehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(load, [load]);

  const create = useCallback(() => {
    setBusy(true);
    transportService
      .createJourney({
        origin, destination, transport_mode: mode,
        route_score: route, mode_score: modeScore, cargo_score: cargo,
        vehicle_id: vehicleId,
      })
      .then(j => {
        Alert.alert(
          `Journey risk ${j.journey_risk_score} — ${j.risk_band}`,
          j.requires_authorisation
            ? 'This is a high-risk journey. It has gone to your supervisor for Transport Authorisation and cannot depart until that is granted.'
            : 'Journey plan created. Complete the pre-trip check before you depart.',
        );
        load();
      })
      .catch(err =>
        Alert.alert('Could not create journey', err?.response?.data?.detail ?? 'Please try again.'),
      )
      .finally(() => setBusy(false));
  }, [origin, destination, mode, route, modeScore, cargo, vehicleId, load]);

  const preTrip = useCallback(
    (j: JourneyPlan, defectStatus: string) => {
      transportService
        .preTrip(j.id, { vehicle_id: j.vehicle_id, defect_status: defectStatus })
        .then(() => {
          Alert.alert('Pre-trip recorded', `Vehicle condition logged as "${defectStatus}".`);
          load();
        })
        .catch(() => Alert.alert('Could not record pre-trip check'));
    },
    [load],
  );

  const depart = useCallback(
    (j: JourneyPlan) => {
      setBusy(true);
      transportService
        .depart(j.id)
        .then(ev => {
          setGates(ev);
          if (ev.overall === 'block') {
            Alert.alert('Departure blocked', ev.blocked_reasons.join('\n\n'));
          } else {
            Alert.alert('Departed', 'Timed check-ins are now scheduled for this journey.');
          }
          load();
        })
        .catch(err =>
          Alert.alert('Cannot depart', err?.response?.data?.detail ?? 'Please try again.'),
        )
        .finally(() => setBusy(false));
    },
    [load],
  );

  const checkIn = useCallback(
    (j: JourneyPlan) => {
      transportService
        .checkIn(j.id, {
          gps_latitude: geo.gps_latitude,
          gps_longitude: geo.gps_longitude,
        })
        .then(() => Alert.alert('Checked in', 'Your position and time have been recorded.'))
        .catch(() => Alert.alert('Could not check in'));
    },
    [geo],
  );

  return (
    <ScreenLayout>
      <AppHeader title="Journey Management" onBack={() => navigation.goBack()} light />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card title="Plan a journey">
          <Text style={styles.label}>From</Text>
          <TextInput style={styles.input} value={origin} onChangeText={setOrigin} placeholder="Origin" placeholderTextColor="#94A3B8" />
          <Text style={styles.label}>To</Text>
          <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destination" placeholderTextColor="#94A3B8" />

          <Text style={styles.label}>Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => (
              <Text
                key={m}
                onPress={() => setMode(m)}
                style={[styles.mode, mode === m && styles.modeActive]}
              >
                {m}
              </Text>
            ))}
          </View>

          <Text style={styles.label}>Route (1–3)</Text>
          <Segmented value={route} max={3} onChange={setRoute} labels={ROUTE_LABELS} />

          <Text style={styles.label}>Mode risk (1–4)</Text>
          <Segmented value={modeScore} max={4} onChange={setModeScore} />

          <Text style={styles.label}>Cargo (1–3)</Text>
          <Segmented value={cargo} max={3} onChange={setCargo} labels={CARGO_LABELS} />

          {vehicles.length > 0 ? (
            <>
              <Text style={styles.label}>Vehicle</Text>
              <View style={styles.vehicleWrap}>
                {vehicles.slice(0, 6).map(v => (
                  <Text
                    key={v.id}
                    onPress={() => setVehicleId(v.id)}
                    style={[styles.vehicle, vehicleId === v.id && styles.vehicleActive]}
                  >
                    {v.registration}
                    {v.defect_status !== 'none' ? ` (${v.defect_status})` : ''}
                  </Text>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.jrsBox}>
            <ScoreTile value={jrs} band={band} label="Journey Risk Score" sub={`${route} × ${modeScore} × ${cargo}`} />
            {jrs >= 13 ? (
              <Text style={styles.authWarn}>
                High risk — Transport Authorisation is required before departure.
              </Text>
            ) : null}
          </View>

          <PrimaryButton label="Create journey plan" onPress={create} busy={busy} />
        </Card>

        {gates ? (
          <>
            <GateBanner overall={gates.overall} reasons={gates.blocked_reasons} />
            <Card title="Departure gates">
              {gates.gates.map(g => <GateRow key={g.gate_key} gate={g} />)}
            </Card>
          </>
        ) : null}

        <Card title="My journeys">
          {journeys.length === 0 ? (
            <EmptyState text="No journey plans yet." />
          ) : (
            journeys.slice(0, 10).map(j => (
              <View key={j.id} style={styles.jRow}>
                <View style={styles.jHead}>
                  <Text style={styles.jDest}>{j.destination || 'Journey'} </Text>
                  <View style={[styles.badge, { backgroundColor: bandColor(j.risk_band) }]}>
                    <Text style={styles.badgeText}>JRS {j.journey_risk_score}</Text>
                  </View>
                </View>
                <Text style={styles.jMeta}>
                  {j.transport_mode} · {j.status.replace(/_/g, ' ')}
                  {j.checkin_interval_minutes ? ` · check in every ${j.checkin_interval_minutes} min` : ''}
                </Text>
                <View style={styles.jActions}>
                  {!j.pretrip_completed_at ? (
                    <Text style={styles.action} onPress={() => preTrip(j, 'none')}>Pre-trip OK</Text>
                  ) : null}
                  {j.status === 'authorised' || j.status === 'draft' ? (
                    <Text style={styles.action} onPress={() => depart(j)}>Depart</Text>
                  ) : null}
                  {j.status === 'in_progress' ? (
                    <>
                      <Text style={styles.action} onPress={() => checkIn(j)}>Check in</Text>
                      <Text
                        style={styles.action}
                        onPress={() =>
                          transportService.arrive(j.id).then(() => { Alert.alert('Arrival recorded'); load(); })
                        }
                      >
                        Arrived
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: HSE_COLORS.textMid, marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: HSE_COLORS.textDark,
  },
  modeRow: { flexDirection: 'row', gap: 6 },
  mode: {
    flex: 1, textAlign: 'center', paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#F1F5F9', color: HSE_COLORS.textMid, fontSize: 12,
    textTransform: 'capitalize', overflow: 'hidden',
  },
  modeActive: { backgroundColor: '#2563EB', color: '#fff', fontWeight: '700' },

  vehicleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vehicle: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F1F5F9', color: HSE_COLORS.textMid, fontSize: 12, overflow: 'hidden',
  },
  vehicleActive: { backgroundColor: '#2563EB', color: '#fff', fontWeight: '700' },

  jrsBox: { marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 4 },
  authWarn: {
    fontSize: 12, color: HSE_COLORS.block, fontWeight: '700',
    textAlign: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },

  jRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  jHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jDest: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  jMeta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  jActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  action: { fontSize: 13, color: '#2563EB', fontWeight: '700' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
