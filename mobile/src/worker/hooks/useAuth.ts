import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { ChangePasswordRequest, LoginRequest } from '../types';

export function useAuth() {
  const {
    user, isAuthenticated, isLoading, error, mustChangePassword,
    login, logout, deleteAccount, changePassword, restoreSession, clearError,
  } = useAuthStore();

  const handleLogin = useCallback(async (credentials: LoginRequest) => {
    await login(credentials);
  }, [login]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleDeleteAccount = useCallback(async (password: string) => {
    await deleteAccount(password);
  }, [deleteAccount]);

  const handleChangePassword = useCallback(async (payload: ChangePasswordRequest) => {
    await changePassword(payload);
  }, [changePassword]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    mustChangePassword,
    login: handleLogin,
    logout: handleLogout,
    deleteAccount: handleDeleteAccount,
    changePassword: handleChangePassword,
    restoreSession,
    clearError,
  };
}
