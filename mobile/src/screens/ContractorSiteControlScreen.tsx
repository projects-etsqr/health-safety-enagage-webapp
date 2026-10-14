/**
 * Supervisor · Contractor Site Control (WF-08).
 *
 * "Verify induction & certs, site-access status, contractor toolbox completion."
 *
 * Access is granted per person, not per company: the backend refuses to grant
 * access when an induction has expired, so this screen surfaces the expiry
 * before the supervisor taps rather than letting them find out by rejection.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Card, EmptyState, Loading, HSE_COLORS } from '../components/hseiq';
import { contractorService, ContractorCompany } from '../services/hseiqService';
import { KeyboardAvoider } from '../components/layout/KeyboardAvoider';

const ACCESS_COLOR: Record<string, string> = {
  granted: HSE_COLORS.pass,
  revoked: HSE_COLORS.block,
  pending: HSE_COLORS.amber,
};

const isExpired = (d?: string | null) => !!d && new Date(d) < new Date();

export default function ContractorSiteControlScreen({ navigation }: any) {
  const [companies, setCompanies] = useState<ContractorCompany[]>([]);
  const [selected, setSelected] = useState<ContractorCompany | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [badge, setBadge] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    contractorService
      .list()
      .then(setCompanies)
      .catch(() => setCompanies([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(load, [load]);

  const openCompany = useCallback((c: ContractorCompany) => {
    setSelected(c);
    contractorService.workers(c.id).then(setWorkers).catch(() => setWorkers([]));
  }, []);

  const lookupBadge = useCallback(() => {
    if (!badge.trim()) return;
    contractorService
      .workerByBadge(badge.trim())
      .then(w => {
        Alert.alert(
          w.full_name,
          `${w.trade ?? 'Contractor worker'}\nAccess: ${w.site_access_status}\n` +
            `Induction valid until: ${w.induction_valid_until ?? 'not recorded'}`,
        );
        setWorkers([w]);
      })
      .catch(() => Alert.alert('Not found', 'No contractor worker matches that badge.'));
  }, [badge]);

  const setAccess = useCallback(
    (w: any, status: 'granted' | 'revoked') => {
      contractorService
        .setSiteAccess(w.id, status, status === 'granted')
        .then(() => {
          Alert.alert('Updated', `${w.full_name} — site access ${status}.`);
          if (selected) openCompany(selected);
        })
        .catch(err =>
          Alert.alert('Refused', err?.response?.data?.detail ?? 'Could not change site access.'),
        );
    },
    [selected, openCompany],
  );

  return (
    <KeyboardAvoider style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Contractor Site Control</Text>
        <Text style={styles.subtitle}>Induction, certificates and site-access roll-call.</Text>

        <Card title="Badge lookup">
          <View style={styles.badgeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={badge}
              onChangeText={setBadge}
              placeholder="Scan or type a badge number"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.lookupBtn} onPress={lookupBadge}>
              <Text style={styles.lookupText}>Find</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {loading ? (
          <Loading />
        ) : (
          <Card title={`Contractors on site (${companies.length})`}>
            {companies.length === 0 ? (
              <EmptyState text="No contractors in the registry." />
            ) : (
              companies.map(c => (
                <TouchableOpacity key={c.id} style={styles.row} onPress={() => openCompany(c)}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowTitle}>{c.company_name}</Text>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor:
                            c.suspended || c.prequalification_status === 'barred'
                              ? HSE_COLORS.block
                              : c.prequalification_status === 'approved'
                              ? HSE_COLORS.pass
                              : HSE_COLORS.amber,
                        },
                      ]}
                    >
                      <Text style={styles.pillText}>
                        {c.suspended ? 'SUSPENDED' : c.prequalification_status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {isExpired(c.insurance_expiry) ? (
                    <Text style={styles.warn}>Insurance expired {c.insurance_expiry}</Text>
                  ) : null}
                  {c.suspended && c.suspended_reason ? (
                    <Text style={styles.warn}>{c.suspended_reason}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}

        {selected ? (
          <Card title={`${selected.company_name} — workers (${workers.length})`}>
            {workers.length === 0 ? (
              <EmptyState text="No workers registered for this contractor." />
            ) : (
              workers.map(w => {
                const expired = isExpired(w.induction_valid_until);
                return (
                  <View key={w.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowTitle}>{w.full_name}</Text>
                      <Text style={[styles.access, { color: ACCESS_COLOR[w.site_access_status] }]}>
                        {w.site_access_status}
                      </Text>
                    </View>
                    <Text style={styles.rowMeta}>
                      {w.trade ?? 'Contractor'} · badge {w.badge_no ?? '—'}
                      {w.induction_valid_until ? ` · induction to ${w.induction_valid_until}` : ''}
                    </Text>
                    {expired ? (
                      <Text style={styles.warn}>
                        Induction expired — site access cannot be granted until it is renewed.
                      </Text>
                    ) : null}
                    <View style={styles.actions}>
                      {w.site_access_status !== 'granted' && !expired ? (
                        <TouchableOpacity onPress={() => setAccess(w, 'granted')}>
                          <Text style={[styles.action, { color: HSE_COLORS.pass }]}>
                            Grant access + toolbox
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {w.site_access_status === 'granted' ? (
                        <TouchableOpacity onPress={() => setAccess(w, 'revoked')}>
                          <Text style={[styles.action, { color: HSE_COLORS.block }]}>Revoke</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: HSE_COLORS.bg },
  title: { fontSize: 20, fontWeight: '800', color: HSE_COLORS.textDark, marginTop: 16, marginHorizontal: 16 },
  subtitle: { fontSize: 12, color: HSE_COLORS.textMuted, marginHorizontal: 16, marginTop: 4 },

  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    borderWidth: 1, borderColor: HSE_COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: HSE_COLORS.textDark,
  },
  lookupBtn: { backgroundColor: '#2563EB', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8 },
  lookupText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: HSE_COLORS.textDark, flex: 1 },
  rowMeta: { fontSize: 11, color: HSE_COLORS.textMuted, marginTop: 4 },
  warn: { fontSize: 11, color: HSE_COLORS.block, marginTop: 6, fontWeight: '600' },
  access: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  actions: { flexDirection: 'row', gap: 20, marginTop: 10 },
  action: { fontSize: 13, fontWeight: '700' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
