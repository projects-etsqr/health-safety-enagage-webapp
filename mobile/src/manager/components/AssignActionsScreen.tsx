import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { ArrowLeft, Plus, CheckSquare, Trash2, Calendar, User } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';

export function AssignActionsScreenView({
  setCurrentScreen,
  selectedIncident,
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
  handleQueueAction,
  queuedActions,
  setQueuedActions,
  handleFinalizeActions,
}: ScreenProps) {
  const priorities: Array<"Critical" | "High" | "Medium" | "Low"> = ["Critical", "High", "Medium", "Low"];

  const removeQueuedItem = (index: number) => {
    setQueuedActions((prev) => prev.filter((_, idx) => idx !== index));
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
        <Text style={styles.headerTitle}>Assign CAPA Actions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Banner Info */}
        <View style={styles.incidentBanner}>
          <Text style={styles.bannerLabel}>Incident Reference:</Text>
          <Text style={styles.bannerTitle}>
            {selectedIncident.id} - {selectedIncident.title}
          </Text>
        </View>

        {/* Form Box */}
        <View style={styles.formBox}>
          <Text style={styles.boxTitle}>New Action Details</Text>

          {/* Action Description */}
          <Text style={styles.fieldLabel}>Action Description</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What needs to be done? (e.g. Repair guardrails)"
            placeholderTextColor="#A0AEC0"
            value={actionDesc}
            onChangeText={setActionDesc}
            multiline
          />

          {/* Priority Toggles */}
          <Text style={styles.fieldLabel}>Priority Level</Text>
          <View style={styles.priorityRow}>
            {priorities.map((p) => {
              const active = actionPriority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBadge,
                    active && styles.activePriorityBadge,
                    active && p === "Critical" && styles.critBg,
                    active && p === "High" && styles.hiBg,
                    active && p === "Medium" && styles.medBg,
                    active && p === "Low" && styles.loBg,
                  ]}
                  onPress={() => setActionPriority(p)}
                >
                  <Text style={[styles.priorityText, active && styles.activePriorityText]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Assignee Input */}
          <Text style={styles.fieldLabel}>Assignee Name</Text>
          <View style={styles.inputWithIcon}>
            <User size={18} color="#718096" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.innerInput}
              placeholder="Full name of person responsible"
              placeholderTextColor="#A0AEC0"
              value={actionAssignee}
              onChangeText={setActionAssignee}
            />
          </View>

          {/* Due Date Input */}
          <Text style={styles.fieldLabel}>Due Date</Text>
          <View style={styles.inputWithIcon}>
            <Calendar size={18} color="#718096" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.innerInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0AEC0"
              value={actionDueDate}
              onChangeText={setActionDueDate}
            />
          </View>

          {/* Compliance Toggle */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Compliance Sign-off Required</Text>
              <Text style={styles.toggleDesc}>Requires audit validation before closing</Text>
            </View>
            <Switch
              value={actionCompliance}
              onValueChange={setActionCompliance}
              trackColor={{ false: "#CBD5E0", true: "#93C5FD" }}
              thumbColor={actionCompliance ? "#3B82F6" : "#F7FAFC"}
            />
          </View>

          {/* Queue Button */}
          <TouchableOpacity style={styles.queueButton} onPress={handleQueueAction}>
            <Plus size={18} color="#0B3D91" style={{ marginRight: 6 }} />
            <Text style={styles.queueButtonText}>Queue Corrective Action</Text>
          </TouchableOpacity>
        </View>

        {/* Queued Actions List */}
        {queuedActions.length > 0 && (
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Queued Actions ({queuedActions.length})</Text>
            {queuedActions.map((action, index) => (
              <View key={index} style={styles.queuedCard}>
                <View style={styles.queuedHeader}>
                  <View style={styles.queuedBadge}>
                    <Text style={styles.queuedBadgeText}>{action.priority}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeQueuedItem(index)}>
                    <Trash2 size={16} color="#E53E3E" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.queuedDesc}>{action.desc}</Text>
                <View style={styles.queuedFooter}>
                  <Text style={styles.queuedFooterText}>👤 {action.assignee}</Text>
                  <Text style={styles.queuedFooterText}>📅 {action.dueDate}</Text>
                </View>
              </View>
            ))}

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleFinalizeActions}>
              <CheckSquare size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Finalize & Submit Actions</Text>
            </TouchableOpacity>
          </View>
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
  incidentBanner: {
    backgroundColor: "#EBF8FF",
    borderWidth: 1,
    borderColor: "#BEE3F8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2B6CB0",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2D3748",
  },
  formBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  boxTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#2D3748",
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  priorityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  priorityBadge: {
    flex: 1,
    marginHorizontal: 4,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  activePriorityBadge: {
    borderWidth: 1.5,
  },
  critBg: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  hiBg: {
    borderColor: "#EA580C",
    backgroundColor: "#FFF7ED",
  },
  medBg: {
    borderColor: "#D97706",
    backgroundColor: "#FEF3C7",
  },
  loBg: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A5568",
  },
  activePriorityText: {
    fontWeight: "700",
    color: "#1A202C",
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  innerInput: {
    flex: 1,
    fontSize: 14,
    color: "#2D3748",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2D3748",
  },
  toggleDesc: {
    fontSize: 11,
    color: "#718096",
  },
  queueButton: {
    backgroundColor: "#E2E8F0",
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  queueButtonText: {
    color: "#0B3D91",
    fontSize: 14,
    fontWeight: "700",
  },
  listContainer: {
    marginTop: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4A5568",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  queuedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
  },
  queuedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  queuedBadge: {
    backgroundColor: "#EDF2F7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  queuedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4A5568",
  },
  queuedDesc: {
    fontSize: 13,
    color: "#2D3748",
    marginBottom: 8,
  },
  queuedFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  queuedFooterText: {
    fontSize: 11,
    color: "#718096",
  },
  submitButton: {
    backgroundColor: "#3182CE",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#3182CE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
