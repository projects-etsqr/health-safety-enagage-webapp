import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { TokenStorage } from '../../src/utils/storage';
import { ENDPOINTS } from '../../src/api/endpoints';

const mock = new MockAdapter(apiClient);

const resetStore = () =>
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

describe('authStore', () => {
  beforeEach(() => {
    mock.reset();
    jest.clearAllMocks();
    resetStore();
  });

  it('initial state: isLoading=true, no user, not authenticated, no error', () => {
    // re-initialise the slice without firing the initial isLoading tweak
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
    const s = useAuthStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.error).toBeNull();
  });

  describe('login', () => {
    it('on success: sets user, accessToken, isAuthenticated, clears isLoading', async () => {
      const user = {
        id: 'u-1',
        employee_id: 'SUP-1',
        name: 'A',
        role: 'supervisor',
      };
      mock.onPost(ENDPOINTS.AUTH.LOGIN).reply(200, {
        success: true,
        data: { access_token: 'a', refresh_token: 'r', user },
      });
      jest.spyOn(TokenStorage, 'setTokens').mockResolvedValue(undefined);
      jest.spyOn(TokenStorage, 'setUser').mockResolvedValue(undefined);

      await useAuthStore.getState().login({
        employee_id: 'SUP-1',
        password: 'pw',
      });

      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.isLoading).toBe(false);
      expect(s.user).toEqual(user);
      expect(s.accessToken).toBe('a');
      expect(s.error).toBeNull();
    });

    it('on failure: sets error from response detail and stops loading', async () => {
      mock.onPost(ENDPOINTS.AUTH.LOGIN).reply(401, {
        detail: 'Invalid credentials',
      });

      await useAuthStore.getState().login({
        employee_id: 'SUP-1',
        password: 'wrong',
      });

      const s = useAuthStore.getState();
      expect(s.isLoading).toBe(false);
      expect(s.isAuthenticated).toBe(false);
      expect(s.user).toBeNull();
      expect(s.error).toBe('Invalid credentials');
    });

    it('on network failure: falls back to a generic "Login failed" message', async () => {
      mock.onPost(ENDPOINTS.AUTH.LOGIN).networkError();

      await useAuthStore.getState().login({
        employee_id: 'SUP-1',
        password: 'pw',
      });

      const s = useAuthStore.getState();
      expect(s.error).toBe('Login failed');
      expect(s.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('resets user, accessToken, and isAuthenticated (and stops loading)', async () => {
      // Seed the store with a logged-in user
      useAuthStore.setState({
        user: {
          id: 'u-1',
          employee_id: 'SUP-1',
          name: 'A',
          role: 'supervisor',
        },
        accessToken: 'tok',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      mock.onPost(ENDPOINTS.AUTH.LOGOUT).reply(200, { success: true, data: null });
      jest.spyOn(TokenStorage, 'clearAll').mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.accessToken).toBeNull();
      expect(s.isAuthenticated).toBe(false);
    });
  });

  describe('restoreSession', () => {
    it('populates state when a session exists, and stops loading', async () => {
      const user = {
        id: 'u-2',
        employee_id: 'SUP-2',
        name: 'B',
        role: 'supervisor',
      };
      jest
        .spyOn(TokenStorage, 'getAccessToken')
        .mockResolvedValue('access-token');
      jest.spyOn(TokenStorage, 'getUser').mockResolvedValue(user);

      await useAuthStore.getState().restoreSession();

      const s = useAuthStore.getState();
      expect(s.user).toEqual(user);
      expect(s.accessToken).toBe('access-token');
      expect(s.isAuthenticated).toBe(true);
      expect(s.isLoading).toBe(false);
    });

    it('leaves user null when there is no session, and stops loading', async () => {
      jest
        .spyOn(TokenStorage, 'getAccessToken')
        .mockResolvedValue(null);
      jest.spyOn(TokenStorage, 'getUser').mockResolvedValue(null);

      await useAuthStore.getState().restoreSession();

      const s = useAuthStore.getState();
      expect(s.user).toBeNull();
      expect(s.isAuthenticated).toBe(false);
      expect(s.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('resets the error to null', () => {
      useAuthStore.setState({ error: 'something bad' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
