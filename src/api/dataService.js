// src/api/dataService.js
//
// Single entry point for all data calls used by the pages. Each function tries
// the real backend first; if the backend is unreachable (or the endpoint isn't
// ready yet) AND the demo fallback is enabled, it quietly returns mock data
// instead of throwing — so the UI shows data and doesn't spam network errors.
//
// List getters return a normalized { items, total }.
// When you connect the real backend, these automatically start using it.

import api from './axios';
import { DEMO } from '../config';
import { normalizeListResponse } from '../utils/format';
import * as mock from './mockData';

// Fall back only when the backend gave no answer at all (server down / network)
// or failed on its own side (5xx).
//
// 404 and 405 used to fall back too, which quietly turned "this endpoint does
// not exist" into a screen full of convincing mock data — and, on a DELETE, into
// a success toast for a request the server never honoured. A missing endpoint is
// a bug to surface, not to paper over.
const shouldFallback = (err) => {
  if (!DEMO.enabled) return false;
  const status = err?.response?.status;
  if (status == null) return true; // network error, no response
  return status >= 500;
};

// ---- Logs --------------------------------------------------------------------
export async function fetchLogs(params = {}) {
  try {
    const resp = await api.get('/api/logs', { params });
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getLogs(params);
    throw err;
  }
}

// There is deliberately no fetchLog(id) or deleteLog(id): the API exposes only
// GET /api/logs. The detection log is an append-only record of what a camera
// saw, and the backend offers no way to read one event or to delete one — so
// the dashboard must not pretend otherwise.

// ---- Vehicles ----------------------------------------------------------------
export async function fetchVehicles() {
  try {
    const resp = await api.get('/api/vehicles');
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getVehicles();
    throw err;
  }
}

export async function createVehicle(payload) {
  try {
    const resp = await api.post('/api/vehicles', payload);
    return resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.createVehicle(payload);
    throw err;
  }
}

export async function deleteVehicle(id) {
  try {
    await api.delete(`/api/vehicles/${id}`);
  } catch (err) {
    if (shouldFallback(err)) {
      mock.deleteVehicle(id);
      return;
    }
    throw err;
  }
}

// ---- Cameras -----------------------------------------------------------------
export async function fetchCameras() {
  try {
    const resp = await api.get('/api/cameras');
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getCameras();
    throw err;
  }
}

export async function createCamera(payload) {
  try {
    const resp = await api.post('/api/cameras', payload);
    return resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.createCamera(payload);
    throw err;
  }
}

export async function deleteCamera(id) {
  try {
    await api.delete(`/api/cameras/${id}`);
  } catch (err) {
    if (shouldFallback(err)) {
      mock.deleteCamera(id);
      return;
    }
    throw err;
  }
}
