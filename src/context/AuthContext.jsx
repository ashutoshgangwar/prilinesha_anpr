// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import api, {
  setAccessToken,
  setOnLogout,
  setOnSessionRefreshed,
  refreshAccessToken,
  revokeSession,
  readAuthPayload,
  applyAuthPayload,
  clearSession,
  hasRefreshToken,
} from '../api/axios';
import { onRefreshTokenChanged } from '../api/authStorage';
import { AUTH, DEMO } from '../config';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

/**
 * Turns the backend's human-readable lifetimes ("12h", "30d", "900s", 3600)
 * into milliseconds. Returns null when the value can't be understood, in which
 * case proactive refresh is simply skipped and the 401 interceptor covers it.
 */
export const parseDuration = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value > 0 ? value * 1000 : null;
  const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const factor = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n > 0 ? n * factor : null;
};

/**
 * Only fall back to the offline demo session when the backend could not answer
 * at all (network down / CORS / 5xx). A 400, 401, 403 or 429 is a real, correct
 * answer from a working backend — silently "logging in" past a rejected
 * password or a deactivated account would hide the actual failure from the user.
 */
const isBackendUnreachable = (err) => {
  if (!DEMO.enabled) return false;
  const status = err?.response?.status;
  if (status == null) return true; // no response at all
  return status >= 500;
};

export const AuthProvider = ({ children }) => {
  // Access token kept in React state for re-rendering, mirrored into the axios
  // module so interceptors can read it. Never persisted to localStorage — only
  // the refresh token is (see api/authStorage.js).
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshTimer = useRef(null);
  const isDemo = !!user?.demo;

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const endSession = useCallback(
    ({ redirect = true } = {}) => {
      clearRefreshTimer();
      clearSession();
      setToken(null);
      setUser(null);
      if (redirect) navigate('/login', { replace: true });
    },
    [clearRefreshTimer, navigate]
  );

  /**
   * Schedules a silent refresh shortly before the access token expires, so a
   * dashboard left open overnight keeps working without the user first hitting
   * a 401. The interceptor stays as the safety net for clock skew and sleep.
   */
  const scheduleRefresh = useCallback(
    (expiresIn) => {
      clearRefreshTimer();
      const lifetimeMs = parseDuration(expiresIn);
      if (!lifetimeMs) return;

      const delay = Math.max(
        AUTH.minRefreshDelayMs,
        lifetimeMs * AUTH.refreshLeadRatio
      );
      // setTimeout clamps above 2^31-1ms (~24.8 days); anything that far out is
      // covered by the on-mount refresh instead.
      if (delay > 2_147_483_647) return;

      refreshTimer.current = setTimeout(() => {
        refreshAccessToken().catch(() => {
          // Refresh failed — axios has already cleared a dead token and the
          // onLogout callback below handles the redirect.
        });
      }, delay);
    },
    [clearRefreshTimer]
  );

  /** Applies a login/refresh payload to both the axios module and React state. */
  const applySession = useCallback(
    (payload) => {
      applyAuthPayload(payload);
      setToken(payload.token || null);
      if (payload.user) setUser(payload.user);
      scheduleRefresh(payload.expiresIn);
      return payload;
    },
    [scheduleRefresh]
  );

  // Wire the axios callbacks: session death → clear + redirect; background
  // refresh (from the 401 interceptor) → keep React state in sync.
  useEffect(() => {
    setOnLogout(() => endSession());
    setOnSessionRefreshed((payload) => {
      setToken(payload.token || null);
      if (payload.user) setUser(payload.user);
      scheduleRefresh(payload.expiresIn);
    });
    return () => {
      setOnLogout(null);
      setOnSessionRefreshed(null);
    };
  }, [endSession, scheduleRefresh]);

  // On first load, try to resume from the stored refresh token. /api/auth/refresh
  // returns the user alongside the new pair, so no extra /api/auth/me is needed.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasRefreshToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const payload = await refreshAccessToken();
        if (active) {
          setToken(payload.token || null);
          if (payload.user) setUser(payload.user);
          scheduleRefresh(payload.expiresIn);
        }
      } catch {
        if (active) {
          setAccessToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scheduleRefresh]);

  // A logout (or login) in another tab changes the stored refresh token; mirror
  // that here so every tab agrees on who is signed in.
  useEffect(() => {
    return onRefreshTokenChanged((newValue) => {
      if (!newValue) endSession();
    });
  }, [endSession]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  // Accepts the given identifier (email or phone) + password as a local-only
  // demo session. Returns true if accepted, false otherwise.
  const tryDemoLogin = useCallback((identifier, password, overrides = {}) => {
    if (!DEMO.enabled) return false;

    const id = String(identifier || '').trim();
    const pw = String(password || '');
    if (!id || !pw) return false;

    const matchesConfigured =
      (id === DEMO.email || id === DEMO.phone) && pw === DEMO.password;

    if (DEMO.allowAnyCredentials || matchesConfigured) {
      // No refresh token: the demo session is memory-only and ends on reload.
      setAccessToken(DEMO.token);
      setToken(DEMO.token);
      setUser({ ...DEMO.user, name: DEMO.name, email: id, demo: true, ...overrides });
      return true;
    }
    return false;
  }, []);

  /**
   * POST /api/auth/login — the role is never sent, the backend looks it up, so
   * super admins and admins take the identical path here and differ only in the
   * user block that comes back.
   */
  const login = useCallback(
    async (email, password) => {
      try {
        const resp = await api.post('/api/auth/login', { email, password });
        const payload = readAuthPayload(resp.data);
        applySession(payload);
        return payload;
      } catch (err) {
        if (isBackendUnreachable(err) && tryDemoLogin(email, password)) {
          return { demo: true };
        }
        throw err;
      }
    },
    [applySession, tryDemoLogin]
  );

  const signup = useCallback(
    async (name, email, password) => {
      try {
        const resp = await api.post('/api/auth/signup', { name, email, password });
        const payload = readAuthPayload(resp.data);
        applySession(payload);
        return payload;
      } catch (err) {
        if (isBackendUnreachable(err) && tryDemoLogin(email, password, { name })) {
          return { demo: true };
        }
        throw err;
      }
    },
    [applySession, tryDemoLogin]
  );

  /**
   * POST /api/auth/logout, then clear locally.
   *
   * `{ allDevices: true }` sends { all: true }, which ends every session and
   * retires outstanding access tokens too. Called straight from an onClick, so
   * the argument may be a DOM event — reading one missing property off it is
   * harmless and keeps `onClick={logout}` working.
   */
  const logout = useCallback(
    async (options) => {
      const allDevices = options?.allDevices === true;
      if (!isDemo) {
        try {
          await revokeSession({ allDevices });
        } catch {
          // Best effort: the local session is torn down either way.
        }
      }
      endSession();
    },
    [endSession, isDemo]
  );

  /** Manual refresh, for callers that want to force one (e.g. a retry button). */
  const refreshSession = useCallback(async () => {
    const payload = await refreshAccessToken();
    setToken(payload.token || null);
    if (payload.user) setUser(payload.user);
    scheduleRefresh(payload.expiresIn);
    return payload;
  }, [scheduleRefresh]);

  // ---- Role / permission helpers ---------------------------------------------
  const isSuperAdmin = !!user?.is_super_admin || user?.role === 'super_admin';

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.is_super_admin || user.role === 'super_admin') return true;
      const list = Array.isArray(user.permissions) ? user.permissions : [];
      return list.includes(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (...permissions) => permissions.flat().some((p) => hasPermission(p)),
    [hasPermission]
  );

  /** group_ids is the string "ALL" for super admins, otherwise an array. */
  const canAccessGroup = useCallback(
    (groupId) => {
      if (!user) return false;
      if (user.group_ids === 'ALL') return true;
      return Array.isArray(user.group_ids) && user.group_ids.includes(groupId);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!token,
      isDemo,
      isSuperAdmin,
      role: user?.role || null,
      projects: user?.projects || [],
      permissions: user?.permissions || [],
      hasPermission,
      hasAnyPermission,
      canAccessGroup,
      login,
      signup,
      logout,
      refreshSession,
    }),
    [
      token,
      user,
      loading,
      isDemo,
      isSuperAdmin,
      hasPermission,
      hasAnyPermission,
      canAccessGroup,
      login,
      signup,
      logout,
      refreshSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
