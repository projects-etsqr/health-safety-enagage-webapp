import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '../components/layout/KeyboardAvoider';
import { useAuth } from '../hooks/useAuth';
import { Input, PINInput, LoadingOverlay } from '../components';
import { Colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const LOGO_IMAGE = require('../../assets/icon.png');

export function LoginScreen() {
  const { login, isLoading, error, clearError, selectedRole, setSelectedRole } = useAuth();
  // Defaults match the initial role below (supervisor); see the role tabs for
  // the per-role credentials, which mirror backend/migrations/reset_mobile_passwords.py.
  const [employeeId, setEmployeeId] = useState('supervisor_test');
  const [password, setPassword] = useState('Supervisor@123');

  // Initialize with supervisor if none is selected
  useEffect(() => {
    if (!selectedRole) {
      setSelectedRole('supervisor');
    }
  }, [selectedRole, setSelectedRole]);

  const handleEmployeeId = (text: string) => {
    setEmployeeId(text);
    if (error) clearError();
  };

  const handlePassword = (text: string) => {
    setPassword(text);
    if (error) clearError();
  };

  const handleLogin = () => {
    if (!employeeId.trim() || !password.trim()) return;
    login({
      employee_id: employeeId.trim(),
      password: password,
      pin: password, // Send both pin and password for simplicity
    });
  };

  const currentRole = selectedRole || 'supervisor';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={KEYBOARD_BEHAVIOR}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <LoadingOverlay visible={isLoading} message="Signing in..." />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>Ehsera</Text>
          <Text style={styles.tagline}>Unified Enterprise Safety Portal</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In to Portal</Text>

          {/* Role Selection Tabs */}
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Choose Login Access</Text>
            <View style={styles.roleTabRow}>
              {(['manager', 'supervisor', 'worker', 'auditor'] as const).map((role) => {
                const active = currentRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleTab, active && styles.roleTabActive]}
                    onPress={() => {
                      setSelectedRole(role);
                      clearError();
                      // Pre-fill credentials based on selection for fast testing
                      if (role === 'manager') {
                        setEmployeeId('manager_test');
                        setPassword('Manager@123');
                      } else if (role === 'supervisor') {
                        setEmployeeId('supervisor_test');
                        setPassword('Supervisor@123');
                      } else if (role === 'auditor') {
                        setEmployeeId('auditor_test');
                        setPassword('Auditor@123');
                      } else {
                        setEmployeeId('worker_test');
                        setPassword('Worker@123');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Backend usernames are lowercase (worker_test, supervisor_test, …), so
              the field must not auto-capitalize what the user types. */}
          <Input
            label="Employee ID"
            placeholder="e.g. worker_test"
            value={employeeId}
            onChangeText={handleEmployeeId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Every role authenticates with an alphanumeric password, so the
              field keeps the default keyboard rather than PINInput's number-pad. */}
          <PINInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={handlePassword}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            style={[
              styles.loginBtn,
              (!employeeId || !password || isLoading) && styles.loginBtnDisabled,
            ]}
            disabled={!employeeId || !password || isLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed" size={16} color={Colors.white} />
            <Text style={styles.loginBtnText}>Log In as {currentRole.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Ionicons name="lock-closed-outline" size={11} color={Colors.textMuted} style={{ marginRight: 5 }} />
            <Text style={styles.footerTop}>SECURE ACCESS SECURITY PROTOCOL</Text>
          </View>
          <Text style={styles.footerBottom}>Site: Houston Refinery · Terminal 4</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  roleTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.criticalBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    color: Colors.critical,
    flex: 1,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  loginBtnDisabled: {
    opacity: 0.55,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerTop: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  footerBottom: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
});
