import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ArrowLeft, Sparkles, CheckCircle, CheckSquare } from "lucide-react-native";
import { incidentWorkflowService } from "../../services/incidentWorkflowService";
import type { ScreenProps } from "./types";
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';

export function InvestigationScreenView({
  setCurrentScreen,
  selectedIncident,
  showToast,
}: any) {
  const isRealDbIncident = !isNaN(Number(selectedIncident.id));
  const rawIncident = selectedIncident.raw || {};

  const [why1, setWhy1] = useState("Containment drum seal failed during transport.");
  const [why2, setWhy2] = useState("Drum was subjected to excessive mechanical vibration.");
  const [why3, setWhy3] = useState("Tie-down straps on the transport pallet were loose.");
  const [why4, setWhy4] = useState("Pre-transport checklist was skipped by the loading crew.");
  const [why5, setWhy5] = useState("Lack of supervisor validation on high-risk transport departures.");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRealDbIncident && rawIncident.five_why_analysis) {
      try {
        const parsed = typeof rawIncident.five_why_analysis === 'string'
          ? JSON.parse(rawIncident.five_why_analysis)
          : rawIncident.five_why_analysis;
        if (Array.isArray(parsed)) {
          if (parsed[0]) setWhy1(parsed[0].answer || parsed[0]);
          if (parsed[1]) setWhy2(parsed[1].answer || parsed[1]);
          if (parsed[2]) setWhy3(parsed[2].answer || parsed[2]);
          if (parsed[3]) setWhy4(parsed[3].answer || parsed[3]);
          if (parsed[4]) setWhy5(parsed[4].answer || parsed[4]);
        }
      } catch (e) {
        console.log("Error parsing 5-whys:", e);
      }
    }
  }, [selectedIncident]);

  const handleApproveRca = async () => {
    setLoading(true);
    try {
      await incidentWorkflowService.approveInvestigation(selectedIncident.id, {
        decision: "approved",
        notes: "Approved via Manager Mobile App."
      });
      showToast("RCA Plan Approved");
      setCurrentScreen("app");
    } catch (e) {
      Alert.alert("Error", "RCA Approval failed on backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseIncident = async () => {
    setLoading(true);
    try {
      await incidentWorkflowService.close(selectedIncident.id, {
        closure_notes: "Formally closed via Manager Mobile App.",
        regulatory_notified: "No",
        lessons_learned: "Regular maintenance inspection assigned.",
        communicated_to_teams: "Yes"
      });
      showToast("Incident Closed & Signed off");
      setCurrentScreen("app");
    } catch (e) {
      Alert.alert("Error", "Incident closure failed on backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={KEYBOARD_BEHAVIOR}
      style={styles.container}
    >
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen("app")}>
          <ArrowLeft size={22} color="#0B3D91" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RCA Investigation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Incident Summary Card */}
        <View style={styles.incidentCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.incidentId}>INC-{selectedIncident.id}</Text>
            <View style={[styles.severityBadge, selectedIncident.severity === "Critical" ? styles.criticalBg : styles.highBg]}>
              <Text style={styles.severityText}>{selectedIncident.severity}</Text>
            </View>
          </View>
          <Text style={styles.incidentTitle}>{selectedIncident.title}</Text>
          <Text style={styles.incidentDesc}>{selectedIncident.desc}</Text>
        </View>

        {/* 5 Whys Box */}
        <View style={styles.rcaBox}>
          <Text style={styles.rcaTitle}>5 Whys Methodology</Text>
          <Text style={styles.rcaSubtitle}>Root cause identified sequentially by supervisor:</Text>

          {/* Whys Display/Fields */}
          {[why1, why2, why3, why4, why5].map((whyVal, idx) => {
            const whyNum = idx + 1;
            return (
              <View key={idx} style={styles.whyItem}>
                <View style={styles.whyNumberCircle}>
                  <Text style={styles.whyNumberText}>{whyNum}</Text>
                </View>
                <View style={styles.whyInputWrapper}>
                  <Text style={styles.whyLabel}>Why {whyNum}?</Text>
                  <TextInput
                    style={styles.whyInput}
                    value={whyVal}
                    editable={false}
                    multiline
                  />
                </View>
              </View>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0B3D91" style={{ marginVertical: 20 }} />
        ) : isRealDbIncident ? (
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.submitButton, styles.approveBtn]} onPress={handleApproveRca}>
              <CheckSquare size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Approve RCA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitButton, styles.closeBtn]} onPress={handleCloseIncident}>
              <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Sign-off & Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={() => setCurrentScreen("app")}>
            <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FC",
  },
  headerBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3D91",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  incidentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  incidentId: {
    fontSize: 12,
    fontWeight: "800",
    color: "#63739B",
    letterSpacing: 0.5,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  criticalBg: {
    backgroundColor: "#FEE2E2",
  },
  highBg: {
    backgroundColor: "#FEF3C7",
  },
  severityText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#DC2626",
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 8,
  },
  incidentDesc: {
    fontSize: 14,
    color: "#4A5568",
    lineHeight: 20,
  },
  rcaBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 24,
  },
  rcaTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 4,
  },
  rcaSubtitle: {
    fontSize: 11,
    color: "#718096",
    marginBottom: 16,
  },
  whyItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  whyNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EBF8FF",
    borderWidth: 1.5,
    borderColor: "#3182CE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 20,
  },
  whyNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3182CE",
  },
  whyInputWrapper: {
    flex: 1,
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  whyInput: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#2D3748",
    minHeight: 48,
    textAlignVertical: "top",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#718096",
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  approveBtn: {
    backgroundColor: "#3182CE",
  },
  closeBtn: {
    backgroundColor: "#10B981",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
