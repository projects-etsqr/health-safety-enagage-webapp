import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { teamService } from '../services/teamService';
import type { ShiftStatus } from '../types/team.types';

interface Props {
  navigation: any;
}

export function OperationsScreen({ navigation }: Props) {
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const sh = await teamService.getShiftStatus();
        setShiftStatus(sh);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shift Operations</Text>
        <Text style={styles.headerSubtitle}>Houston Refinery · Terminal 4</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Current Shift Status Card */}
        <TouchableOpacity
          style={styles.shiftCard}
          onPress={() => navigation.navigate('SessionManagement')}
          activeOpacity={0.9}
        >
          <View style={styles.shiftHeader}>
            <View style={styles.shiftBadge}>
              <Text style={styles.shiftBadgeText}>● ACTIVE SHIFT</Text>
            </View>
            <Text style={styles.shiftTime}>Started: 07:00 AM</Text>
          </View>

          <Text style={styles.shiftTitle}>Day Operations Shift A</Text>

          <View style={styles.shiftMetaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaVal}>{shiftStatus?.logged_in ?? 14}</Text>
              <Text style={styles.metaLbl}>Active Workers</Text>
            </View>
            <View style={styles.dividerLine} />
            <View style={styles.metaCol}>
              <Text style={styles.metaVal}>05h 32m</Text>
              <Text style={styles.metaLbl}>Elapsed Time</Text>
            </View>
          </View>

          <View style={styles.shiftFooter}>
            <Text style={styles.shiftBtnText}>Manage Session Settings</Text>
            <Ionicons name="arrow-forward" size={16} color="#004AC6" />
          </View>
        </TouchableOpacity>

        {/* WF-06 … WF-09 · competence and fatigue gate the permit, so they lead */}
        <Text style={styles.sectionTitle}>Gates, Competence & High-Risk Work</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('GateOverrideConsole')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="shield-checkmark-outline" size={26} color="#EF4444" />
            </View>
            <Text style={styles.gridLabel}>Gate Console</Text>
            <Text style={styles.gridDesc}>Overrides</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('TeamCompetenceMatrix')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="school-outline" size={26} color="#004AC6" />
            </View>
            <Text style={styles.gridLabel}>Competence</Text>
            <Text style={styles.gridDesc}>Team matrix</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('RamsScoring')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="document-text-outline" size={26} color="#F97316" />
            </View>
            <Text style={styles.gridLabel}>RAMS Scoring</Text>
            <Text style={styles.gridDesc}>6 criteria</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('ContractorSiteControl')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FAF5FF' }]}>
              <Ionicons name="business-outline" size={26} color="#8B5CF6" />
            </View>
            <Text style={styles.gridLabel}>Contractors</Text>
            <Text style={styles.gridDesc}>Site access</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('CheckInMonitor')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#E0F2F1' }]}>
              <Ionicons name="car-outline" size={26} color="#12B8A6" />
            </View>
            <Text style={styles.gridLabel}>Journeys</Text>
            <Text style={styles.gridDesc}>Check-in monitor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('TeamSps')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="stats-chart-outline" size={26} color="#10B981" />
            </View>
            <Text style={styles.gridLabel}>Team SPS</Text>
            <Text style={styles.gridDesc}>Five domains</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Access Tiles Title */}
        <Text style={styles.sectionTitle}>Shift Management Modules</Text>

        {/* Quick Access Grid */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('AssignTask')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#E0F2F1' }]}>
              <Ionicons name="clipboard-outline" size={26} color="#12B8A6" />
            </View>
            <Text style={styles.gridLabel}>Assign Task</Text>
            <Text style={styles.gridDesc}>To worker(s)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('TeamManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="people-outline" size={26} color="#004AC6" />
            </View>
            <Text style={styles.gridLabel}>Team Roster</Text>
            <Text style={styles.gridDesc}>14 Present</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('SessionManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FAF5FF' }]}>
              <Ionicons name="stopwatch-outline" size={26} color="#8B5CF6" />
            </View>
            <Text style={styles.gridLabel}>Session Logs</Text>
            <Text style={styles.gridDesc}>Shift A</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('SafetyObservationManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="eye-outline" size={26} color="#EF4444" />
            </View>
            <Text style={styles.gridLabel}>Observations</Text>
            <Text style={styles.gridDesc}>2 Unresolved</Text>
          </TouchableOpacity>

          {/* Flow 5 · the standing register. The supervisor owns stages 02-05,
              so this is where a hazard gets assessed, contained and controlled. */}
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('HazardRegisterManagement')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="warning-outline" size={26} color="#B45309" />
            </View>
            <Text style={styles.gridLabel}>Unsafe Act Register</Text>
            <Text style={styles.gridDesc}>Assess &amp; control</Text>
          </TouchableOpacity>
        </View>

        {/* Shift Focus Areas */}
        <Text style={styles.sectionTitle}>Shift Focus & Workflows</Text>

        <View style={styles.focusList}>
          {/* Item 2 */}
          <TouchableOpacity
            style={styles.focusItem}
            onPress={() => navigation.navigate('Permits')}
            activeOpacity={0.8}
          >
            <View style={styles.focusLeft}>
              <View style={[styles.focusIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="document-text-outline" size={20} color="#004AC6" />
              </View>
              <View>
                <Text style={styles.focusName}>Permits Auditing & Sign-off</Text>
                <Text style={styles.focusSub}>3 active permits require validation</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Item 3 */}
          <TouchableOpacity
            style={styles.focusItem}
            onPress={() => navigation.navigate('TeamManagement')}
            activeOpacity={0.8}
          >
            <View style={styles.focusLeft}>
              <View style={[styles.focusIconWrap, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="shield-outline" size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.focusName}>Verify PPE compliance</Text>
                <Text style={styles.focusSub}>Automatic AI camera check results</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>

          {/* Item 4 */}
          <TouchableOpacity
            style={styles.focusItem}
            onPress={() => navigation.navigate('InspectionManagement')}
            activeOpacity={0.8}
          >
            <View style={styles.focusLeft}>
              <View style={[styles.focusIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="search-outline" size={20} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.focusName}>Machinery Inspection</Text>
                <Text style={styles.focusSub}>Safety inspections for Sector 4 cranes</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1C30',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#737686',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  shiftTime: {
    fontSize: 11,
    color: '#737686',
  },
  shiftTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1C30',
    marginBottom: 16,
  },
  shiftMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEF2FF',
    paddingVertical: 14,
    marginBottom: 12,
  },
  metaCol: {
    alignItems: 'center',
  },
  metaVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0B1C30',
  },
  metaLbl: {
    fontSize: 11,
    color: '#737686',
    marginTop: 2,
  },
  dividerLine: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  shiftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingTop: 4,
  },
  shiftBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#004AC6',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1C30',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  gridIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1C30',
  },
  gridDesc: {
    fontSize: 10,
    color: '#737686',
    marginTop: 2,
  },
  focusList: {
    gap: 12,
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  focusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  focusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1C30',
  },
  focusSub: {
    fontSize: 11,
    color: '#737686',
    marginTop: 2,
  },
});
