// src/api/authStorage.js
//
// Persistence for the refresh token.
//
// The backend returns the refresh token in the JSON body (and expects it back
// in the body of /api/auth/refresh and /api/auth/logout) rather than setting an
// httpOnly cookie. That means the SPA itself has to hold it if a session is to
// survive a page reload, so it goes in localStorage.
//
// Trade-off, stated plainly: a refresh token in localStorage is readable by any
// script running on the origin, so an XSS bug escalates to a stolen 30-day
// session. The access token is deliberately kept in memory only (see axios.js),
// and /api/auth/logout with { all: true } is the revocation path if a token is
// ever suspected of leaking. If the backend later moves the refresh token into
// an httpOnly cookie, this module is the only thing that needs to change.

import { AUTH } from '../config';

// Safari private mode (and some embedded webviews) throw on localStorage access.
// Fall back to a module-level variable so the session still works for the life
// of the tab instead of the app hard-failing.
let memoryFallback = null;

const store = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getStoredRefreshToken = () => {
  const s = store();
  if (!s) return memoryFallback;
  try {
    return s.getItem(AUTH.storageKey) || memoryFallback;
  } catch {
    return memoryFallback;
  }
};

export const setStoredRefreshToken = (token) => {
  memoryFallback = token || null;
  const s = store();
  if (!s) return;
  try {
    if (token) s.setItem(AUTH.storageKey, token);
    else s.removeItem(AUTH.storageKey);
  } catch {
    // Quota / disabled storage — the in-memory copy above still covers this tab.
  }
};

export const clearStoredRefreshToken = () => setStoredRefreshToken(null);

/**
 * Notifies the callback when the refresh token changes in ANOTHER tab, so a
 * logout in one tab tears the session down everywhere. Returns an unsubscribe
 * function. The callback receives the new token value (null when cleared).
 */
export const onRefreshTokenChanged = (cb) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (event.key !== AUTH.storageKey) return;
    memoryFallback = event.newValue || null;
    cb(event.newValue || null);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};
