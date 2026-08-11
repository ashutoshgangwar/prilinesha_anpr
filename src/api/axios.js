// src/api/axios.js
import axios from 'axios';
import {
  getStoredRefreshToken,
  setStoredRefreshToken,
  clearStoredRefreshToken,
} from './authStorage';

/**
 * Backend origin, read from VITE_API_BASE_URL in .env.
 *
 * Vite inlines this at build time, so a change needs a dev-server restart. A
 * trailing slash is stripped because every path below is written with a leading
 * one, and `.../` + `/api/...` would produce a double slash that some routers
 * 404 on.
 */
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');


if (!BASE_URL) {
  // Without a base URL axios falls back to the page's own origin, where every
  // call 404s against the dev server — a confusing failure to debug. Say it once.
  console.error('VITE_API_BASE_URL is not set. Add it to .env and restart the dev server.');
}

/**
 * The access token lives in memory only — it dies with the tab.
 *
 * The refresh token is the credential that survives a reload, and the backend
 * expects it in the REQUEST BODY of /api/auth/refresh (not a cookie and not an
 * Authorization header — that is exactly what lets it work after the access
 * token has already expired). It is persisted by ./authStorage.
 */
let accessToken = null;

/** Callback registered by AuthContext, invoked when refresh ultimately fails. */
let onLogout = null;

/** Callback registered by AuthContext, invoked with the payload of a refresh. */
let onSessionRefreshed = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const setOnLogout = (cb) => {
  onLogout = cb;
};

export const setOnSessionRefreshed = (cb) => {
  onSessionRefreshed = cb;
};

/**
 * Reads the auth payload out of a response body.
 *
 * The API wraps everything in { success, message, data, requestId }, so the
 * interesting fields sit one level down. Legacy flat shapes (accessToken at the
 * top level) are still accepted so nothing breaks if an endpoint lags behind.
 */
export const readAuthPayload = (body) => {
  const d = body?.data && typeof body.data === 'object' ? body.data : body || {};
  return {
    token: d.token || d.accessToken || null,
    tokenType: d.token_type || 'Bearer',
    expiresIn: d.expires_in || null,
    refreshToken: d.refresh_token || d.refreshToken || null,
    refreshExpiresIn: d.refresh_expires_in || null,
    user: d.user || null,
  };
};

/**
 * Applies a login/refresh payload to the module state: access token in memory,
 * refresh token to storage. The refresh token is rotated on every refresh, so
 * the new one MUST replace the old — dropping it here would mean the next
 * refresh presents a spent token and the session dies early.
 */
export const applyAuthPayload = (payload) => {
  setAccessToken(payload.token);
  if (payload.refreshToken) setStoredRefreshToken(payload.refreshToken);
  return payload;
};

export const clearSession = () => {
  setAccessToken(null);
  clearStoredRefreshToken();
};

export const hasRefreshToken = () => !!getStoredRefreshToken();

/**
 * `withCredentials` is deliberately OFF.
 *
 * Nothing in this API is authenticated by a cookie — the access token rides in
 * the Authorization header and the refresh token in the request body. Turning
 * credentials mode on would be worse than useless: the backend answers with
 * `Access-Control-Allow-Origin: *`, and the CORS spec forbids a wildcard origin
 * for a credentialed request, so the browser would throw away every response —
 * including error bodies like the 401 from a wrong password, which then look
 * like the server is unreachable.
 */
const api = axios.create({
  baseURL: BASE_URL,
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
/**
 * The single in-flight refresh, shared by every concurrent caller.
 *
 * This matters because the refresh token ROTATES: two parallel calls would send
 * the same token, and whichever lost the race would be presenting one the
 * backend had already retired — a 401 that kills a perfectly good session. That
 * race is easy to hit: several requests 401-ing at once, the boot restore
 * overlapping the proactive timer, or React StrictMode double-invoking the
 * mount effect in dev.
 */
let refreshPromise = null;

/**
 * POST /api/auth/refresh with { refresh_token }.
 *
 * Uses a bare axios call rather than the `api` instance so it carries no
 * Authorization header and can never re-enter the 401 interceptor. Resolves
 * with the full payload — the endpoint returns a fresh pair *and* the user, so
 * a resuming dashboard does not also need /api/auth/me.
 */
const performRefresh = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  let resp;
  try {
    resp = await axios.post(
      `${BASE_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    // 401/403 → the token is expired, revoked, or already rotated: it is dead,
    // so drop it. A network error or 5xx is the backend's problem, not the
    // token's — keep it so the session can resume once the backend is back.
    const status = err?.response?.status;
    if (status === 400 || status === 401 || status === 403) {
      clearSession();
    }
    throw err;
  }

  const payload = readAuthPayload(resp.data);
  if (!payload.token) {
    clearSession();
    throw new Error('No access token returned from refresh');
  }

  applyAuthPayload(payload);
  if (onSessionRefreshed) onSessionRefreshed(payload);
  return payload;
};

/**
 * Refreshes the session, collapsing concurrent calls into one request. Every
 * caller gets the same payload; the next call after this one settles starts a
 * fresh request.
 */
export const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};

/**
 * POST /api/auth/logout.
 *  - { refresh_token }  → ends this device's session
 *  - { all: true }      → ends every session and retires outstanding access tokens
 *
 * Best-effort: local state is cleared by the caller regardless of the result,
 * because a user who clicked "log out" must end up logged out of this browser
 * even if the network call fails.
 */
export const revokeSession = async ({ allDevices = false } = {}) => {
  const refreshToken = getStoredRefreshToken();

  // The single-device form needs the refresh token to name the session, so with
  // no stored token there is nothing to revoke.
  if (!allDevices && !refreshToken) return;

  const bodyFor = (rt) => (allDevices ? { all: true } : { refresh_token: rt });

  try {
    await api.post('/api/auth/logout', bodyFor(refreshToken));
  } catch (err) {
    // /logout is an authenticated endpoint, but /api/auth/* is excluded from
    // the 401-refresh-retry above (so a failed login can't loop). Without this,
    // logging out with an already-expired access token would clear the browser
    // while leaving the session alive server-side for the rest of its 30 days.
    // Refresh once, then retry so the revocation actually lands.
    if (err?.response?.status !== 401 || !getStoredRefreshToken()) throw err;

    // Use the rotated token: the old one is spent, and re-presenting a spent
    // token to /refresh is treated as theft and revokes every session. /logout
    // itself accepts either generation, so this is only about staying honest.
    const { refreshToken: rotated } = await refreshAccessToken();
    await api.post('/api/auth/logout', bodyFor(rotated || getStoredRefreshToken()));
  }
};

// ---- Response interceptor: on 401 try to refresh, then retry ----------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // /api/auth/* is excluded so a failed login/refresh/logout never triggers a
    // refresh of its own.
    const isAuthEndpoint = originalRequest?.url?.includes('/api/auth/');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      // Nothing to refresh with — surface the 401 and end the session.
      if (!getStoredRefreshToken()) {
        setAccessToken(null);
        if (onLogout) onLogout();
        return Promise.reject(error);
      }

      // _retry is per-request, so a request is only ever replayed once. If a
      // refresh is already in flight this simply awaits it rather than starting
      // a second one.
      originalRequest._retry = true;

      try {
        const { token } = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearSession();
        if (onLogout) onLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
