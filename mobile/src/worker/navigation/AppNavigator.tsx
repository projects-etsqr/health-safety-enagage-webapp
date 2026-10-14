import React, { useEffect } from 'react';
import { Icon } from '../components/display/Icon';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TasksScreen from '../screens/TasksScreen';
import MyActionsScreen from '../screens/MyActionsScreen';
import ActionDetailScreen from '../screens/ActionDetailScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PerformTaskScreen from '../screens/PerformTaskScreen';
import RaisePermitScreen from '../screens/RaisePermitScreen';
import ReportNearMissScreen from '../screens/ReportNearMissScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import ReportRiskScreen from '../screens/ReportRiskScreen';
import LogHazardScreen from '../screens/LogHazardScreen';
import MyHazardsScreen from '../screens/MyHazardsScreen';
import MyNearMissesScreen from '../screens/MyNearMissesScreen';
import MyRiskReportsScreen from '../screens/MyRiskReportsScreen';
import MyIncidentsScreen from '../screens/MyIncidentsScreen';
import SafetyChecklistScreen from '../screens/SafetyChecklistScreen';
import SafetyTrainingScreen from '../screens/SafetyTrainingScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import PermitsScreen from '../screens/PermitsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SafetyTrainingDetailScreen from '../screens/SafetyTrainingDetailScreen';
import AISafetyAssistantScreen from '../screens/AISafetyAssistantScreen';
import ShiftCheckInScreen from '../screens/ShiftCheckInScreen';
// ── WF-06 / WF-07 / WF-09 (HSE_Mobile_Architecture_v4) ──────────────────────
import CompetenceCardScreen from '../screens/CompetenceCardScreen';
import FatigueDeclarationScreen from '../screens/FatigueDeclarationScreen';
import JourneyPlanScreen from '../screens/JourneyPlanScreen';
import MySafetyScoreScreen from '../screens/MySafetyScoreScreen';
import TrainingAssessmentScreen from '../screens/TrainingAssessmentScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Tasks: 'clipboard',
  Alerts: 'alert-triangle',
  Profile: 'user',
};

function MyTabBar({ state, descriptors, navigation }: any) {
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

        const icon = TAB_ICONS[route.name] ?? 'circle';

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

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <MyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Alerts" component={PermitsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Icon emoji="🛡️" style={styles.splashIcon} />
      <ActivityIndicator color={Colors.blue} size="large" style={{ marginTop: 20 }} />
    </View>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={isAuthenticated ? 'Main' : 'Login'}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="PerformTask" component={PerformTaskScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="RaisePermit" component={RaisePermitScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ReportNearMiss" component={ReportNearMissScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ReportRisk" component={ReportRiskScreen} options={{ presentation: 'modal' }} />
        {/* Flow 5 · the standing hazard register. Separate from ReportRisk
            above, which writes a one-off observation to risk_reports. */}
        <Stack.Screen name="LogHazard" component={LogHazardScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MyHazards" component={MyHazardsScreen} options={{ presentation: 'card' }} />
        {/* The other half of ReportNearMiss above: reporting is stage 01, this
            is stages 02-08 as the reporter sees them. */}
        <Stack.Screen name="MyNearMisses" component={MyNearMissesScreen} options={{ presentation: 'card' }} />
        {/* The other half of ReportRisk above, and distinct from MyHazards:
            that is the standing register, this is the worker's own sightings. */}
        <Stack.Screen name="MyRiskReports" component={MyRiskReportsScreen} options={{ presentation: 'card' }} />
        {/* The last family to get a follow-it screen. Recent Submissions used
            to be the incident list, which made it look covered. */}
        <Stack.Screen name="MyIncidents" component={MyIncidentsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SafetyChecklist" component={SafetyChecklistScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SafetyTraining" component={SafetyTrainingScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Permits" component={PermitsScreen} options={{ presentation: 'card' }} />
        {/* WF-04. The dashboard's "Open CAPAs" tile had no destination before
            this, so an action assigned to a worker was unreachable here. */}
        <Stack.Screen name="MyActions" component={MyActionsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ActionDetail" component={ActionDetailScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SafetyTrainingDetail" component={SafetyTrainingDetailScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="AISafetyAssistant" component={AISafetyAssistantScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShiftCheckIn" component={ShiftCheckInScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CompetenceCard" component={CompetenceCardScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="FatigueDeclaration" component={FatigueDeclarationScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="JourneyPlan" component={JourneyPlanScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MySafetyScore" component={MySafetyScoreScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="TrainingAssessment" component={TrainingAssessmentScreen} options={{ presentation: 'card' }} />
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
  splash: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  splashIcon: { fontSize: 64 },
});
