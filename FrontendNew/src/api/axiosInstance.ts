import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(async (config) => {
  // Let browser set Content-Type with boundary for multipart requests
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  // Read JWT token from localStorage and set Authorization header
  try {
    const token = localStorage.getItem('hse_jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Unable to resolve JWT token for API request:', error);
  }

  // Read hse_user for supplementary headers
  try {
    const storedUserRaw = localStorage.getItem('hse_user');
    const storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as { email?: string; role?: string }) : null;
    if (storedUser?.email) config.headers['X-User-Email'] = storedUser.email;
    if (storedUser?.role) config.headers['X-User-Role'] = storedUser.role;
  } catch (error) {
    console.warn('Unable to resolve local user for API request:', error);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem('hse_jwt_token');
      localStorage.removeItem('hse_auth');
      localStorage.removeItem('hse_user');
      localStorage.removeItem('hse_subscription');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const message =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.response?.statusText ||
      error.message ||
      'Request failed';
    console.error(`API request failed [${status}]:`, message);

    // Keep the original axios error (with .response.data.detail intact) so
    // callers that read the backend's actual error detail still can — only
    // enrich .message for code that just wants a readable string.
    error.message = typeof message === 'string' ? message : `API Error ${status}`;
    return Promise.reject(error);
  },
);

export default axiosInstance;
