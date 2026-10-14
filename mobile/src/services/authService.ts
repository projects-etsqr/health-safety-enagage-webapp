import { apiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { TokenStorage } from '../utils/storage';
import { TokenStorage as WorkerTokenStorage } from '../worker/utils/storage';
import type { LoginRequest, LoginResponse, User, ChangePasswordRequest } from '../types/auth.types';

/**
 * The worker app keeps its own AsyncStorage keys (worker_*) so a worker session
 * can't collide with a supervisor one. Login writes the shared keys, so mirror
 * the tokens across or the worker apiClient sends no Authorization header.
 */
async function syncWorkerSession(res: LoginResponse): Promise<void> {
  await WorkerTokenStorage.setTokens(res.access_token, res.refresh_token);
  if (res.user) {
    await WorkerTokenStorage.setUser(res.user as any);
  }
}

export const authService = {
  async login(data: LoginRequest, role: 'manager' | 'supervisor' | 'worker' | 'auditor'): Promise<LoginResponse> {
    // All roles authenticate against the backend so their tokens carry a real
    // role/org — the manager's approve/close and permit steps hit protected
    // endpoints that reject the old 'mock-manager-token'. A mock is only used as an
    // offline fallback below, mirroring the other roles.
    const apiPayload = {
      username: data.employee_id,
      password: data.password || data.pin || 'password'
    };

    try {
      const res = await apiClient.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, apiPayload);
      const resData = res.data;

      // The backend returns the user as { user_id, username, full_name, role, ... },
      // but the app's User shape needs { id, employee_id, name, role }. Without this
      // mapping `user.name` is undefined and every profile screen shows its hardcoded
      // placeholder ("Alex Safety") instead of the person who actually logged in.
      const raw = resData.user as any;
      if (raw) {
        const defaultRole =
          role === 'supervisor' ? 'Supervisor'
          : role === 'auditor' ? 'Auditor'
          : role === 'manager' ? 'Manager'
          : 'Worker';
        resData.user = {
          ...raw,
          id: String(raw.id ?? raw.user_id ?? ''),
          employee_id: raw.employee_id ?? raw.username ?? '',
          name: raw.name ?? raw.full_name ?? raw.username ?? defaultRole,
          role: raw.role ?? defaultRole,
        };
      }

      await TokenStorage.setTokens(resData.access_token, resData.refresh_token);
      await TokenStorage.setUser(resData.user);
      await TokenStorage.setSelectedRole(role);
      if (role === 'worker') {
        await syncWorkerSession(resData);
      }
      return resData;
    } catch (err: any) {
      console.log('Login API failed, checking network/offline fallback:', err?.message || err);
      
      // If network error, offline, or server is down, we use developer mock fallbacks (only outside tests)
      const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      if (isNetworkError && process.env.NODE_ENV !== 'test') {
        let mockRes: LoginResponse;
        if (role === 'supervisor') {
          mockRes = {
            access_token: 'mock-supervisor-token',
            refresh_token: 'mock-supervisor-refresh',
            user: {
              id: '2',
              employee_id: data.employee_id || 'ENG-0442-TX',
              name: 'Raj Sharma',
              role: 'Supervisor',
              site: 'Houston Refinery • Terminal 4',
              department: 'Production Floor'
            }
          };
        } else if (role === 'auditor') {
          mockRes = {
            access_token: 'mock-auditor-token',
            refresh_token: 'mock-auditor-refresh',
            user: {
              id: '4',
              employee_id: data.employee_id || 'auditor01',
              name: 'Auditor One',
              role: 'Auditor',
              site: 'Houston Refinery • Terminal 4',
              department: 'HSE Audit'
            }
          };
        } else if (role === 'manager') {
          mockRes = {
            access_token: 'mock-manager-token',
            refresh_token: 'mock-manager-refresh',
            user: {
              id: '1',
              employee_id: data.employee_id || '8842-TX',
              name: 'Sarah Mitchell',
              role: 'Manager',
              site: 'Houston Refinery • Terminal 4',
              department: 'HSE & Compliance'
            }
          };
        } else {
          mockRes = {
            access_token: 'mock-worker-token',
            refresh_token: 'mock-worker-refresh',
            user: {
              id: '3',
              employee_id: data.employee_id || '8842-TX',
              name: 'Tom Bradley',
              role: 'Worker',
              site: 'Houston Refinery • Terminal 4',
              department: 'Operations'
            }
          };
        }

        await TokenStorage.setTokens(mockRes.access_token, mockRes.refresh_token);
        await TokenStorage.setUser(mockRes.user);
        await TokenStorage.setSelectedRole(role);
        return mockRes;
      }
      // If it's a validation or credentials error (e.g. 401), rethrow it
      throw err;
    }
  },

  async changePassword(payload: ChangePasswordRequest): Promise<LoginResponse> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
      const resData = res.data;
      if (resData.access_token) {
        await TokenStorage.setTokens(resData.access_token, resData.refresh_token || '');
        if (resData.user) {
          await TokenStorage.setUser(resData.user);
        }
      }
      return resData;
    } catch (err) {
      // Fallback for mock/dev
      const mockRes: LoginResponse = {
        access_token: 'mock-token',
        refresh_token: '',
        user: {
          id: '3',
          employee_id: '8842-TX',
          name: 'Tom Bradley',
          role: 'Worker',
          site: 'Houston Refinery • Terminal 4',
          department: 'Operations'
        }
      };
      return mockRes;
    }
  },

  async logout(): Promise<void> {
    try { await apiClient.post(ENDPOINTS.AUTH.LOGOUT); } catch {}
    await TokenStorage.clearAll();
    // Mirrored in syncWorkerSession on login — clear it or a stale worker token survives logout.
    await WorkerTokenStorage.clearAll();
  },

  /** Permanently deletes the signed-in account. Backend re-checks the password. */
  async deleteAccount(password: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.AUTH.DELETE_ACCOUNT, { data: { password } });
    await TokenStorage.clearAll();
    await WorkerTokenStorage.clearAll();
  },

  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>(ENDPOINTS.AUTH.PROFILE);
    return res.data;
  },

  async restoreSession(): Promise<{ user: User; token: string } | null> {
    const [token, user] = await Promise.all([
      TokenStorage.getAccessToken(),
      TokenStorage.getUser<User>(),
    ]);
    if (!token || !user) return null;
    return { user, token };
  },
};
