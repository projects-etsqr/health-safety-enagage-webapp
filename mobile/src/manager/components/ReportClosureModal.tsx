import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';

/**
 * The manager's sign-off before a report is closed for good.
 *
 * Closure notes are required — "closed" with no reason is the one thing an auditor
 * will always ask about. Lessons learned is optional but surfaced, since it is what
 * makes the report useful to the next crew.
 */

export interface ClosureFormValues {
  closure_notes: string;
  lessons_learned?: string;
}

interface Props {
  visible: boolean;
  reportLabel: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: ClosureFormValues) => void;
}

export function ReportClosureModal({
  visible,
  reportLabel,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: Props) {
  const [notes, setNotes] = useState("");
  const [lessons, setLessons] = useState("");
  const [touched, setTouched] = useState(false);

  const notesError = touched && !notes.trim();

  const reset = () => {
    setNotes("");
    setLessons("");
    setTouched(false);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!notes.trim()) return;
    onSubmit({
      closure_notes: notes.trim(),
      lessons_learned: lessons.trim() || undefined,
    });
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={KEYBOARD_BEHAVIOR}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Close report</Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={8}>
              <X size={20} color="#63739B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {reportLabel}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            <Text style={styles.label}>Closure notes *</Text>
            <TextInput
              style={[styles.input, notesError && styles.inputError]}
              placeholder="What was resolved, and how?"
              placeholderTextColor="#A0AEC0"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
            {notesError && <Text style={styles.errorText}>Closure notes are required</Text>}

            <Text style={styles.label}>Lessons learned</Text>
            <TextInput
              style={styles.input}
              placeholder="What should the team do differently?"
              placeholderTextColor="#A0AEC0"
              value={lessons}
              onChangeText={setLessons}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.warning}>This completes the workflow and cannot be undone.</Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={handleCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Approve & close</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,61,145,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#F4F7FC",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: "88%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "800", color: "#2D3748" },
  subtitle: { fontSize: 12, color: "#718096", marginTop: 2, marginBottom: 14 },
  body: { flexGrow: 0 },
  label: { fontSize: 13, fontWeight: "700", color: "#4A5568", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 12,
    fontSize: 14,
    color: "#2D3748",
    minHeight: 80,
    marginBottom: 12,
  },
  inputError: { borderColor: "#DC2626" },
  errorText: { fontSize: 12, color: "#DC2626", marginTop: -8, marginBottom: 10 },
  warning: { fontSize: 12, color: "#718096", marginBottom: 4 },
  footer: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  btnGhostText: { color: "#4A5568", fontWeight: "700", fontSize: 14 },
  btnPrimary: { backgroundColor: "#059669" },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
