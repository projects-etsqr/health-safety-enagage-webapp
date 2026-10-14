import React, { useState, useEffect } from 'react';
import { Icon } from '../components/display/Icon';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, ScrollView, Alert,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';
import { Colors } from '../theme/colors';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen({ navigation }: any) {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const { login, isLoading, error, isAuthenticated, mustChangePassword, clearError } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace(mustChangePassword ? 'ChangePassword' : 'Main', mustChangePassword ? { forced: true } : undefined);
    }
  }, [isAuthenticated, mustChangePassword]);

  useEffect(() => {
    if (error) Alert.alert('Login Failed', error, [{ text: 'OK', onPress: clearError }]);
  }, [error]);

  const handleLogin = async () => {
    if (!employeeId.trim() || !pin.trim()) {
      Alert.alert('Required', 'Please enter both Employee ID and PIN.');
      return;
    }
    await login({ employee_id: employeeId.trim(), pin: pin.trim() });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={KEYBOARD_BEHAVIOR}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Icon emoji="🛡️" style={styles.logoIcon} />
          </View>
          <Text style={styles.appName}>Ehsera</Text>
          <Text style={styles.tagline}>Enterprise Site Management</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Site Access Login</Text>

          <Input
            label="Employee ID"
            placeholder="e.g. 8842-TX"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Input
            label="PIN or Password"
            placeholder="Enter your PIN or password"
            value={pin}
            onChangeText={setPin}
            secureTextEntry={!showPin}
            rightIcon={showPin ? '🙈' : '👁️'}
            onRightIconPress={() => setShowPin(v => !v)}
          />

          <Button
            title="Log In to Site"
            onPress={handleLogin}
            isLoading={isLoading}
            style={{ marginTop: 8 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR QUICK ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity>
            <Text style={styles.forgotLink}>Forgot access credentials?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock" size={12} color="rgba(255,255,255,0.55)" style={{ marginRight: 6 }} />
            <Text style={styles.footerTop}>SECURE GROUND ACCESS PROTOCOL</Text>
          </View>
          <Text style={styles.footerBottom}>Site: Houston Refinery • Terminal 4</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoIcon: { fontSize: 36 },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textDark, marginBottom: 20 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.textMuted, marginHorizontal: 10, fontWeight: '600' },
  forgotLink: { textAlign: 'center', color: Colors.blue, fontWeight: '600', fontSize: 14 },

  footer: { alignItems: 'center', marginTop: 32 },
  footerTop: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1 },
  footerBottom: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
});
