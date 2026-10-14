import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Avatar } from '../display/Avatar';
import type { TeamMember } from '../../types/team.types';

const STATUS_DOT: Record<string, string> = {
  logged_in: Colors.success,
  active: Colors.success,
  pending: Colors.warning,
  off_site: Colors.textMuted,
  leave: Colors.textLight,
};

interface Props {
  member: TeamMember;
  onMenu?: () => void;
  onForceIn?: () => void;
  onContact?: () => void;
}

export function TeamMemberCard({ member, onMenu, onForceIn, onContact }: Props) {
  const isPending = member.status === 'pending';

  return (
    <View style={[styles.card, isPending && styles.pendingCard]}>
      <View style={styles.left}>
        <View style={styles.avatarWrap}>
          <Avatar name={member.name} size={44} />
          <View style={[styles.dot, { backgroundColor: STATUS_DOT[member.status] ?? Colors.textLight }]} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, isPending && styles.pendingName]}>{member.name}</Text>
          <Text style={styles.sub}>{member.zone}</Text>
          {isPending && member.scheduled_time && (
            <Text style={styles.scheduled}>Pending Login (Scheduled: {member.scheduled_time})</Text>
          )}
        </View>
      </View>
      {isPending && onForceIn ? (
        <TouchableOpacity onPress={onForceIn} style={styles.forceBtn}>
          <Text style={styles.forceBtnText}>Force In</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onMenu} style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  pendingCard: { opacity: 0.75 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textDark },
  pendingName: { color: Colors.textMuted },
  sub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  scheduled: { fontSize: 11, color: Colors.warning, marginTop: 2 },
  menuBtn: { padding: 6 },
  forceBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  forceBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
});
