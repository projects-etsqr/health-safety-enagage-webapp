import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../constants/config';
import { TokenStorage } from '../utils/storage';
import { ENDPOINTS } from './endpoints';
import { registerClient } from '../../services/offlineQueue';

// Queued requests waiting for an in-flight token refresh to complete.
// Each entry holds the resolve/reject of its outer Promise so it can be
// retried or rejected once the refresh settles.
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

function flushQueue(error: unknown, token: string | null) {
  failedQueue.forEach(entry => error ? entry.reject(error) : entry.resolve(token!));
  failedQueue = [];
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ──────────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await TokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response: unwrap envelope + auto-refresh on 401 ───────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap { success, data } envelope so services get the payload directly.
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401, and never on the refresh call itself.
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url === ENDPOINTS.AUTH.REFRESH
    ) {
      return Promise.reject(error);
    }

    // If a refresh is already running, queue this request and wait.
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = await TokenStorage.getRefreshToken();

    if (!refreshToken) {
      // No refresh token stored — session is unrecoverable.
      await TokenStorage.clearAll();
      flushQueue(error, null);
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      // Use a plain axios instance so this call bypasses our own interceptors
      // and cannot trigger another refresh loop.
      const raw = await axios.post(
        `${API_BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );

      // Handle both a bare response and a wrapped { success, data } envelope.
      const payload = raw.data?.data ?? raw.data;
      const newAccess: string  = payload.access_token;
      const newRefresh: string = payload.refresh_token;

      await TokenStorage.setTokens(newAccess, newRefresh);

      // Update the default header so subsequent requests use the new token.
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      original.headers['Authorization'] = `Bearer ${newAccess}`;

      flushQueue(null, newAccess);
      return apiClient(original);
    } catch (refreshError) {
      // Refresh failed (token expired / revoked) — force re-login.
      await TokenStorage.clearAll();
      flushQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

// ── Multipart client (file uploads) ──────────────────────────────────────────
// Shares the same token-refresh logic via a thin request wrapper.
export const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'multipart/form-data' },
});

uploadClient.interceptors.request.use(async (config) => {
  const token = await TokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

uploadClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    // Delegate 401 handling to apiClient's interceptor by re-issuing through it.
    if (error.response?.status === 401) {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      if (!original._retry) {
        original._retry = true;
        // Wait for apiClient to finish any in-flight refresh, then retry.
        const token = await TokenStorage.getAccessToken();
        if (token) {
          original.headers['Authorization'] = `Bearer ${token}`;
          return uploadClient(original);
        }
      }
    }
    return Promise.reject(error);
  },
);

// ── Offline queue registration ───────────────────────────────────────────────
// The queue stores a client *name* rather than an axios instance (an instance
// cannot be serialised), so both of this app's clients register themselves here
// and the queue resolves them at flush time.
registerClient('worker', apiClient);
registerClient('workerUpload', uploadClient);
