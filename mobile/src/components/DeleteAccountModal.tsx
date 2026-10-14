import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';

interface DeleteAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  /** Throw to keep the modal open with an error (e.g. wrong password). */
  onConfirm: (password: string) => Promise<void>;
}

/**
 * Password re-entry gate before a destructive self-delete. Shared across all
 * four role profile screens so the confirmation flow and copy stay identical.
 */
export function DeleteAccountModal({ visible, onCancel, onConfirm }: DeleteAccountModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setPassword(''); setError(null); setLoading(false); };

  const handleCancel = () => { reset(); onCancel(); };

  const handleConfirm = async () => {
    if (!password) { setError('Enter your password to confirm.'); return; }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(password);
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not delete account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.body}>
            This permanently deletes your account and cannot be undone. Enter your
            password to confirm.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={t => { setPassword(t); if (error) setError(null); }}
            editable={!loading}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleConfirm} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.deleteBtnText}>Delete Account</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#475569',
    marginBottom: 16,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
  },
  error: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
