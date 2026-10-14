import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { NeedsYourAction } from "./NeedsYourAction";
import type { NextActionItem } from "../../services/incidentWorkflowService";

/**
 * The incidents behind the Tasks tab's Incidents card.
 *
 * The card used to jump to the Monitoring tab, where the manager's incident
 * queue happens to live. That worked, but it is not what the other four cards
 * do — they open their family's own list — and landing on a different tab
 * carrying a heatmap and severity tiles is a strange answer to tapping
 * "Incidents". This is the list, reached the same way as the rest.
 *
 * The rows are `NeedsYourAction`, the same component the dashboard renders,
 * rather than a second card layout that would drift from it. It only needed to
 * stop capping at three and to be able to show every open incident rather than
 * only this manager's own steps.
 *
 * Tapping a row goes to the investigation screen, which is where the manager's
 * actual work on an incident happens — approve, verify, sign off, close.
 */
export function MgrIncidentQueue({ setCurrentScreen, setSelectedIncident }: ScreenProps) {
  const [tab, setTab] = useState<"mine" | "all">("mine");

  const open = (item: NextActionItem) => {
    // The investigation screen reads the shell's `selectedIncident`, so the
    // queue row is mapped onto that shape here — the same mapping Monitoring
    // does, because it is routing to the same screen.
    setSelectedIncident?.({
      id: item.id,
      title: item.description,
      severity: item.priority === "P1" || item.priority === "P2" ? "Critical" : "High",
      time: "",
      desc: item.description,
      status: item.stage_label ?? item.workflow_status,
      zone: "",
    } as any);
    setCurrentScreen("investigation");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen("app")} style={styles.back}>
          <ArrowLeft size={22} color="#0B1C30" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Incidents</Text>
          <Text style={styles.sub}>What your sites reported, and the step each is on</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {([["mine", "Waiting on you"], ["all", "All open"]] as Array<["mine" | "all", string]>)
          .map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <NeedsYourAction
          onOpen={open}
          mineOnly={tab === "mine"}
          preview={false}
          heading={null}
        />
      </ScrollView>
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

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF",
  },
  tabActive: { backgroundColor: "#0B3D91", borderColor: "#0B3D91" },
  tabText: { fontSize: 12.5, fontWeight: "700", color: "#63739B" },
  tabTextActive: { color: "#FFFFFF" },

  scroll: { padding: 16, paddingBottom: 40 },
});
