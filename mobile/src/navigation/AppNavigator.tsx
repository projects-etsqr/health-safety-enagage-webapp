import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../theme/colors';
import { Colors as WorkerColors } from '../worker/theme/colors';
import { LoadingScreen } from '../components';

// ==========================================
// 1. MANAGER SCREEN
// ==========================================
import { ManagerAppRoot } from '../manager/ManagerAppRoot';
import { AuditorAppRoot } from '../auditor/AuditorAppRoot';
import { AiChatScreen } from '../components/AiAssistant';

// ==========================================
// 2. SUPERVISOR SCREENS
// ==========================================
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { OperationsScreen } from '../screens/OperationsScreen';
import { TeamAttendanceScreen } from '../screens/TeamAttendanceScreen';
import { ShiftMonitoringScreen } from '../screens/ShiftMonitoringScreen';
import { ShiftConfirmationScreen } from '../screens/ShiftConfirmationScreen';
import { SafetyComplianceScreen } from '../screens/SafetyComplianceScreen';
import { PermitsScreen } from '../screens/PermitsScreen';
import { AcknowledgePermitScreen } from '../screens/AcknowledgePermitScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { IncidentQueueScreen } from '../screens/IncidentQueueScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

// Figma detail screens (Supervisor)
import { NotificationCenterScreen } from '../screens/NotificationCenterScreen';
import { TeamManagementScreen } from '../screens/TeamManagementScreen';
import { TeamPerformanceMetricsScreen } from '../screens/TeamPerformanceMetricsScreen';
import { SessionManagementScreen } from '../screens/SessionManagementScreen';
import { SafetyObservationManagementScreen } from '../screens/SafetyObservationManagementScreen';
import { InspectionManagementScreen } from '../screens/InspectionManagementScreen';
import { AuditPreparationScreen } from '../screens/AuditPreparationScreen';
import { CAPAManagementScreen } from '../screens/CAPAManagementScreen';
import { CapaReviewQueueScreen } from '../screens/CapaReviewQueueScreen';
import AssignTaskScreen from '../screens/AssignTaskScreen';
import { NearMissManagementScreen } from '../screens/NearMissManagementScreen';
import { PermitRequestManagementScreen } from '../screens/PermitRequestManagementScreen';
import { RiskManagementScreen } from '../screens/RiskManagementScreen';
import { HazardRegisterManagementScreen } from '../screens/HazardRegisterManagementScreen';
import { DocumentManagementScreen } from '../screens/DocumentManagementScreen';
import { AISafetyInsightsScreen } from '../screens/AISafetyInsightsScreen';
// ── WF-06 … WF-09 (HSE_Mobile_Architecture_v4) ─────────────────────────────
import GateOverrideConsoleScreen from '../screens/GateOverrideConsoleScreen';
import TeamCompetenceMatrixScreen from '../screens/TeamCompetenceMatrixScreen';
import RamsScoringScreen from '../screens/RamsScoringScreen';
import ContractorSiteControlScreen from '../screens/ContractorSiteControlScreen';
import CheckInMonitorScreen from '../screens/CheckInMonitorScreen';
import TeamSpsScreen from '../screens/TeamSpsScreen';
import { AppSettingsScreen } from '../screens/AppSettingsScreen';
import { ReportsAnalyticsScreen } from '../screens/ReportsAnalyticsScreen';
import { SiteMonitoringOverviewScreen } from '../screens/SiteMonitoringOverviewScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { TrainingDetailScreen } from '../screens/TrainingDetailScreen';

// ==========================================
// 3. WORKER SCREENS
// ==========================================
import WorkerDashboardScreen from '../worker/screens/DashboardScreen';
import WorkerTasksScreen from '../worker/screens/TasksScreen';
import AssignedTaskFillScreen from '../worker/screens/AssignedTaskFillScreen';
import WorkerPermitsScreen from '../worker/screens/PermitsScreen';
import WorkerProfileScreen from '../worker/screens/ProfileScreen';
import PerformTaskScreen from '../worker/screens/PerformTaskScreen';
import RaisePermitScreen from '../worker/screens/RaisePermitScreen';
import ReportNearMissScreen from '../worker/screens/ReportNearMissScreen';
import ReportIncidentScreen from '../worker/screens/ReportIncidentScreen';
import ReportRiskScreen from '../worker/screens/ReportRiskScreen';
import LogHazardScreen from '../worker/screens/LogHazardScreen';
import MyHazardsScreen from '../worker/screens/MyHazardsScreen';
import MyNearMissesScreen from '../worker/screens/MyNearMissesScreen';
import MyRiskReportsScreen from '../worker/screens/MyRiskReportsScreen';
import MyIncidentsScreen from '../worker/screens/MyIncidentsScreen';
import SafetyChecklistScreen from '../worker/screens/SafetyChecklistScreen';
import SafetyTrainingScreen from '../worker/screens/SafetyTrainingScreen';
import ChangePasswordScreen from '../worker/screens/ChangePasswordScreen';
import WorkerNotificationsScreen from '../worker/screens/NotificationsScreen';
import SafetyTrainingDetailScreen from '../worker/screens/SafetyTrainingDetailScreen';
import AISafetyAssistantScreen from '../worker/screens/AISafetyAssistantScreen';
import FullBioScreen from '../worker/screens/FullBioScreen';
import WorkerReportsScreen from '../worker/screens/ReportsScreen';
import { Icon } from '../worker/components/display/Icon';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ==========================================
// SUPERVISOR NAVIGATORS
// ==========================================
function SupervisorHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="AiAssistant" component={AiChatScreen} />
    </Stack.Navigator>
  );
}

function SupervisorOperationsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OperationsHome" component={OperationsScreen} />
      <Stack.Screen name="AssignTask" component={AssignTaskScreen} />
      <Stack.Screen name="TeamAttendance" component={TeamAttendanceScreen} />
      <Stack.Screen name="ShiftMonitoring" component={ShiftMonitoringScreen} />
      <Stack.Screen name="ShiftConfirmation" component={ShiftConfirmationScreen} />
      <Stack.Screen name="SafetyCompliance" component={SafetyComplianceScreen} />
    </Stack.Navigator>
  );
}

function SupervisorPermitsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PermitsList" component={PermitsScreen} />
      <Stack.Screen name="AcknowledgePermit" component={AcknowledgePermitScreen} />
    </Stack.Navigator>
  );
}

function SupervisorTasksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksHome" component={TasksScreen} />
    </Stack.Navigator>
  );
}

function SupervisorProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

const SUPERVISOR_TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Operations: 'activity',
  Permits: 'file-text',
  Tasks: 'check-square',
  Profile: 'user',
};

function SupervisorMainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.navActive,
        tabBarInactiveTintColor: Colors.navInactive,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Icon name={SUPERVISOR_TAB_ICONS[route.name] ?? 'circle'} size={size ?? 22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={SupervisorHomeStack} />
      <Tab.Screen name="Operations" component={SupervisorOperationsStack} />
      <Tab.Screen name="Permits" component={SupervisorPermitsStack} />
      <Tab.Screen name="Tasks" component={SupervisorTasksStack} />
      <Tab.Screen name="Profile" component={SupervisorProfileStack} />
    </Tab.Navigator>
  );
}

// ==========================================
// WORKER NAVIGATORS
// ==========================================
const WORKER_TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Tasks: 'clipboard',
  Report: 'alert-octagon',
  Checklist: 'check-circle',
  Profile: 'user',
};

function WorkerTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const icon = WORKER_TAB_ICONS[route.name] ?? 'circle';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.8}
          >
            <View style={[styles.tabContent, isFocused && styles.activePill]}>
              <Icon name={icon} style={[styles.tabIcon, isFocused && styles.activeText]} />
              <Text style={[styles.tabLabelText, isFocused && styles.activeText]}>{label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function WorkerTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <WorkerTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={WorkerDashboardScreen} />
      <Tab.Screen name="Tasks" component={WorkerTasksScreen} />
      <Tab.Screen name="Report" component={WorkerReportsScreen} />
      <Tab.Screen name="Checklist" component={SafetyChecklistScreen} />
      <Tab.Screen name="Profile" component={WorkerProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashIcon}>🛡️</Text>
      <ActivityIndicator color={WorkerColors.blue || Colors.primary} size="large" style={{ marginTop: 20 }} />
    </View>
  );
}

// ==========================================
// MAIN APP NAVIGATOR
// ==========================================
export function AppNavigator() {
  const { isAuthenticated, isLoading, selectedRole, restoreSession } = useAuth();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) return <SplashScreen />;

  const currentRole = selectedRole || 'supervisor';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          currentRole === 'manager' ? (
            // ==========================================
            // MANAGER NAVIGATION STACK
            // ==========================================
            <Stack.Screen name="ManagerRoot" component={ManagerAppRoot} />
          ) : currentRole === 'auditor' ? (
            // ==========================================
            // AUDITOR NAVIGATION STACK
            // ==========================================
            <Stack.Screen name="AuditorRoot" component={AuditorAppRoot} />
          ) : currentRole === 'supervisor' ? (
            // ==========================================
            // SUPERVISOR NAVIGATION STACK
            // ==========================================
            <>
              <Stack.Screen name="Main" component={SupervisorMainTabs} />
              <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
              <Stack.Screen name="TeamManagement" component={TeamManagementScreen} />
              <Stack.Screen name="TeamPerformanceMetrics" component={TeamPerformanceMetricsScreen} />
              <Stack.Screen name="SessionManagement" component={SessionManagementScreen} />
              <Stack.Screen name="SafetyObservationManagement" component={SafetyObservationManagementScreen} />
              <Stack.Screen name="InspectionManagement" component={InspectionManagementScreen} />
              <Stack.Screen name="AuditPreparation" component={AuditPreparationScreen} />
              <Stack.Screen name="CAPAManagement" component={CAPAManagementScreen} />
              <Stack.Screen name="CapaReviewQueue" component={CapaReviewQueueScreen} />
              <Stack.Screen name="IncidentQueue" component={IncidentQueueScreen} />
              <Stack.Screen name="NearMissManagement" component={NearMissManagementScreen} />
              <Stack.Screen name="PermitRequestManagement" component={PermitRequestManagementScreen} />
              <Stack.Screen name="RiskManagement" component={RiskManagementScreen} />
              {/* Flow 5 · stages 02 ASSESS -- 05 IMPROVE are the supervisor's.
                  Separate from RiskManagement above, which is the risk_reports
                  observation queue and carries no register lifecycle. */}
              <Stack.Screen name="HazardRegisterManagement" component={HazardRegisterManagementScreen} />
              <Stack.Screen name="DocumentManagement" component={DocumentManagementScreen} />
              <Stack.Screen name="AISafetyInsights" component={AISafetyInsightsScreen} />
              <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
              <Stack.Screen name="ReportsAnalytics" component={ReportsAnalyticsScreen} />
              <Stack.Screen name="SiteMonitoringOverview" component={SiteMonitoringOverviewScreen} />
              <Stack.Screen name="GateOverrideConsole" component={GateOverrideConsoleScreen} />
              <Stack.Screen name="TeamCompetenceMatrix" component={TeamCompetenceMatrixScreen} />
              <Stack.Screen name="RamsScoring" component={RamsScoringScreen} />
              <Stack.Screen name="ContractorSiteControl" component={ContractorSiteControlScreen} />
              <Stack.Screen name="CheckInMonitor" component={CheckInMonitorScreen} />
              <Stack.Screen name="TeamSps" component={TeamSpsScreen} />
              <Stack.Screen name="Training" component={TrainingScreen} />
              <Stack.Screen name="TrainingDetail" component={TrainingDetailScreen} />
            </>
          ) : (
            // ==========================================
            // WORKER NAVIGATION STACK
            // ==========================================
            <>
              <Stack.Screen name="Main" component={WorkerTabNavigator} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
              <Stack.Screen name="PerformTask" component={PerformTaskScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="AssignedTaskFill" component={AssignedTaskFillScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="RaisePermit" component={RaisePermitScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="ReportNearMiss" component={ReportNearMissScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="ReportRisk" component={ReportRiskScreen} options={{ presentation: 'modal' }} />
              {/* Flow 5 · the standing hazard register. Separate from ReportRisk
                  above, which writes a one-off observation to risk_reports. */}
              <Stack.Screen name="LogHazard" component={LogHazardScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="MyHazards" component={MyHazardsScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="MyNearMisses" component={MyNearMissesScreen} options={{ presentation: 'card' }} />
              {/* The other half of ReportRisk above: reporting is stage 01, this
                  is stages 02-08 as the reporter sees them. Distinct from
                  MyHazards, which is the register. */}
              <Stack.Screen name="MyRiskReports" component={MyRiskReportsScreen} options={{ presentation: 'card' }} />
              {/* The last family to get a follow-it screen. Recent Submissions
                  used to be the incident list, which made it look covered. */}
              <Stack.Screen name="MyIncidents" component={MyIncidentsScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="SafetyChecklist" component={SafetyChecklistScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="SafetyTraining" component={SafetyTrainingScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="Permits" component={WorkerPermitsScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="Notifications" component={WorkerNotificationsScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="SafetyTrainingDetail" component={SafetyTrainingDetailScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="AISafetyAssistant" component={AISafetyAssistantScreen} options={{ presentation: 'card' }} />
              <Stack.Screen name="FullBio" component={FullBioScreen} options={{ presentation: 'card' }} />
            </>
          )
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    height: 84,
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    height: 48,
    borderRadius: 24,
    gap: 1,
  },
  activePill: {
    backgroundColor: '#2563EB',
  },
  tabIcon: {
    fontSize: 20,
    color: '#475569',
  },
  tabLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIcon: {
    fontSize: 64,
  },
});
