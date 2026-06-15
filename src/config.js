// src/config.js

/**
 * Demo / offline login.
 *
 * When the backend at http://localhost:5050 is not running (or rejects the
 * login), the app falls back to a local "demo" session so the dashboard can
 * still be explored. This is purely a frontend convenience — no real token is
 * involved, and API calls that need the backend will simply show empty states.
 */
export const DEMO = {
  // Master switch for the offline fallback.
  enabled: true,

  // If true, ANY non-empty credentials are accepted in the fallback.
  // If false, only the exact credentials below work.
  allowAnyCredentials: true,

  // Pre-filled / suggested demo credentials (shown on the login page).
  email: 'demo@anpr.com',
  phone: '9999999999',
  password: 'demo123',
  name: 'Demo User',

  // Marker token kept in memory for the demo session.
  token: 'demo-session-token',
};
