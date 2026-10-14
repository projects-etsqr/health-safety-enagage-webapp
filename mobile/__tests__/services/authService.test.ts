import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { authService } from '../../src/services/authService';
import { TokenStorage } from '../../src/utils/storage';
import { STORAGE_KEYS } from '../../src/constants/config';
import { ENDPOINTS } from '../../src/api/endpoints';

const mock = new MockAdapter(apiClient);

describe('authService', () => {
  beforeEach(() => {
    mock.reset();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('posts to /auth/login and persists tokens + user from unwrapped envelope', async () => {
      const user = {
        id: 'u-1',
        employee_id: 'SUP-001',
        name: 'Anu Supervisor',
        role: 'supervisor',
      };
      mock.onPost(ENDPOINTS.AUTH.LOGIN).reply(200, {
        success: true,
        message: 'ok',
        data: {
          access_token: 'access-abc',
          refresh_token: 'refresh-xyz',
          user,
        },
      });

      const setTokensSpy = jest
        .spyOn(TokenStorage, 'setTokens')
        .mockResolvedValue(undefined);
      const setUserSpy = jest
        .spyOn(TokenStorage, 'setUser')
        .mockResolvedValue(undefined);

      const res = await authService.login({
        employee_id: 'SUP-001',
        password: 'pw',
      });

      expect(res.access_token).toBe('access-abc');
      expect(res.refresh_token).toBe('refresh-xyz');
      expect(res.user).toEqual(user);
      expect(setTokensSpy).toHaveBeenCalledWith('access-abc', 'refresh-xyz');
      expect(setUserSpy).toHaveBeenCalledWith(user);
    });

    it('returns the full LoginResponse object', async () => {
      const user = {
        id: 'u-2',
        employee_id: 'SUP-002',
        name: 'Bea',
        role: 'supervisor',
      };
      mock.onPost(ENDPOINTS.AUTH.LOGIN).reply(200, {
        success: true,
        data: { access_token: 'a', refresh_token: 'r', user },
      });
      jest.spyOn(TokenStorage, 'setTokens').mockResolvedValue(undefined);
      jest.spyOn(TokenStorage, 'setUser').mockResolvedValue(undefined);

      const res = await authService.login({
        employee_id: 'SUP-002',
        password: 'pw',
      });
      expect(res).toEqual({ access_token: 'a', refresh_token: 'r', user });
    });
  });

  describe('logout', () => {
    it('calls /auth/logout then clears storage', async () => {
      let logoutHit = 0;
      mock.onPost(ENDPOINTS.AUTH.LOGOUT).reply(() => {
        logoutHit += 1;
        return [200, { success: true, data: null }];
      });

      const clearSpy = jest
        .spyOn(TokenStorage, 'clearAll')
        .mockResolvedValue(undefined);

      await authService.logout();
      expect(logoutHit).toBe(1);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('still clears storage when the logout endpoint throws', async () => {
      mock.onPost(ENDPOINTS.AUTH.LOGOUT).networkError();
      const clearSpy = jest
        .spyOn(TokenStorage, 'clearAll')
        .mockResolvedValue(undefined);

      await expect(authService.logout()).resolves.toBeUndefined();
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProfile', () => {
    it('GETs /auth/me and returns the unwrapped user', async () => {
      const user = {
        id: 'u-3',
        employee_id: 'SUP-003',
        name: 'Cara',
        role: 'supervisor',
      };
      mock.onGet(ENDPOINTS.AUTH.PROFILE).reply(200, {
        success: true,
        data: user,
      });

      const res = await authService.getProfile();
      expect(res).toEqual(user);
    });
  });

  describe('restoreSession', () => {
    it('returns null when no access token is in storage', async () => {
      jest.spyOn(TokenStorage, 'getAccessToken').mockResolvedValue(null);
      jest.spyOn(TokenStorage, 'getUser').mockResolvedValue(null);

      const res = await authService.restoreSession();
      expect(res).toBeNull();
    });

    it('returns null when a token exists but no user', async () => {
      jest.spyOn(TokenStorage, 'getAccessToken').mockResolvedValue('tok');
      jest.spyOn(TokenStorage, 'getUser').mockResolvedValue(null);

      const res = await authService.restoreSession();
      expect(res).toBeNull();
    });

    it('returns { user, token } when both are present', async () => {
      const user = {
        id: 'u-4',
        employee_id: 'SUP-004',
        name: 'Dan',
        role: 'supervisor',
      };
      jest
        .spyOn(TokenStorage, 'getAccessToken')
        .mockResolvedValue('access-token');
      jest.spyOn(TokenStorage, 'getUser').mockResolvedValue(user);

      const res = await authService.restoreSession();
      expect(res).toEqual({ user, token: 'access-token' });
    });
  });

  describe('storage keys', () => {
    it('uses the supervisor-prefixed STORAGE_KEYS', () => {
      expect(STORAGE_KEYS.ACCESS_TOKEN).toBe('sup_access_token');
    });
  });
});
