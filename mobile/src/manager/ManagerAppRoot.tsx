import { useState, useEffect } from "react";
import { StyleSheet, View, Text, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "../hooks/useAuth";
import { incidentWorkflowService } from "../services/incidentWorkflowService";
import { permitWorkflowService } from "../services/permitWorkflowService";
import { apiClient } from "../api/client";

// Mock Data
import {
  INITIAL_INCIDENTS,
  INITIAL_PERMITS,
  INITIAL_COMPLAINTS,
  INITIAL_CAPA,
  INITIAL_AUDITS,
  type Incident,
  type Capa,
} from "./data/mockData";

// Types
import type { ScreenProps } from "./components/types";

// Screens
import { LoginScreenView } from "./components/LoginScreen";
import { InvestigationScreenView } from "./components/InvestigationScreen";
import { AssignActionsScreenView } from "./components/AssignActionsScreen";
import { AssignedTasksScreenView } from "./components/AssignedTasksScreen";
import { MgrInvestigation } from "./components/MgrInvestigation";
import { MgrAssignActions } from "./components/MgrAssignActions";
import { UnassignedCapaScreen } from "./components/UnassignedCapaScreen";
import { MgrIncidentQueue } from "./components/MgrIncidentQueue";
import { ComplianceApprovalsView } from "./components/ComplianceApprovals";
import type { ManagerScreen, ReportFamily } from "./components/types";
import { HazardRegisterScreen } from "./components/HazardRegisterScreen";
import { ReportApprovalsScreen } from "./components/ReportApprovalsScreen";
import { PolicyManagementScreen } from "./components/PolicyManagementScreen";
import { PermitApprovalsView } from "./components/PermitApprovals";
import { AppContainerView } from "./components/AppContainer";
import { AiChatScreen, AiFab, AI_PROMPTS } from "../components/AiAssistant";
// ── WF-06 … WF-09 (HSE_Mobile_Architecture_v4) ───────────────────────────
import MgrSpsDashboard from "./components/MgrSpsDashboard";
import MgrHumanReadiness from "./components/MgrHumanReadiness";
import MgrContractorOversight from "./components/MgrContractorOversight";
import MgrTransportOversight from "./components/MgrTransportOversight";
import MgrAiGovernance from "./components/MgrAiGovernance";
import { MgrTraining } from "./components/MgrTraining";

export function ManagerAppRoot() {
  const { logout } = useAuth();

  // Navigation & Layout States - Start with "app" directly instead of "login"
  const [currentScreen, setCurrentScreen] = useState<ManagerScreen>("app");
  const [layoutVersion] = useState<"A" | "B">("B");
  const [activeTab, setActiveTab] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [toastAnim] = useState(new Animated.Value(0));

  // App Functional States
  const [employeeId, setEmployeeId] = useState("8842-TX");
  const [password, setPassword] = useState("password");

  // Data States
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [permits, setPermits] = useState(INITIAL_PERMITS);
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [capaItems, setCapaItems] = useState(INITIAL_CAPA);
  const [audits, setAudits] = useState(INITIAL_AUDITS);

  // Search & Filter
  const [complaintSearch, setComplaintSearch] = useState("");
  const [complaintFilter, setComplaintFilter] = useState("All");

  // Form/Flow States (Investigation & Action Assignment)
  const [selectedIncident, setSelectedIncident] = useState<Incident>(INITIAL_INCIDENTS[0]);
  const [reportFamily, setReportFamily] = useState<ReportFamily | null>(null);
  const [whys, setWhys] = useState({
    why1: "Containment drum seal failed during transport.",
    why2: "Drum was subjected to excessive mechanical vibration.",
    why3: "Tie-down straps on the transport pallet were loose.",
    why4: "Pre-transport checklist was skipped by the loading crew.",
    why5: "Lack of supervisor validation on high-risk transport departures.",
  });
  const [rcaDone, setRcaDone] = useState(false);

  // Corrective Actions Assignment Form
  const [actionDesc, setActionDesc] = useState("");
  const [actionPriority, setActionPriority] = useState<"Critical" | "High" | "Medium" | "Low">("High");
  const [actionDueDate, setActionDueDate] = useState("2026-07-25");
  const [actionAssignee, setActionAssignee] = useState("");
  const [actionCompliance, setActionCompliance] = useState(true);
  const [queuedActions, setQueuedActions] = useState<Omit<Capa, "id" | "status">[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Sign out redirect
  useEffect(() => {
    if (currentScreen === "login") {
      logout();
    }
  }, [currentScreen, logout]);

  // Load real CAPA actions once on mount (poll would clobber locally-queued ones).
  useEffect(() => {
    const fetchRealCapa = async () => {
      try {
        const { data } = await apiClient.get("capa-actions/");
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) return;
        const toStatus = (s: string): "Open" | "In Progress" | "Completed" => {
          const v = (s || "").toLowerCase();
          return ["completed", "closed", "verified", "done"].includes(v) ? "Completed" : v.includes("progress") ? "In Progress" : "Open";
        };
        const mapped = list.map((c: any) => ({
          id: `CAPA-${c.id}`,
          desc: c.description || c.action_type || "Corrective action",
          priority: (String(c.status).toLowerCase() === "overdue" ? "High" : "Medium") as
            "Critical" | "High" | "Medium" | "Low",
          status: toStatus(c.status),
          dueDate: c.due_date ? String(c.due_date).slice(0, 10) : "—",
          assignee: c.responsible_person_id ? `Emp ${c.responsible_person_id}` : "Unassigned",
          complianceChecked: toStatus(c.status) === "Completed",
        }));
        setCapaItems(mapped as any);
      } catch (e) {
        console.log("Failed to load CAPA actions:", e);
      }
    };
    fetchRealCapa();
  }, []);

  // Load real incidents for manager queue
  useEffect(() => {
    const fetchRealIncidents = async () => {
      try {
        const list = await incidentWorkflowService.getManagerQueue();
        if (Array.isArray(list)) {
          const mapped = list.map((item: any) => ({
            id: String(item.id),
            title: `${item.incident_type.toUpperCase()} - ${item.severity.toUpperCase()}`,
            desc: item.description || "No description provided",
            severity: (item.severity === 'critical' ? 'Critical' : item.severity === 'high' ? 'High' : 'Medium') as "Critical" | "High" | "Medium" | "Low",
            status: item.workflow_status.toUpperCase(),
            time: item.reported_at ? new Date(item.reported_at).toLocaleTimeString() : "09:00 AM",
            raw: item
          }));
          setIncidents(mapped);
        }
      } catch (e) {
        console.log("Failed to load manager queue:", e);
      }
    };
    
    // Load real permits (pending manager queue + active) for the manager's Permit views.
    const fetchRealPermits = async () => {
      try {
        const [queue, active] = await Promise.all([
          permitWorkflowService.managerQueue(),
          permitWorkflowService.active(),
        ]);
        const toStatus = (ws: string | null): "APPROVED" | "PENDING" | "REJECTED" =>
          ws === "approved" ? "APPROVED" : ws === "rejected" ? "REJECTED" : "PENDING";
        const mapPermit = (p: any) => ({
          id: p.permit_ref || `#${p.id}`,
          type: p.work_description || "Permit to Work",
          area: p.location_station_id ? `Station ${p.location_station_id}` : "Site",
          applicant: p.requested_by ? `Emp ${p.requested_by}` : "—",
          status: toStatus(p.workflow_status),
          raw: p,
        });
        const merged = [...(queue || []), ...(active || [])].map(mapPermit);
        if (merged.length > 0) setPermits(merged as any);
      } catch (e) {
        console.log("Failed to load permits:", e);
      }
    };

    fetchRealIncidents();
    fetchRealPermits();

    const interval = setInterval(() => {
      fetchRealIncidents();
      fetchRealPermits();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [currentScreen]);

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  };

  const handleAIDraft = () => {
    setIsGeneratingAI(true);
    setTimeout(() => {
      if (selectedIncident.id === "INC-9022") {
        setWhys({
          why1: "Containment drum seal failed during transport.",
          why2: "Drum was subjected to excessive mechanical vibration.",
          why3: "Tie-down straps on the transport pallet were loose.",
          why4: "Pre-transport checklist was skipped by the loading crew.",
          why5: "Lack of supervisor validation on high-risk transport departures.",
        });
      } else if (selectedIncident.id === "INC-9024") {
        setWhys({
          why1: "Exposed wires touched the metal housing of panel Line 3.",
          why2: "Insulating cover degraded over time due to high ambient heat.",
          why3: "Scheduled thermal scan maintenance was deferred last month.",
          why4: "Maintenance scheduler was overloaded and missed the ticket.",
          why5: "Maintenance backlog routing lacks automated high-severity alerts.",
        });
      } else {
        setWhys({
          why1: "Forklift driver swerved abruptly near the walkway.",
          why2: "Pedestrian stepped into the vehicle path unexpectedly.",
          why3: "Pedestrian was distracted by a phone notification.",
          why4: "Walkway has no physical barriers or audio warnings.",
          why5: "Safety layout plan lacks segregation rules for active vehicle lanes.",
        });
      }
      setIsGeneratingAI(false);
      showToast("5 Whys drafted by AI");
    }, 700);
  };

  const handleQueueAction = () => {
    if (!actionDesc.trim()) {
      showToast("Please enter an action description");
      return;
    }
    if (!actionAssignee.trim()) {
      showToast("Please enter an assignee");
      return;
    }

    const newAction: Omit<Capa, "id" | "status"> = {
      desc: actionDesc,
      priority: actionPriority,
      dueDate: actionDueDate,
      assignee: actionAssignee,
      complianceChecked: !actionCompliance, // if sign-off not required, set complianceChecked=true
    };

    setQueuedActions((prev) => [...prev, newAction]);
    showToast("Action added to queue");

    // Reset input fields
    setActionDesc("");
    setActionAssignee("");
  };

  const handleFinalizeActions = () => {
    if (queuedActions.length === 0) return;

    const newCapaItems: Capa[] = queuedActions.map((action) => ({
      id: `CAPA-${Math.floor(1000 + Math.random() * 9000)}`,
      desc: action.desc,
      priority: action.priority,
      status: "Open",
      dueDate: action.dueDate,
      assignee: action.assignee,
      complianceChecked: action.complianceChecked,
    }));

    setCapaItems((prev) => [...newCapaItems, ...prev]);

    // Update incident status to closed
    setIncidents((prev) =>
      prev.map((i) => (i.id === selectedIncident.id ? { ...i, status: "CLOSED" } : i))
    );

    setQueuedActions([]);
    showToast(`${newCapaItems.length} corrective actions assigned & incident closed`);
    setCurrentScreen("app");
  };

  const sharedProps: ScreenProps = {
    currentScreen,
    setCurrentScreen,
    layoutVersion,
    activeTab,
    setActiveTab,
    employeeId,
    setEmployeeId,
    password,
    setPassword,
    incidents,
    setIncidents,
    permits,
    setPermits,
    complaints,
    setComplaints,
    capaItems,
    setCapaItems,
    audits,
    setAudits,
    complaintSearch,
    setComplaintSearch,
    complaintFilter,
    setComplaintFilter,
    selectedIncident,
    setSelectedIncident,
    reportFamily,
    setReportFamily,
    whys,
    setWhys,
    rcaDone,
    setRcaDone,
    actionDesc,
    setActionDesc,
    actionPriority,
    setActionPriority,
    actionDueDate,
    setActionDueDate,
    actionAssignee,
    setActionAssignee,
    actionCompliance,
    setActionCompliance,
    queuedActions,
    setQueuedActions,
    showToast,
    isGeneratingAI,
    handleAIDraft,
    handleQueueAction,
    handleFinalizeActions,
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "login":
        return <LoginScreenView {...sharedProps} />;
      case "investigation":
        return <MgrInvestigation {...sharedProps} />;
      case "assign_actions":
        return <MgrAssignActions {...sharedProps} />;
      case "unassigned_capa":
        return <UnassignedCapaScreen {...sharedProps} />;
      case "incident_queue":
        return <MgrIncidentQueue {...sharedProps} />;
      case "assigned_tasks":
        return <AssignedTasksScreenView {...sharedProps} />;
      case "compliance_approvals":
        return <ComplianceApprovalsView {...sharedProps} />;
      case "hazard_register":
        return <HazardRegisterScreen {...sharedProps} />;
      case "report_approvals":
        return <ReportApprovalsScreen {...sharedProps} />;
      case "policy_management":
        return <PolicyManagementScreen {...sharedProps} />;
      case "sps_dashboard":
        return <MgrSpsDashboard {...sharedProps} />;
      case "human_readiness":
        return <MgrHumanReadiness {...sharedProps} />;
      case "contractor_oversight":
        return <MgrContractorOversight {...sharedProps} />;
      case "transport_oversight":
        return <MgrTransportOversight {...sharedProps} />;
      case "ai_governance":
        return <MgrAiGovernance {...sharedProps} />;
      case "training":
        return <MgrTraining {...sharedProps} />;
      case "permit_approvals":
        return <PermitApprovalsView {...sharedProps} />;
      case "ai_assistant":
        // This shell isn't React Navigation, so hand the shared chat screen the
        // minimal navigation/route shape it reads instead of a real navigator.
        return (
          <AiChatScreen
            navigation={{ goBack: () => setCurrentScreen("app") }}
            route={{ params: AI_PROMPTS.manager }}
          />
        );
      case "app":
      default:
        return <AppContainerView {...sharedProps} />;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.appContainer}>
        {renderScreen()}

        {/* Assistant entry point — dashboard only, so it never covers a form
            or sit on top of the chat screen it opens. */}
        {currentScreen === "app" && (
          <AiFab style={styles.aiFab} onPress={() => setCurrentScreen("ai_assistant")} />
        )}

        {/* Toast Alert Banner */}
        {toast && (
          <Animated.View
            style={[
              styles.toastBanner,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.toastDot} />
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#F4F7FC",
  },
  // Clear of the manager shell's bottom tab bar.
  aiFab: {
    bottom: 92,
  },
  toastBanner: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#0B3D91",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
