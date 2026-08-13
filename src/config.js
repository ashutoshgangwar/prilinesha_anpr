// src/config.js

/**
 * Demo / offline login — OFF.
 *
 * This used to sign in locally when the backend was unreachable and serve
 * invented rows from api/mockData.js to every screen. It is off because those
 * rows are indistinguishable from real ones: a dead API or an expired session
 * produced a dashboard of plausible plates, counts and passes that an operator
 * could read, believe and act on.
 *
 * What happens instead: a failed GET shows loading skeletons alongside the error
 * (see components/Skeletons.jsx), so the screen says "not available" rather than
 * showing something that isn't true. Turning `enabled` back on restores the old
 * behaviour — the mock module is still there — but nothing should ship with it.
 */
/**
 * Auth / token handling knobs.
 */
export const AUTH = {
  // localStorage key holding the refresh token (see api/authStorage.js).
  storageKey: 'anpr.refresh_token',

  // Refresh the access token after this fraction of its lifetime has elapsed
  // (0.8 of a 12h token → refresh at ~9h36m), so requests never race expiry.
  refreshLeadRatio: 0.8,

  // Never schedule a proactive refresh sooner than this, to avoid a tight loop
  // if the backend ever hands back a very short-lived token.
  minRefreshDelayMs: 30_000,
};

export const DEMO = {
  // Master switch for the offline fallback. Off: no screen may show mock data.
  enabled: false,

  // If true, ANY non-empty credentials are accepted in the fallback.
  // If false, only the exact credentials below work.
  //
  // Kept OFF on purpose. The fallback only runs when the backend gave no
  // answer at all, and "any password works" makes a plain connection failure
  // indistinguishable from a successful login — you end up trusting a session
  // that never touched the server. With this off, a wrong password against an
  // unreachable backend says so instead of quietly signing you in.
  allowAnyCredentials: false,

  // Pre-filled / suggested demo credentials (shown on the login page).
  email: 'demo@anpr.com',
  phone: '9999999999',
  password: 'demo123',
  name: 'Demo User',

  // Marker token kept in memory for the demo session. There is deliberately no
  // demo refresh token: the demo session lives in memory and ends on reload,
  // so it can never be confused with a real one by the refresh interceptor.
  token: 'demo-session-token',

  // Shape mirrors the real /api/auth/login user block so screens that read
  // role / permissions / projects behave the same offline.
  user: {
    id: 'demo-user',
    name: 'Demo User',
    role: 'super_admin',
    is_super_admin: true,
    group_ids: 'ALL',
    projects: [
      { group_id: 'GRP-001', project_name: 'Ashiana Society', is_active: true },
      { group_id: 'GRP-002', project_name: 'Phoenix Mall Parking', is_active: true },
    ],
    permissions: [],
    is_active: true,
  },
};
