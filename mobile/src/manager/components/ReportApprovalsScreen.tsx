import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { TabB_ReportApprovals } from "./tabs/TabB_ReportApprovals";

/**
 * The manager's steps on near misses, unsafe acts and risk reports.
 *
 * `TabB_ReportApprovals` was written as a tab body and then never mounted —
 * nothing in this shell imported it, so the manager had no screen at all for
 * these three families and a near miss that reached them simply stopped. This
 * is the shell it was missing: the same body, reachable from Risk, with a
 * header and a way back.
 *
 * Grouped with the hazard register rather than given a tab of its own because
 * the two answer the same question — what is outstanding on the events my site
 * has recorded — and a sixth bottom tab would not fit a phone.
 */
export function ReportApprovalsScreen(props: ScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => props.setCurrentScreen("app")} style={styles.back}>
          <ArrowLeft size={22} color="#0B1C30" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Near Misses & Observations</Text>
          <Text style={styles.sub}>Your steps across near miss, unsafe act and risk</Text>
        </View>
      </View>
      <TabB_ReportApprovals {...props} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FB" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: "800", color: "#0B1C30" },
  sub: { fontSize: 11.5, color: "#63739B", marginTop: 2 },
});
