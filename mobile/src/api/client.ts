import axios, { AxiosResponse } from 'axios';
import { API_BASE_URL } from '../constants/config';
import { TokenStorage } from '../utils/storage';
import { registerClient } from '../services/offlineQueue';

const BASE_URL = API_BASE_URL;

// Unwrap the backend envelope { success, message, data } -> data so services
// receive the payload directly.
function unwrap(res: AxiosResponse): AxiosResponse {
  const body = res.data;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    res.data = body.data;
  }
  return res;
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await TokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => unwrap(res),
  async (err) => {
    if (err.response?.status === 401) {
      await TokenStorage.clearAll();
    }
    return Promise.reject(err);
  }
);

// Two minutes, not thirty seconds.
//
// The server accepts media up to 100 MB — the cap was chosen for video — and a
// recording of any length will not finish uploading in 30s on a site
// connection. The request aborted, the caller fell back to queueing the whole
// attachment offline, and the auditor was told their video had been "saved
// offline" on a phone with full signal. Photos were small enough that nobody
// noticed the ceiling was there.
export const uploadClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'multipart/form-data' },
});

uploadClient.interceptors.request.use(async (config) => {
  const token = await TokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

uploadClient.interceptors.response.use((res) => unwrap(res));

// Registered as the fallback client for the offline queue — see offlineQueue.ts.
registerClient('default', apiClient);
registerClient('defaultUpload', uploadClient);