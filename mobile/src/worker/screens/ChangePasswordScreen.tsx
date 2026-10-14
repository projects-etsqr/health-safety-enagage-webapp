import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, KeyboardAvoidingView,
  ScrollView, Alert,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { Colors } from '../theme/colors';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

export default function ChangePasswordScreen({ navigation, route }: any) {
  const forced = route?.params?.forced ?? false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const { changePassword, isLoading, error, clearError } = useAuth();

  useEffect(() => {
    if (error) Alert.alert('Change Password Failed', error, [{ text: 'OK', onPress: clearError }]);
  }, [error]);

  const handleSubmit = async () => {
    if (!current.trim() || !next.trim() || !confirm.trim()) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (next.length < 4) {
      Alert.alert('Weak Password', 'New password must be at least 4 characters.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    try {
      await changePassword({ current_password: current.trim(), new_password: next.trim() });
      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'Continue', onPress: () => navigation.replace('Main') },
      ]);
    } catch {
      // error surfaced via the effect above
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={KEYBOARD_BEHAVIOR}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{forced ? 'Set a New Password' : 'Change Password'}</Text>
          <Text style={styles.subtitle}>
            {forced
              ? 'For security, please replace your temporary password before continuing.'
              : 'Update the password you use to log in.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Input
            label={forced ? 'Temporary Password' : 'Current Password'}
            placeholder="Enter current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry={!show}
            autoCapitalize="none"
          />
          <Input
            label="New Password"
            placeholder="At least 4 characters"
            value={next}
            onChangeText={setNext}
            secureTextEntry={!show}
            autoCapitalize="none"
            rightIcon={show ? '🙈' : '👁️'}
            onRightIconPress={() => setShow((v) => !v)}
          />
          <Input
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            autoCapitalize="none"
          />
          <Button
            title="Update Password"
            onPress={handleSubmit}
            isLoading={isLoading}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
});
