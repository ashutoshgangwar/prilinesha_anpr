// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import api, {
  setAccessToken,
  setOnLogout,
  refreshAccessToken,
} from '../api/axios';
import { DEMO } from '../config';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  // Access token kept in React state for re-rendering, mirrored into the axios
  // module so interceptors can read it. Never persisted to localStorage.
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyToken = useCallback((t) => {
    setAccessToken(t);
    setToken(t || null);
  }, []);

  const logout = useCallback(() => {
    // Best-effort backend logout to clear the refresh cookie; ignore failures.
    api.post('/api/auth/logout').catch(() => {});
    applyToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [applyToken, navigate]);

  // Wire the axios "session expired" callback to clear state + redirect.
  useEffect(() => {
    setOnLogout(() => {
      applyToken(null);
      setUser(null);
      navigate('/login', { replace: true });
    });
  }, [applyToken, navigate]);

  // On first load, silently try to restore a session from the refresh cookie.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const t = await refreshAccessToken();
        if (active) applyToken(t);
      } catch {
        if (active) applyToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyToken]);

  // Accepts the given identifier (email or phone) + password as a local-only
  // demo session. Returns true if accepted, false otherwise.
  const tryDemoLogin = useCallback(
    (identifier, password) => {
      if (!DEMO.enabled) return false;

      const id = String(identifier || '').trim();
      const pw = String(password || '');
      if (!id || !pw) return false;

      const matchesConfigured =
        (id === DEMO.email || id === DEMO.phone) && pw === DEMO.password;

      if (DEMO.allowAnyCredentials || matchesConfigured) {
        applyToken(DEMO.token);
        setUser({ name: DEMO.name, email: id, demo: true });
        return true;
      }
      return false;
    },
    [applyToken]
  );

  const login = useCallback(
    async (email, password) => {
      try {
        const resp = await api.post('/api/auth/login', { email, password });
        const { accessToken, user: u } = resp.data || {};
        applyToken(accessToken);
        if (u) setUser(u);
        return resp.data;
      } catch (err) {
        // Backend unreachable / rejected → fall back to the demo session.
        if (tryDemoLogin(email, password)) {
          return { demo: true };
        }
        throw err;
      }
    },
    [applyToken, tryDemoLogin]
  );

  const signup = useCallback(
    async (name, email, password) => {
      try {
        const resp = await api.post('/api/auth/signup', { name, email, password });
        const { accessToken, user: u } = resp.data || {};
        applyToken(accessToken);
        if (u) setUser(u);
        return resp.data;
      } catch (err) {
        if (DEMO.enabled && tryDemoLogin(email, password)) {
          setUser({ name: name || DEMO.name, email, demo: true });
          return { demo: true };
        }
        throw err;
      }
    },
    [applyToken, tryDemoLogin]
  );

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
