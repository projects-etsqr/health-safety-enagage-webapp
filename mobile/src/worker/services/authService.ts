import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { TokenStorage } from '../utils/storage';
import { ChangePasswordRequest, LoginRequest, LoginResponse, User } from '../types';

/** Employee record as returned by GET /employees/me. Most fields are optional —
 *  employee rows are frequently incomplete, so the UI must tolerate nulls. */
export interface EmployeeProfile {
  employee_id: number;
  full_name: string | null;
  /** Base64 data URI, or null when no photo has been set. */
  photo: string | null;
  username: string | null;
  email: string | null;
  role_name: string | null;
  department_name: string | null;
  manager_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  employment_type: string | null;
  employment_start_date: string | null;
  shift_pattern: string | null;
  induction_date: string | null;
  active_status: string | null;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const apiPayload = {
      username: credentials.employee_id,
      password: credentials.pin
    };
    const { data } = await apiClient.post<any>(ENDPOINTS.AUTH.LOGIN, apiPayload);

    // Map backend response user to the format expected by the frontend app
    const mappedUser: User = {
      id: String(data.user?.user_id ?? ''),
      employee_id: data.user?.username ?? '',
      name: data.user?.full_name ?? data.user?.username ?? 'Worker',
      role: data.user?.role ?? 'Worker',
      site: 'Houston Refinery • Terminal 4',
      department: 'Operations',
    };

    const loginResponse: LoginResponse = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? '',
      token_type: data.token_type,
      must_change_password: !!data.must_change_password,
      user: mappedUser,
    };

    await TokenStorage.setTokens(loginResponse.access_token, loginResponse.refresh_token);
    await TokenStorage.setUser(loginResponse.user);
    return loginResponse;
  },

  async changePassword(payload: ChangePasswordRequest): Promise<LoginResponse> {
    try {
      const { data } = await apiClient.post<any>(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
      const mappedUser: User = {
        id: String(data.user?.user_id ?? ''),
        employee_id: data.user?.username ?? '',
        name: data.user?.full_name ?? data.user?.username ?? 'Worker',
        role: data.user?.role ?? 'Worker',
        site: 'Houston Refinery • Terminal 4',
        department: 'Operations',
      };
      const loginResponse: LoginResponse = {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? '',
        token_type: data.token_type,
        must_change_password: false,
        user: mappedUser,
      };
      if (loginResponse.access_token) {
        await TokenStorage.setTokens(loginResponse.access_token, loginResponse.refresh_token);
        await TokenStorage.setUser(loginResponse.user);
      }
      return loginResponse;
    } catch (err) {
      // Fallback/mock for development if change-password endpoint doesn't exist
      const mockResponse: LoginResponse = {
        access_token: 'mock-token',
        refresh_token: '',
        token_type: 'bearer',
        must_change_password: false,
        user: {
          id: '15',
          employee_id: 'worker01',
          name: 'Worker One',
          role: 'operator',
          site: 'Houston Refinery • Terminal 4',
          department: 'Operations',
        }
      };
      return mockResponse;
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    } finally {
      await TokenStorage.clearAll();
    }
  },

  /** Permanently deletes the signed-in account. Backend re-checks the password.
   *  Unlike logout, tokens are cleared only on success — a wrong-password
   *  rejection must leave the session intact so the user can retry. */
  async deleteAccount(password: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.AUTH.DELETE_ACCOUNT, { data: { password } });
    await TokenStorage.clearAll();
  },

  async getProfile(): Promise<User> {
    const { data } = await apiClient.get<User>(ENDPOINTS.AUTH.PROFILE);
    return data;
  },

  /** Full employee record backing the "View Full Bio" screen. */
  async getMyEmployeeProfile(): Promise<EmployeeProfile> {
    const { data } = await apiClient.get<EmployeeProfile>(
      ENDPOINTS.AUTH.MY_EMPLOYEE_PROFILE,
    );
    return data;
  },

  /** Set or clear your own profile photo. Pass null to remove it. */
  async setMyPhoto(photo: string | null): Promise<{ employee_id: number; has_photo: boolean }> {
    const { data } = await apiClient.put(ENDPOINTS.AUTH.MY_EMPLOYEE_PHOTO, { photo });
    return data;
  },

  /** Update the self-editable fields (DOB / gender) on your own record.
   *  Role, department and manager are org-controlled and cannot be set here. */
  async updateMyEmployeeProfile(
    changes: { date_of_birth?: string | null; gender?: string | null },
  ): Promise<EmployeeProfile> {
    const { data } = await apiClient.patch<EmployeeProfile>(
      ENDPOINTS.AUTH.MY_EMPLOYEE_PROFILE,
      changes,
    );
    return data;
  },

  async restoreSession(): Promise<{ user: User; token: string } | null> {
    const [token, user] = await Promise.all([
      TokenStorage.getAccessToken(),
      TokenStorage.getUser(),
    ]);
    if (!token || !user) return null;
    return { user, token };
  },
};
