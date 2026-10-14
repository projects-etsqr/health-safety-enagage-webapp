import { create } from 'zustand';
import { authService } from '../services/authService';
import { TokenStorage } from '../utils/storage';
import { normalizeRole } from '../utils/roles';
import type { AuthState, LoginRequest, ChangePasswordRequest } from '../types/auth.types';

interface AuthStore extends AuthState {
  setSelectedRole: (role: 'manager' | 'supervisor' | 'worker' | 'auditor' | null) => void;
  login: (data: LoginRequest) => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  selectedRole: null,
  mustChangePassword: false,

  setSelectedRole: (role) => set({ selectedRole: role }),

  login: async (data) => {
    set({ isLoading: true, error: null });
    const { selectedRole } = get();
    const roleToUse = selectedRole || 'supervisor';
    try {
      const res = await authService.login(data, roleToUse);
      // The backend role is authoritative: a safety_manager must land in the
      // manager app regardless of which tab was picked. Fall back to the picked
      // role only when the backend doesn't return one.
      const effectiveRole = normalizeRole(res.user?.role) || roleToUse;
      await TokenStorage.setSelectedRole(effectiveRole);
      set({
        user: res.user,
        accessToken: res.access_token,
        isAuthenticated: true,
        selectedRole: effectiveRole,
        mustChangePassword: !!res.must_change_password,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err?.response?.data?.detail ?? 'Login failed',
        isLoading: false,
      });
    }
  },

  changePassword: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.changePassword(payload);
      set({
        user: res.user,
        accessToken: res.access_token,
        isAuthenticated: true,
        mustChangePassword: false,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err?.response?.data?.detail ?? 'Could not change password',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false, selectedRole: null, mustChangePassword: false, isLoading: false });
    }
  },

  deleteAccount: async (password) => {
    set({ isLoading: true, error: null });
    try {
      await authService.deleteAccount(password);
      set({ user: null, accessToken: null, isAuthenticated: false, selectedRole: null, mustChangePassword: false, isLoading: false });
    } catch (err: any) {
      set({
        error: err?.response?.data?.detail ?? 'Could not delete account',
        isLoading: false,
      });
      throw err;
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const session = await authService.restoreSession();
      if (session) {
        const storedRole = await TokenStorage.getSelectedRole();
        // Normalise both the persisted pick and the backend role so a stored
        // 'safety_manager'/'operator' resolves to a real mobile role instead of
        // silently falling through to the worker stack.
        const role = normalizeRole(storedRole) || normalizeRole(session.user.role) || 'supervisor';
        set({ user: session.user, accessToken: session.token, isAuthenticated: true, selectedRole: role });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
