import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function AppSettingsScreen({ navigation }: any) {
  const [notify, setNotify] = useState(true);
  const [sync, setSync] = useState(true);
  const [dark, setDark] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0B1C30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.lbl}>Push Notifications</Text>
            <Switch value={notify} onValueChange={setNotify} />
          </View>
          <View style={styles.row}>
            <Text style={styles.lbl}>Background Data Sync</Text>
            <Switch value={sync} onValueChange={setSync} />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.lbl}>Enable Dark Mode</Text>
            <Switch value={dark} onValueChange={setDark} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0B1C30', marginLeft: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  lbl: { fontSize: 13, fontWeight: '700', color: '#0B1C30' }
});
