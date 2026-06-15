// src/api/axios.js
import axios from 'axios';

export const BASE_URL = 'http://localhost:5050';

/**
 * The access token lives in memory only (never localStorage).
 * The refresh token is stored by the backend in an httpOnly cookie, which is
 * sent automatically because every request uses `withCredentials: true`.
 */
let accessToken = null;

/** Callback registered by AuthContext, invoked when refresh ultimately fails. */
let onLogout = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const setOnLogout = (cb) => {
  onLogout = cb;
};

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request interceptor: attach the Bearer token ----------------------------
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ---- Token refresh handling --------------------------------------------------
let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

/**
 * Calls POST /api/auth/refresh. Uses a bare axios call (not the `api` instance)
 * so it never triggers the 401 interceptor recursively. The refresh token rides
 * along in the httpOnly cookie thanks to `withCredentials`.
 */
export const refreshAccessToken = async () => {
  const resp = await axios.post(
    `${BASE_URL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  );
  const newToken = resp.data?.accessToken;
  if (!newToken) {
    throw new Error('No access token returned from refresh');
  }
  setAccessToken(newToken);
  return newToken;
};

// ---- Response interceptor: on 401 try to refresh, then retry ----------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    const isAuthEndpoint = originalRequest?.url?.includes('/api/auth/');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      // A refresh is already in flight — queue this request until it resolves.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        flushQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        setAccessToken(null);
        if (onLogout) onLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
