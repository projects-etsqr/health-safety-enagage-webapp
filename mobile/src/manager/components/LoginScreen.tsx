import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Shield, Lock, User } from "lucide-react-native";
import type { ScreenProps } from "./types";
import { KEYBOARD_BEHAVIOR } from '../../components/layout/KeyboardAvoider';

export function LoginScreenView({
  setCurrentScreen,
  employeeId,
  setEmployeeId,
  password,
  setPassword,
  showToast,
}: ScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!employeeId || !password) {
      showToast("Please enter credentials");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentScreen("app");
      showToast("Logged in successfully");
    }, 800);
  };

  return (
    <KeyboardAvoidingView
      behavior={KEYBOARD_BEHAVIOR}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Logo/Icon Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Shield size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>HSE Manager</Text>
          <Text style={styles.subtitle}>Health, Safety & Environment Portal</Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.loginHeader}>Sign In</Text>

          {/* Employee ID Input */}
          <View style={styles.inputContainer}>
            <View style={styles.iconWrapper}>
              <User size={20} color="#63739B" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor="#A0AEC0"
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.iconWrapper}>
              <Lock size={20} color="#63739B" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#A0AEC0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Verifying..." : "Sign In"}</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>Need help? Contact Administrator</Text>
        </View>

        {/* Footer info */}
        <Text style={styles.footerVersion}>v2.4.1 (React Native Native App)</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FC",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#0B3D91",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0B3D91",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0B3D91",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#63739B",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  loginHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  iconWrapper: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: "#2D3748",
  },
  button: {
    backgroundColor: "#0B3D91",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#0B3D91",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  helpText: {
    textAlign: "center",
    fontSize: 13,
    color: "#A0AEC0",
    marginTop: 20,
  },
  footerVersion: {
    textAlign: "center",
    fontSize: 11,
    color: "#63739B",
    marginTop: 40,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
