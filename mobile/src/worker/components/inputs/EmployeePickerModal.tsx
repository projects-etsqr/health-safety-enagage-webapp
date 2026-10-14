import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { Icon } from '../display/Icon';
import { Colors } from '../../theme/colors';
import type { EmployeeOption } from '../../services/lookupService';

/**
 * Pick a person from the employee register.
 *
 * A search box rather than a dropdown because the register is not a short list
 * — this organisation has a hundred people and a scrolling wheel of a hundred
 * names is not a picker, it is a haystack.
 *
 * Each row shows the staff code alongside the name. `EMP-<id>` is the display
 * convention the rest of the platform uses (see report_trail_factory), and it
 * is what settles the two Dave Smiths on a shift.
 *
 * Somebody not on the register — a contractor, a visitor, a delivery driver —
 * is still a valid witness, so what was typed into the search can be added as a
 * plain name instead. Forcing every witness to be an employee would push the
 * reporter into naming the wrong person or naming nobody.
 */

interface Props {
  visible: boolean;
  employees: EmployeeOption[];
  /** Already-added ids, so somebody cannot be named twice. */
  chosenIds: number[];
  onPick: (employee: EmployeeOption) => void;
  /** Add whatever was typed, for a witness who is not an employee. */
  onAddFreeText: (name: string) => void;
  onClose: () => void;
}

export function EmployeePickerModal({
  visible, employees, chosenIds, onPick, onAddFreeText, onClose,
}: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = employees.filter(e => !chosenIds.includes(e.id));
    if (!q) return available;
    // Matches the code as well as the name, so "21" or "EMP-21" finds them.
    return available.filter(
      e =>
        e.full_name?.toLowerCase().includes(q) ||
        String(e.id).includes(q.replace(/^emp-?/i, '')),
    );
  }, [employees, chosenIds, query]);

  const typed = query.trim();
  const close = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add a witness</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="x" style={styles.closeIcon} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Icon name="search" style={styles.searchIcon} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or staff number..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={e => String(e.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {employees.length === 0
                  ? 'The employee list could not be loaded. You can still add a name below.'
                  : 'Nobody matches that.'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => { onPick(item); setQuery(''); }}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.full_name}</Text>
                  <Text style={styles.rowCode}>EMP-{item.id}</Text>
                </View>
                <Icon name="plus" style={styles.rowAdd} color={Colors.blue} />
              </TouchableOpacity>
            )}
          />

          {/* The way out for anybody not on the payroll. */}
          {typed.length > 0 && (
            <TouchableOpacity
              style={styles.freeTextBtn}
              onPress={() => { onAddFreeText(typed); setQuery(''); }}
              activeOpacity={0.8}
            >
              <Icon name="user-plus" style={styles.freeTextIcon} color={Colors.blue} />
              <Text style={styles.freeTextLabel} numberOfLines={1}>
                Add “{typed}” — not an employee
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, maxHeight: '82%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  closeIcon: { fontSize: 20 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textDark, padding: 0 },
  list: { marginTop: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FB',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  rowCode: { fontSize: 11.5, color: Colors.textMuted, marginTop: 1, fontVariant: ['tabular-nums'] },
  rowAdd: { fontSize: 18 },
  empty: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24, lineHeight: 19 },
  freeTextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, height: 48, backgroundColor: Colors.background,
  },
  freeTextIcon: { fontSize: 17 },
  freeTextLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: Colors.textDark },
});
